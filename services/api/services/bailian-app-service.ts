import { ENV } from '../_core/env.js';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

/**
 * 阿里云百炼应用聊天服务（带知识库检索增强）
 * 使用应用ID调用，知识库在百炼平台配置
 */
export async function* streamBailianAppChat(
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<{ type: string; content?: string; sources?: any }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${ENV.dashscopeApiKey}`,
    'Content-Type': 'application/json',
  };

  if (ENV.bailianWorkspaceId) {
    headers['X-DashScope-Workspace'] = ENV.bailianWorkspaceId;
  }

  // 使用百炼应用ID（70d88034a04045f0b0c57429e799b2b5）
  const appId = ENV.bailianAppId;

  const response = await fetch(`${DASHSCOPE_BASE}/api/v1/apps/${appId}/completion`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input: { messages },
      parameters: {
        result_type: 'text',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`百炼应用API错误: ${response.status} - ${errorText}`);
  }

  // 解析完整响应（百炼应用API目前不支持流式）
  const data = await response.json();

  // 提取来源信息（从响应文本中解析引用的文档）
  const text = data.output?.text || '';
  const sources: any[] = [];

  // 尝试从文本中提取引用信息
  const referenceMatch = text.match(/（参考文档：`([^`]+)`/);
  if (referenceMatch) {
    sources.push({
      title: referenceMatch[1],
      content: '知识库文档',
      score: 1,
    });
  }

  if (sources.length > 0) {
    yield { type: 'sources', sources };
  }

  // 返回完整内容
  yield { type: 'content', content: text };
}

/**
 * 非流式调用（用于测试）
 */
export async function callBailianApp(
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; sources?: any[] }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${ENV.dashscopeApiKey}`,
    'Content-Type': 'application/json',
  };

  if (ENV.bailianWorkspaceId) {
    headers['X-DashScope-Workspace'] = ENV.bailianWorkspaceId;
  }

  const appId = ENV.bailianAppId;

  const response = await fetch(`${DASHSCOPE_BASE}/api/v1/apps/${appId}/completion`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input: { messages },
      parameters: {
        result_type: 'text',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`百炼应用API错误: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  const text = data.output?.text || '';
  const sources: any[] = [];

  // 尝试从文本中提取引用信息
  const referenceMatch = text.match(/（参考文档：`([^`]+)`/);
  if (referenceMatch) {
    sources.push({
      title: referenceMatch[1],
      content: '知识库文档',
      score: 1,
    });
  }

  return {
    content: text,
    sources: sources.length > 0 ? sources : undefined,
  };
}
