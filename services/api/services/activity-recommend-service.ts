import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENV } from '../_core/env.js';
import { streamBailianAppChat } from './bailian-app-service.js';
import type { RetrieveDocument } from './knowledge-base-service.js';
import { createSupabaseClient } from '../lib/supabase.js';

const supabase = createSupabaseClient(ENV.supabaseUrl, ENV.supabaseAnonKey);

interface AnchorProfile {
  account_name: string;
  track_description: string;
  tags: string[];
  interests: string[];
}

// 活动数据字段（对应「结构化 活动信息.xlsx」的列）
const ACTIVITY_FIELDS = [
  '活动名称', '活动分类', '所属板块', '活动标签', '报名对象',
  '报名要求描述', '详细活动要求', '报名链接1', '报名链接2', '备注说明',
] as const;
type Activity = Record<typeof ACTIVITY_FIELDS[number], string>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_PATH = path.resolve(__dirname, '../data/activities.json');

/**
 * 读取本地活动数据（由 scripts/gen-activities-json.js 从 Excel 生成）。
 * 用本地数据做确定性板块匹配，不依赖向量检索（稀疏数据下召回不稳定）。
 */
function loadActivities(): Activity[] {
  try {
    return JSON.parse(fs.readFileSync(ACTIVITIES_PATH, 'utf8'));
  } catch (e) {
    console.error('[活动推荐] 读取 activities.json 失败:', e);
    return [];
  }
}

/** 把活动对象格式化为供 LLM 阅读的文本块 */
function formatActivity(a: Activity, idx: number): string {
  const lines = [`[${idx}] ${a['活动名称']}`];
  for (const f of ACTIVITY_FIELDS) {
    if (f === '活动名称') continue;
    const v = a[f];
    if (v) lines.push(`${f}: ${v}`);
  }
  return lines.join('\n');
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

// 板块关键词表：活动表格【所属板块】目前只有 娱乐 / 游戏 两类
const BOARD_KEYWORDS: Record<string, string[]> = {
  '游戏': ['游戏', '电竞', '手游', '端游', '主机', '单机', '网游', '王者', '英雄联盟', 'lol', '吃鸡', '绝地', 'fps', 'moba', 'rpg', '竞技', '射击', '策略', '卡牌', '洛克', '原神', '梦幻'],
  '娱乐': ['娱乐', '唱', '跳', '颜', '才艺', '舞蹈', '音乐', '唱歌', '聊天', '电台', 'asmr', '户外', '美食', '脱口秀', '情感', '颜值', '声优', 'cos'],
};

/**
 * 根据主播赛道/标签/兴趣判定所属板块（娱乐 / 游戏）
 * 关键词命中多者胜出；均未命中或平票时默认「娱乐」（活动覆盖最广）。
 */
export function classifyBoard(profile: AnchorProfile): string {
  const text = `${profile.track_description} ${profile.tags.join(' ')} ${profile.interests.join(' ')}`.toLowerCase();
  const scores: Record<string, number> = { '游戏': 0, '娱乐': 0 };
  for (const [board, kws] of Object.entries(BOARD_KEYWORDS)) {
    for (const kw of kws) {
      if (text.includes(kw)) scores[board]++;
    }
  }
  return scores['游戏'] > scores['娱乐'] ? '游戏' : '娱乐';
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

  // 2. 判定所属板块，并按【所属板块】在本地活动数据中精确筛选
  const board = classifyBoard(profile);

  if (!buildSearchQuery(profile).trim()) {
    yield { type: 'content', content: '请先在后台管理系统中完善您的赛道描述、标签和兴趣偏好信息，才能获取个性化活动推荐。' };
    return;
  }

  const allActivities = loadActivities();
  const matched = allActivities.filter(a => (a['所属板块'] || '').trim() === board);

  console.log(`[活动推荐] 所属板块: ${board} | 本地匹配活动数: ${matched.length}/${allActivities.length}`);

  if (matched.length === 0) {
    yield { type: 'content', content: `未找到【${board}】板块的活动数据，请确认 activities.json 是否已更新。` };
    return;
  }

  // 3. 返回匹配的活动（供前端展示来源）
  const sources: RetrieveDocument[] = matched.map((a, i) => ({
    id: String(i + 1),
    title: a['活动名称'],
    content: formatActivity(a, i + 1),
    score: 1,
  }));
  yield { type: 'sources', sources };

  // 4. 构建上下文并调用百炼应用生成推荐
  const knowledgeContext = matched.map((a, i) => formatActivity(a, i + 1)).join('\n\n---\n\n');

  const prompt = `你是一个活动推荐助手。根据主播赛道判定其所属板块，只从该板块的活动里推荐。

## 匹配规则（必须严格遵守）
1. 该主播所属板块已判定为【${board}】（依据其赛道介绍）
2. 下方提供的活动数据均为【所属板块=${board}】，可从中挑选推荐
3. 在同板块活动内，再按主播的具体标签/兴趣偏好，以及【报名对象】是否匹配主播类型（老主播/新主播/不限制）排序

## 主播信息
- 账号名称：${profile.account_name}
- 所属板块：${board}
- 赛道：${profile.track_description || '未设置'}
- 标签：${profile.tags.length > 0 ? profile.tags.join('、') : '未设置'}
- 兴趣偏好：${profile.interests.length > 0 ? profile.interests.join('、') : '未设置'}

## 同板块活动数据
${knowledgeContext}

## 输出要求
1. 每个推荐活动以「活动名称」开头，给出推荐理由
2. 多个活动按匹配度从高到低排列
3. 报名链接：对每个推荐活动，若其数据中包含【报名链接1】或【报名链接2】，必须在该活动信息中原样输出链接（URL 或链接标题），格式为「报名链接：xxx」。若无报名链接字段则不输出该项`;

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

  console.log(`[活动推荐] 处理完成，板块=${board}，匹配活动数=${matched.length}`);
}
