CREATE TABLE IF NOT EXISTS activity_recommends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corp_id text DEFAULT '',
  emp_id text NOT NULL DEFAULT 'visitor',
  content text NOT NULL DEFAULT '',
  sources jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_recommends_emp_id
  ON activity_recommends(emp_id);

CREATE INDEX IF NOT EXISTS idx_activity_recommends_emp_created_at
  ON activity_recommends(emp_id, created_at DESC);

ALTER TABLE activity_recommends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on activity_recommends" ON activity_recommends;
CREATE POLICY "Allow all on activity_recommends"
  ON activity_recommends
  FOR ALL
  USING (true)
  WITH CHECK (true);
