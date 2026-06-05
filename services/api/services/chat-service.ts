import { createClient } from '@supabase/supabase-js';
import { ENV } from '../_core/env.js';
import { streamBailianAppChat } from './bailian-app-service.js';
import { retrieve, retrieveAsContext } from './knowledge-base-service.js';

const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);

// 自动建表
export async function ensureChatTables() {
  try {
    // 检测表是否存在
    const { error: checkErr } = await supabase.from('chat_sessions').select('id').limit(1);
    if (!checkErr) {
      console.log('[chat] 表已存在，跳过创建');
      return;
    }

    console.log('[chat] 创建聊天表...');

    // 使用 Supabase SQL API 创建表（通过 RPC 或直接用 REST）
    // 由于 anon key 无法执行 DDL，这里通过 Supabase Management API 或手动处理
    // 改用 fetch 直接调用 Supabase 的 PostgreSQL 接口
    const sql = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        corp_id text DEFAULT '',
        emp_id text NOT NULL DEFAULT 'visitor',
        title text NOT NULL DEFAULT '新对话',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role text NOT NULL CHECK (role IN ('user', 'assistant')),
        content text NOT NULL DEFAULT '',
        sources jsonb,
        created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_emp_id ON chat_sessions(emp_id);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
      ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow all on chat_sessions" ON chat_sessions FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Allow all on chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
    `;

    const res = await fetch(`${ENV.supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${ENV.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!res.ok) {
      console.warn('[chat] 无法自动建表，请在 Supabase Dashboard 手动执行 supabase/migration/009_chat_tables.sql');
    } else {
      console.log('[chat] 表创建成功');
    }
  } catch (e) {
    console.warn('[chat] 自动建表失败，请在 Supabase Dashboard 手动执行 supabase/migration/009_chat_tables.sql');
  }
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any;
  created_at: string;
}

interface ChatSession {
  id: string;
  corp_id: string;
  emp_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// 获取或创建用户会话
export async function listSessions(empId: string): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('emp_id', empId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSession(empId: string, corpId: string, title: string): Promise<ChatSession> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ emp_id: empId, corp_id: corpId, title, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSession(sessionId: string, empId: string): Promise<void> {
  // 删除消息
  await supabase.from('chat_messages').delete().eq('session_id', sessionId);
  // 删除会话
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId).eq('emp_id', empId);
  if (error) throw error;
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveMessage(sessionId: string, role: string, content: string, sources?: any): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ session_id: sessionId, role, content, sources })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 流式聊天
export async function* streamChat(
  sessionId: string,
  content: string,
  indexId?: string
): AsyncGenerator<{ type: string; content?: string; sources?: any }> {
  console.log(`[聊天] 开始处理会话 ${sessionId}，内容: ${content.substring(0, 50)}...`);

  // 1. 保存用户消息
  await saveMessage(sessionId, 'user', content);

  // 2. 构建消息
  const history = await getMessages(sessionId);
  const messages: { role: string; content: string }[] = [];

  // 历史消息（最近10轮）
  const recent = history.slice(-20);
  for (const msg of recent) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // 当前消息
  messages.push({ role: 'user', content: content });

  // 3. 使用百炼应用（内置知识库检索增强）
  let fullContent = '';
  let sources: any[] = [];

  try {
    for await (const chunk of streamBailianAppChat(messages)) {
      if (chunk.type === 'content' && chunk.content) {
        fullContent += chunk.content;
        yield { type: 'content', content: chunk.content };
      } else if (chunk.type === 'sources' && chunk.sources) {
        sources = chunk.sources;
        yield { type: 'sources', sources };
      }
    }
  } catch (e) {
    console.error('[AI助手] 调用失败:', e);
    yield { type: 'content', content: '抱歉，AI助手暂时无法连接，请稍后重试。' };
    return;
  }

  // 4. 保存助手回复
  if (fullContent) {
    await saveMessage(sessionId, 'assistant', fullContent, sources.length > 0 ? sources : undefined);
  }

  // 5. 更新会话时间
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  console.log(`[聊天] 会话 ${sessionId} 处理完成`);
}
