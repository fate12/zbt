import crypto from 'crypto';
import { ENV } from '../_core/env.js';
import { createSupabaseClient } from '../lib/supabase.js';

const TOKEN_SECRET = ENV.supabaseAnonKey; // 用 anon key 作为签名密钥
const TOKEN_EXPIRY = '7d';

interface TokenPayload {
  emp_id: string;
  name: string;
  corp_id: string;
  type: 'zhibotong';
}

export interface AnchorUserProfile {
  emp_id: string;
  name: string;
  corp_id: string;
  track_description: string;
  tags: string[];
  interests: string[];
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
}

// 生成简单的 HMAC token
export function generateToken(payload: TokenPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7天
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

// 验证 token
export function verifyCustomToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    if (payload.type !== 'zhibotong') return null;

    return {
      emp_id: payload.emp_id,
      name: payload.name,
      corp_id: payload.corp_id,
      type: 'zhibotong',
    };
  } catch {
    return null;
  }
}

// 校验账号密码
export async function validateCredentials(accountName: string, accountPassword: string) {
  const supabase = createSupabaseClient(ENV.supabaseUrl, ENV.supabaseAnonKey);

  const { data, error } = await supabase
    .from('anchor_accounts')
    .select('id, account_name, account_password, status, track_description, tags, interests')
    .eq('account_name', accountName)
    .eq('is_deleted', 'n')
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const account = data[0];
  if (account.account_password !== accountPassword) return null;
  if (account.status === 'disabled') return null;

  return {
    emp_id: String(account.id),
    name: account.account_name,
    corp_id: 'zhibotong',
    track_description: account.track_description || '',
    tags: parseJsonArray(account.tags),
    interests: parseJsonArray(account.interests),
  };
}

export async function getAnchorUserProfile(empId: string): Promise<AnchorUserProfile | null> {
  const supabase = createSupabaseClient(ENV.supabaseUrl, ENV.supabaseAnonKey);

  const { data, error } = await supabase
    .from('anchor_accounts')
    .select('id, account_name, track_description, tags, interests')
    .eq('id', empId)
    .eq('is_deleted', 'n')
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const account = data[0];

  return {
    emp_id: String(account.id),
    name: account.account_name || '',
    corp_id: 'zhibotong',
    track_description: account.track_description || '',
    tags: parseJsonArray(account.tags),
    interests: parseJsonArray(account.interests),
  };
}
