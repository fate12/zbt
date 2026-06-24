import { ENV } from '../_core/env.js';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

export interface GeneralChatOptions {
  /** 可选 system prompt（用于复刻主播通助手人设等） */
  systemPrompt?: string;
}

/**
 * 通用模型流式聊天（DashScope OpenAI 兼容模式 /compatible-mode）。
 *
 * 用途：主播通 AI 助手在「无知识库 / 未命中知识库 / 检索失败」时的兜底回答，
 * 直接用 ENV.dashscopeModel（默认 qwen-plus）作答，不接入知识库检索。
 *
 * 响应为 SSE 流：逐行解析 `data:` 前缀，遇到 `[DONE]` 结束，
 * 取 `choices[0].delta.content` 作为增量文本逐块 yield。
 */
export async function* streamGeneralChat(
  messages: Array<{ role: string; content: string }>,
  options: GeneralChatOptions = {}
): AsyncGenerator<{ type: string; content?: string }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${ENV.dashscopeApiKey}`,
    'Content-Type': 'application/json',
  };

  // 与 bailian-app-service 一致：配置了工作空间ID才加该头部
  if (ENV.bailianWorkspaceId) {
    headers['X-DashScope-Workspace'] = ENV.bailianWorkspaceId;
  }

  // 可选 system prompt（复刻主播通助手人设，避免兜底答得像裸 AI）
  const finalMessages = options.systemPrompt
    ? [{ role: 'system', content: options.systemPrompt }, ...messages]
    : messages;

  const response = await fetch(`${DASHSCOPE_BASE}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ENV.dashscopeModel,
      messages: finalMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`通用模型API错误: ${response.status} - ${errorText}`);
  }

  // 解析 SSE 流：Node 20 原生 fetch 的 response.body 为 web ReadableStream，可 getReader()
  const reader = (response.body as any)?.getReader?.();
  if (!reader) {
    // 兜底：body 不可流式读取时，按非流式结构解析一次
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    if (text) yield { type: 'content', content: text };
    return;
  }

  /** 解析一行 SSE data：命中则 yield 增量内容；返回 true 表示收到 [DONE] 应终止 */
  const parseData = function* (data: string): Generator<{ type: string; content?: string }, boolean> {
    if (data === '[DONE]') return true;
    if (!data) return false;
    try {
      const chunk = JSON.parse(data);
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield { type: 'content', content: delta };
    } catch {
      // 单行解析失败时跳过，不中断整条流
    }
    return false;
  };

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // 保留可能不完整的最后一行

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const gen = parseData(trimmed.slice(5).trim());
      let stop = false;
      while (true) {
        const r = gen.next();
        if (!r.done) {
          yield r.value;
        } else {
          stop = r.value; // parseData 的 return 值：是否 [DONE]
          break;
        }
      }
      if (stop) return;
    }
  }

  // 处理 buffer 中可能残留的最后一行
  const tail = buffer.trim();
  if (tail.startsWith('data:')) {
    const data = tail.slice(5).trim();
    if (data && data !== '[DONE]') {
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield { type: 'content', content: delta };
      } catch {
        /* 忽略残留行解析失败 */
      }
    }
  }
}
