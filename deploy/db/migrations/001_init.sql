-- ════════════════════════════════════════════════════════════════════════
--  主播通 · 阿里云 RDS PostgreSQL 初始化脚本（全新空库）
--  ────────────────────────────────────────────────────────────────────────
--  用途：在【阿里云 RDS PostgreSQL】新建空库后，用 psql / DMS 把本文件
--        完整执行一次，即可建出主播通运行所需的全部表、索引、计数函数、默认管理员。
--
--  与旧 supabase/init-supabase.sql 的差异：
--    ① 不再依赖 Supabase（去 pgvector / 向量表 / match_knowledge_chunks / RAG 表）
--    ② 不启用 RLS、不建 POLICY（权限由应用层 need_login 中间件统一控制）
--    ③ operation_logs 列按代码实际写入修正（operation_content TEXT、target_id TEXT）
--    ④ 历史数据可丢，不做数据搬迁
--
--  ⚠️ 执行完后还必须：
--    ① 在阿里云 OSS 建好 Bucket（读写权限按需）
--    ② 配好服务的 .env（DATABASE_URL / JWT_SECRET / OSS_*）
--    ③ 部署后立即修改默认管理员密码 admin/admin123
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. 管理员登录账号表（含公会导入 22 列 + 展示字段）─────────────────────
-- ⚠️ 默认账号 admin / admin123（明文，仅用于首次登录），部署完成后请立即修改！
CREATE TABLE IF NOT EXISTS anchor_accounts (
  id SERIAL PRIMARY KEY,
  account_name VARCHAR(128) UNIQUE NOT NULL,
  account_password VARCHAR(256) NOT NULL,
  status VARCHAR(32) DEFAULT 'active',
  role VARCHAR(32) DEFAULT 'admin',
  corp_id VARCHAR(128) DEFAULT 'zhibotong',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_deleted CHAR(1) DEFAULT 'n',
  -- 展示名（account_name 存数字 uid，昵称单独存以便展示）
  display_name VARCHAR(256) DEFAULT '',
  track_description TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  interests TEXT DEFAULT '[]',
  creator_emp_id VARCHAR(128) DEFAULT '',
  -- 公会后台主播字段（数值/比例列含 '-' 占位，统一 TEXT 原样存储）
  operation_agent VARCHAR(128) DEFAULT '',       -- 运营经纪人
  recruit_agent VARCHAR(128) DEFAULT '',         -- 招募经纪人
  room_id VARCHAR(64) DEFAULT '',                -- 房间号
  anchor_type VARCHAR(64) DEFAULT '',            -- 主播类型
  topstar_level VARCHAR(64) DEFAULT '',          -- TOPSTAR等级
  cooperation_period TEXT DEFAULT '',            -- 合作时间
  sign_time TEXT DEFAULT '',                     -- 签约时间
  sign_status VARCHAR(64) DEFAULT '',            -- 签约状态
  is_star_anchor VARCHAR(16) DEFAULT '',         -- 是否繁星主播
  star_level VARCHAR(32) DEFAULT '',             -- 繁星主播星级
  star_task TEXT DEFAULT '',                     -- 星级任务
  fans_count TEXT DEFAULT '',                    -- 粉丝数
  revenue_30d TEXT DEFAULT '',                   -- 近30天流水
  expire_in_days TEXT DEFAULT '',                -- 距离到期时间
  gift_withdraw_rate TEXT DEFAULT '',            -- 主播礼物收益自提比例
  sign_bonus_rate TEXT DEFAULT '',               -- 主播签约金自提比例
  ops_reward_rate TEXT DEFAULT '',               -- 主播运营奖惩进自提比例
  renew_status VARCHAR(32) DEFAULT '',           -- 续约状态
  auto_renew VARCHAR(16) DEFAULT '',             -- 自动续约按钮
  no_broadcast_days TEXT DEFAULT '',             -- 未开播天数
  import_source VARCHAR(256) DEFAULT ''          -- 导入溯源
);
CREATE INDEX IF NOT EXISTS idx_anchor_accounts_account_name ON anchor_accounts(account_name);
CREATE INDEX IF NOT EXISTS idx_anchor_accounts_status ON anchor_accounts(status);

INSERT INTO anchor_accounts (account_name, account_password, status, role)
VALUES ('admin', 'admin123', 'active', 'admin')
ON CONFLICT (account_name) DO UPDATE SET
  account_password = EXCLUDED.account_password,
  status = EXCLUDED.status,
  role = EXCLUDED.role,
  updated_at = NOW();


-- ── 2. 聊天会话 / 消息表 ─────────────────────────────────────────────────
-- （API 启动时也会 ensureChatTables 幂等创建，此处为提前建好 + 含 RAG 扩展列）
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corp_id text DEFAULT '',
  emp_id text NOT NULL DEFAULT 'visitor',
  title text NOT NULL DEFAULT '新对话',
  type VARCHAR(64),
  index_id VARCHAR(128),
  model VARCHAR(64),
  system_prompt TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  sources jsonb,
  metadata JSONB,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_emp_id ON chat_sessions(emp_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);


-- ── 3. 活动推荐表 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_recommends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corp_id text DEFAULT '',
  emp_id text NOT NULL DEFAULT 'visitor',
  content text NOT NULL DEFAULT '',
  sources jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_recommends_emp_id ON activity_recommends(emp_id);
CREATE INDEX IF NOT EXISTS idx_activity_recommends_emp_created_at ON activity_recommends(emp_id, created_at DESC);


-- ── 4. 活动推荐次数计数表 + 原子累加函数 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_recommend_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corp_id text DEFAULT '',
  emp_id text NOT NULL DEFAULT 'visitor',
  activity_key text NOT NULL,
  activity_name text NOT NULL DEFAULT '',
  recommend_count integer NOT NULL DEFAULT 0,
  last_recommended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_counts_emp_activity
  ON activity_recommend_counts(emp_id, activity_key);
CREATE INDEX IF NOT EXISTS idx_activity_counts_emp ON activity_recommend_counts(emp_id);

-- 原子累加（ON CONFLICT upsert，并发安全）。纯 PL/pgSQL，vanilla PG 可直接执行。
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


-- ── 5. 操作日志 / 导入记录表 ─────────────────────────────────────────────
-- ⚠️ operation_logs 列按 importRoutes.ts 实际写入定义（operation_content、target_id 文本）
CREATE TABLE IF NOT EXISTS operation_logs (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  operation_type VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id TEXT,
  operation_content TEXT NOT NULL DEFAULT '',
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_records (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  file_name VARCHAR(256) NOT NULL,
  file_type VARCHAR(32) NOT NULL,
  -- 存 OSS object key（非完整 URL）；download 时由服务端 getPublicUrl 还原
  file_path TEXT NOT NULL,
  file_size INTEGER,
  status VARCHAR(32) DEFAULT 'pending',
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  error_message TEXT,
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════════════
--  ✅ 数据库初始化完成。
--     抽查：SELECT account_name FROM anchor_accounts;            -- 应有 admin
--           \df increment_activity_recommend_count;              -- 函数应存在
--           \dt                                                  -- 表清单
-- ════════════════════════════════════════════════════════════════════════
