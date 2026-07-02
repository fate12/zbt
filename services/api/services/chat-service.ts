import { query } from '../lib/db.js';
import { ENV } from '../_core/env.js';
import { streamBailianAppChat } from './bailian-app-service.js';
import { retrieve } from './knowledge-base-service.js';
import { streamGeneralChat } from './general-model-service.js';

// 注：表的创建由 lib/migrations.ts 在启动时统一管理（deploy/db/migrations/*.sql），
// 本文件只负责读写。

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
  return query<ChatSession>(
    `SELECT * FROM chat_sessions WHERE emp_id = $1 ORDER BY updated_at DESC`,
    [empId],
  );
}

export async function createSession(
  empId: string,
  corpId: string,
  title: string
): Promise<{ session: ChatSession; removedEmptyIds: string[] }> {
  const removedEmptyIds: string[] = [];

  // 清理：删除该用户所有「没有任何消息」的空会话，避免空对话一直占位（随后新建一个全新的替代）
  const userSessions = await query<{ id: string }>(
    `SELECT id FROM chat_sessions WHERE emp_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [empId],
  );

  if (userSessions.length > 0) {
    const sessionIds = userSessions.map((s) => s.id);
    const withMsg = await query<{ session_id: string }>(
      `SELECT DISTINCT session_id FROM chat_messages WHERE session_id = ANY($1::uuid[])`,
      [sessionIds],
    );
    const busy = new Set(withMsg.map((m) => m.session_id));
    const emptyIds = sessionIds.filter((id) => !busy.has(id));
    if (emptyIds.length > 0) {
      // chat_messages 对 chat_sessions 有 ON DELETE CASCADE，删会话即联动清消息
      await query(`DELETE FROM chat_sessions WHERE id = ANY($1::uuid[])`, [emptyIds]);
      removedEmptyIds.push(...emptyIds);
    }
  }

  const rows = await query<ChatSession>(
    `INSERT INTO chat_sessions (emp_id, corp_id, title, updated_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [empId, corpId, title, new Date().toISOString()],
  );

  return { session: rows[0], removedEmptyIds };
}

export async function deleteSession(sessionId: string, empId: string): Promise<void> {
  // chat_messages ON DELETE CASCADE 会自动清消息
  await query(
    `DELETE FROM chat_sessions WHERE id = $1 AND emp_id = $2`,
    [sessionId, empId],
  );
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  return query<ChatMessage>(
    `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId],
  );
}

export async function saveMessage(sessionId: string, role: string, content: string, sources?: any): Promise<ChatMessage> {
  const rows = await query<ChatMessage>(
    `INSERT INTO chat_messages (session_id, role, content, sources)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [sessionId, role, content, sources ? JSON.stringify(sources) : null],
  );
  return rows[0];
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
  await query(
    `UPDATE chat_sessions SET updated_at = $1 WHERE id = $2`,
    [new Date().toISOString(), sessionId],
  );

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
  const rows = await query<ActivityRecommend>(
    `SELECT * FROM activity_recommends WHERE emp_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [empId],
  );
  return rows.length > 0 ? rows[0] : null;
}

// 获取用户的活动推荐历史列表（按时间倒序，全部保留）
export async function listActivityRecommends(empId: string, limit = 50): Promise<ActivityRecommend[]> {
  return query<ActivityRecommend>(
    `SELECT * FROM activity_recommends WHERE emp_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [empId, limit],
  );
}

// 删除单条活动推荐（带 emp_id 校验，防越权）
export async function deleteActivityRecommend(id: string, empId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM activity_recommends WHERE id = $1 AND emp_id = $2 RETURNING id`,
    [id, empId],
  );
  return rows.length > 0;
}

// 保存活动推荐（保留全部历史，不再删除旧记录）
export async function saveActivityRecommend(
  empId: string,
  corpId: string,
  content: string,
  sources: any[]
): Promise<ActivityRecommend> {
  console.log('[activity-recommend] 开始保存推荐:', { empId, contentLength: content.length, sourcesCount: sources.length });

  const rows = await query<ActivityRecommend>(
    `INSERT INTO activity_recommends (emp_id, corp_id, content, sources)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [empId, corpId, content, JSON.stringify(sources)],
  );

  console.log('[activity-recommend] 保存成功:', rows[0].id);
  return rows[0];
}
