-- 活动推荐次数计数表：按 主播(emp_id) × 活动(activity_key) 维度累计
-- 当某活动对该主播的 recommend_count >= 该活动「推荐频次上限」时，不再推荐该活动。
CREATE TABLE IF NOT EXISTS activity_recommend_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corp_id text DEFAULT '',
  emp_id text NOT NULL DEFAULT 'visitor',
  activity_key text NOT NULL,            -- normalizeActivityKey(活动名称)，规范化主键
  activity_name text NOT NULL DEFAULT '',-- 活动名称原文，便于审计/回显
  recommend_count integer NOT NULL DEFAULT 0,
  last_recommended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 同一主播同一活动只能有一行计数（幂等 upsert 的基础）
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_counts_emp_activity
  ON activity_recommend_counts(emp_id, activity_key);

CREATE INDEX IF NOT EXISTS idx_activity_counts_emp
  ON activity_recommend_counts(emp_id);

ALTER TABLE activity_recommend_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on activity_recommend_counts" ON activity_recommend_counts;
CREATE POLICY "Allow all on activity_recommend_counts"
  ON activity_recommend_counts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 原子累加：同一 (emp_id, activity_key) 不存在则插入，存在则计数 +p_increment。
-- 用 ON CONFLICT 规避「先查后写」的并发竞态。
CREATE OR REPLACE FUNCTION increment_activity_recommend_count(
  p_emp_id text,
  p_corp_id text,
  p_activity_key text,
  p_activity_name text,
  p_increment int DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO activity_recommend_counts (emp_id, corp_id, activity_key, activity_name, recommend_count, last_recommended_at, updated_at)
  VALUES (p_emp_id, p_corp_id, p_activity_key, p_activity_name, p_increment, now(), now())
  ON CONFLICT (emp_id, activity_key) DO UPDATE SET
    recommend_count = activity_recommend_counts.recommend_count + EXCLUDED.recommend_count,
    activity_name = EXCLUDED.activity_name,
    corp_id = EXCLUDED.corp_id,
    last_recommended_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
