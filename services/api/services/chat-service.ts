import { ENV } from '../_core/env.js';
import { streamBailianAppChat } from './bailian-app-service.js';
import { retrieve } from './knowledge-base-service.js';
import { streamGeneralChat } from './general-model-service.js';
import { createSupabaseClient } from '../lib/supabase.js';

const supabase = createSupabaseClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey
);

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

// 通用模型兜底时的人设（无知识库 / 未命中知识库时使用）
const GENERAL_ASSISTANT_PROMPT = `你是「主播通」的 AI 助手，主要服务直播主播，解答直播相关的常见问题（开播准备、直播间互动、流量增长、直播带货、合规注意事项等）。
请用简洁、可执行的中文回答；若问题超出直播范畴或你没有把握，请如实说明，不要编造。`;

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

  // 3. 判定是否命中知识库：无索引 / 未命中 / 检索失败 → 走通用模型兜底
  const targetIndexId = indexId || ENV.bailianDefaultIndexId;
  let useKb = false;

  if (targetIndexId) {
    try {
      const result = await retrieve({
        indexId: targetIndexId,
        query: content,
        topK: 5,
        rerank: true,
      });
      const topScore = result.documents[0]?.score ?? 0;
      useKb = result.documents.length > 0 && topScore >= ENV.bailianKbHitMinScore;
      console.log(
        `[聊天] 知识库检索：命中 ${result.documents.length} 条，top score=${topScore.toFixed(4)}，阈值=${ENV.bailianKbHitMinScore} → 走${useKb ? '知识库(百炼App)' : '通用模型'}`
      );
    } catch (e: any) {
      console.error('[聊天] 知识库检索失败，降级走通用模型:', e?.message);
      useKb = false;
    }
  } else {
    console.log('[聊天] 未配置知识库索引，走通用模型兜底');
  }

  // 4. 调用 LLM：命中知识库 → 百炼 App（带来源）；否则 → 通用模型兜底
  let fullContent = '';
  let sources: any[] = [];

  try {
    const gen: AsyncGenerator<{ type: string; content?: string; sources?: any }> = useKb
      ? streamBailianAppChat(messages)
      : streamGeneralChat(messages, { systemPrompt: GENERAL_ASSISTANT_PROMPT });

    for await (const chunk of gen) {
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

  // 5. 保存助手回复
  if (fullContent) {
    await saveMessage(sessionId, 'assistant', fullContent, sources.length > 0 ? sources : undefined);
  }

  // 6. 更新会话时间
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  console.log(`[聊天] 会话 ${sessionId} 处理完成`);
}

// ==================== 活动推荐存储 ====================

interface ActivityRecommend {
  id: string;
  emp_id: string;
  corp_id: string;
  content: string;
  sources: any[];
  created_at: string;
}

// 获取用户最近的活动推荐
export async function getLastActivityRecommend(empId: string): Promise<ActivityRecommend | null> {
  const { data, error } = await supabase
    .from('activity_recommends')
    .select('*')
    .eq('emp_id', empId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

// 获取用户的活动推荐历史列表（按时间倒序，全部保留）
export async function listActivityRecommends(empId: string, limit = 50): Promise<ActivityRecommend[]> {
  const { data, error } = await supabase
    .from('activity_recommends')
    .select('*')
    .eq('emp_id', empId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// 删除单条活动推荐（带 emp_id 校验，防越权）
export async function deleteActivityRecommend(id: string, empId: string): Promise<boolean> {
  const { error, count } = await supabase
    .from('activity_recommends')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('emp_id', empId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

// 保存活动推荐（保留全部历史，不再删除旧记录）
export async function saveActivityRecommend(
  empId: string,
  corpId: string,
  content: string,
  sources: any[]
): Promise<ActivityRecommend> {
  console.log('[activity-recommend] 开始保存推荐:', { empId, contentLength: content.length, sourcesCount: sources.length });

  const { data, error } = await supabase
    .from('activity_recommends')
    .insert({
      emp_id: empId,
      corp_id: corpId,
      content,
      sources,
    })
    .select()
    .single();

  if (error) {
    console.error('[activity-recommend] 保存失败:', error);
    throw error;
  }

  console.log('[activity-recommend] 保存成功:', data.id);
  return data;
}

// 在 ensureChatTables 中添加活动推荐表
export async function ensureActivityRecommendTable() {
  try {
    // 检测表是否存在
    const { error: checkErr } = await supabase.from('activity_recommends').select('id').limit(1);
    if (!checkErr) {
      console.log('[activity-recommend] 表已存在，跳过创建');
      return;
    }

    console.log('[activity-recommend] 创建活动推荐表...');

    const sql = `
      CREATE TABLE IF NOT EXISTS activity_recommends (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        corp_id text DEFAULT '',
        emp_id text NOT NULL DEFAULT 'visitor',
        content text NOT NULL DEFAULT '',
        sources jsonb DEFAULT '[]'::jsonb,
        created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_activity_recommends_emp_id ON activity_recommends(emp_id);
      ALTER TABLE activity_recommends ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow all on activity_recommends" ON activity_recommends FOR ALL USING (true) WITH CHECK (true);
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
      console.warn('[activity-recommend] 无法自动建表');
    } else {
      console.log('[activity-recommend] 表创建成功');
    }
  } catch (e) {
    console.warn('[activity-recommend] 自动建表失败');
  }
}
