import { createSupabaseClient } from '../lib/supabase.js';
import { ENV } from '../_core/env.js';

// 与 chat-service.ts 一致：优先 service_role key，便于绕过 RLS 写入计数
const supabase = createSupabaseClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey
);

/** 候选活动（带规范化主键、原名称、推荐频次上限；frequency=Infinity 表示无限制） */
export interface ActivityWithFreq {
  activity: Record<string, string>; // 原 activities.json 的活动对象
  activityKey: string;              // normalizeActivityKey(活动名称)
  activityName: string;             // 活动名称原文（审计/回显）
  frequency: number;                // 该活动推荐频次上限；Infinity=无限制
}

/** 过滤后仍可推荐的活动，附带已用次数与剩余次数 */
export interface FilteredActivity extends ActivityWithFreq {
  used: number;
  remaining: number; // frequency - used；Infinity=无限制
}

interface CountRow {
  activity_key: string;
  recommend_count: number;
}

/**
 * 一次性取某主播多个活动的已推荐次数，返回 Map<activityKey, count>。
 * 用 in(...) 单次查询，避免 N 次往返。查询失败时按 0 计（不阻塞推荐，宁可放过）。
 */
export async function getRecommendCounts(
  empId: string,
  activityKeys: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (activityKeys.length === 0) return map;
  const { data, error } = await supabase
    .from('activity_recommend_counts')
    .select('activity_key, recommend_count')
    .eq('emp_id', empId)
    .in('activity_key', activityKeys);
  if (error) {
    console.error('[activity-count] 查询计数失败:', error);
    return map;
  }
  for (const row of (data ?? []) as CountRow[]) {
    map.set(row.activity_key, row.recommend_count ?? 0);
  }
  return map;
}

/**
 * 过滤出「尚未达到推荐频次上限」的活动。
 * remaining = frequency - used；frequency=Infinity（频次缺失）的活动永远可用。
 */
export async function filterAvailableActivities(
  empId: string,
  activities: ActivityWithFreq[]
): Promise<FilteredActivity[]> {
  const counts = await getRecommendCounts(empId, activities.map(a => a.activityKey));
  const available: FilteredActivity[] = [];
  for (const a of activities) {
    const used = counts.get(a.activityKey) ?? 0;
    const remaining = Number.isFinite(a.frequency) ? a.frequency - used : Infinity;
    if (remaining > 0) {
      available.push({ ...a, used, remaining });
    }
  }
  return available;
}

/**
 * 对一批活动原子 +1（LLM 实际推荐了哪几个）。
 * 调用 014 migration 的 increment_activity_recommend_count RPC（ON CONFLICT 原子累加）。
 * 单个活动失败只记日志不抛出，避免影响整体推荐流程。
 */
export async function incrementRecommendCounts(
  empId: string,
  corpId: string,
  items: Array<{ activityKey: string; activityName: string }>
): Promise<void> {
  for (const item of items) {
    const { error } = await supabase.rpc('increment_activity_recommend_count', {
      p_emp_id: empId,
      p_corp_id: corpId,
      p_activity_key: item.activityKey,
      p_activity_name: item.activityName,
      p_increment: 1,
    });
    if (error) {
      console.error(`[activity-count] 累加失败 activity=${item.activityName}:`, error);
    }
  }
}
