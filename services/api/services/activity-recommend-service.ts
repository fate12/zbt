import { createClient } from '@supabase/supabase-js';
import { ENV } from '../_core/env.js';
import { retrieve } from './knowledge-base-service.js';
import { streamBailianAppChat } from './bailian-app-service.js';
import type { RetrieveDocument } from './knowledge-base-service.js';

const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);

interface AnchorProfile {
  account_name: string;
  track_description: string;
  tags: string[];
  interests: string[];
}

/**
 * 从 anchor_accounts 表获取主播资料
 */
export async function getAnchorProfile(empId: string): Promise<AnchorProfile> {
  const { data, error } = await supabase
    .from('anchor_accounts')
    .select('account_name, track_description, tags, interests')
    .eq('id', empId)
    .eq('is_deleted', 'n')
    .single();

  if (error || !data) {
    throw new Error('未找到主播账号信息');
  }

  let tags: string[] = [];
  let interests: string[] = [];

  try {
    tags = typeof data.tags === 'string' ? JSON.parse(data.tags) : (data.tags || []);
  } catch { tags = []; }

  try {
    interests = typeof data.interests === 'string' ? JSON.parse(data.interests) : (data.interests || []);
  } catch { interests = []; }

  return {
    account_name: data.account_name || '',
    track_description: data.track_description || '',
    tags,
    interests,
  };
}

/**
 * 将主播资料拼接为知识库搜索词
 */
export function buildSearchQuery(profile: AnchorProfile): string {
  const parts: string[] = [];
  if (profile.track_description) parts.push(profile.track_description);
  if (profile.tags.length > 0) parts.push(...profile.tags);
  if (profile.interests.length > 0) parts.push(...profile.interests);
  return parts.join(' ');
}

/**
 * 流式活动推荐主流程
 * 使用知识库索引 12jffy38ih 检索活动数据，再用百炼应用生成推荐
 */
export async function* streamActivityRecommendation(
  empId: string
): AsyncGenerator<{ type: string; content?: string; sources?: RetrieveDocument[] }> {
  console.log(`[活动推荐] 开始处理，主播ID: ${empId}`);

  // 1. 获取主播资料
  let profile: AnchorProfile;
  try {
    profile = await getAnchorProfile(empId);
  } catch (e: any) {
    yield { type: 'error', content: '未找到主播账号信息，请先完善账号资料。' };
    return;
  }

  // 2. 构建搜索词
  const searchQuery = buildSearchQuery(profile);

  if (!searchQuery.trim()) {
    yield { type: 'content', content: '请先在后台管理系统中完善您的赛道描述、标签和兴趣偏好信息，才能获取个性化活动推荐。' };
    return;
  }

  console.log(`[活动推荐] 搜索词: ${searchQuery}`);

  // 3. 知识库检索（使用活动推荐专用索引 12jffy38ih）
  let documents: RetrieveDocument[] = [];

  try {
    const result = await retrieve({
      indexId: ENV.bailianActivityIndexId,
      query: searchQuery,
      topK: 10,
      rerank: true,
    });
    documents = result.documents;
  } catch (e) {
    console.error('[活动推荐] 知识库检索失败:', e);
  }

  // 4. 返回匹配的知识库文档
  if (documents.length > 0) {
    yield { type: 'sources', sources: documents };
  }

  // 5. 构建上下文并调用百炼应用生成推荐
  const knowledgeContext = documents
    .map((doc, idx) => `[${idx + 1}] ${doc.title}\n${doc.content}`)
    .join('\n\n---\n\n');

  const prompt = `你是一个活动推荐助手。根据以下主播信息和知识库中匹配的活动数据，为该主播推荐最合适的活动。

## 主播信息
- 账号名称：${profile.account_name}
- 赛道：${profile.track_description || '未设置'}
- 标签：${profile.tags.length > 0 ? profile.tags.join('、') : '未设置'}
- 兴趣偏好：${profile.interests.length > 0 ? profile.interests.join('、') : '未设置'}

## 知识库匹配的活动数据
${knowledgeContext || '（未匹配到相关活动数据）'}

## 要求
请根据以上信息，为该主播推荐最适合的活动。要求：
1. 优先推荐与主播赛道和兴趣最匹配的活动
2. 给出推荐理由
3. 如果有多个匹配活动，按匹配度从高到低排列`;

  try {
    // 使用现有百炼应用生成推荐（带知识库检索增强）
    const messages = [{ role: 'user', content: prompt }];
    let fullContent = '';

    for await (const chunk of streamBailianAppChat(messages)) {
      if (chunk.type === 'content' && chunk.content) {
        fullContent += chunk.content;
        yield { type: 'content', content: chunk.content };
      }
    }

    if (!fullContent) {
      yield { type: 'content', content: '暂无匹配的活动推荐，请稍后重试。' };
    }
  } catch (e: any) {
    console.error('[活动推荐] 百炼应用调用失败:', e);
    yield { type: 'error', content: `活动推荐服务暂时不可用：${e.message}` };
  }

  console.log(`[活动推荐] 处理完成，匹配文档数: ${documents.length}`);
}
