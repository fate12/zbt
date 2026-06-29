-- ════════════════════════════════════════════════════════════════════════
--  主播通 · Supabase 项目初始化脚本（全新空库）
--  ────────────────────────────────────────────────────────────────────────
--  用途：在【客户的新 Supabase 项目】里把本文件完整粘贴进 SQL Editor 一次执行，
--        即可建出主播通运行所需的全部表、索引、向量搜索函数、默认管理员账号。
--
--  本脚本由仓库 supabase/migration/*.sql 与 supabase/tables/anchor_management.sql
--  合并、去重、并修正了以下问题，可直接执行：
--    ① 重排了依赖顺序（chat_sessions 必须先于 ALTER 其列的 004_add_rag_fields）
--    ② 合并了重复的 sync_logs 定义（取字段更全的版本）
--    ③ 剔除了 010_default_admin.sql（含 NOW()1 语法错误、方法均被注释、未真正建账号）
--    ④ 剔除了 012_check_structure.sql（仅为诊断 SELECT，非建表语句）
--    ⑤ 所有建表统一为 IF NOT EXISTS，可安全重复执行（幂等）
--
--  ⚠️ 执行完后还必须做两件事（见 docs/客户交接-部署手册.md）：
--    ① 在 Storage 里建一个 public 桶（或跑 scripts/create-bucket.mjs）
--    ② 部署后立即修改默认管理员密码 admin/admin123
-- ════════════════════════════════════════════════════════════════════════


-- ── 0. 扩展 ──────────────────────────────────────────────────────────────
-- pgvector：知识库向量检索依赖（Supabase 默认已支持）
CREATE EXTENSION IF NOT EXISTS vector;


-- ── 1. 主播管理核心表 ───────────────────────────────────────────────────
-- 主播表
CREATE TABLE IF NOT EXISTS public.anchors_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  nickname VARCHAR(128) NOT NULL,
  avatar TEXT,
  phone VARCHAR(32),
  email VARCHAR(128),
  status VARCHAR(32) DEFAULT 'pending',
  level VARCHAR(32) DEFAULT 'junior',
  department VARCHAR(128),
  follower_count INTEGER DEFAULT 0,
  bio TEXT,
  anchor_emp_id TEXT,
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 活动表
CREATE TABLE IF NOT EXISTS public.activities_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  title VARCHAR(256) NOT NULL,
  anchor_id INTEGER,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(32) DEFAULT 'upcoming',
  activity_type VARCHAR(64),
  description TEXT,
  viewer_count INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  -- 外部同步追踪（原 add_sync_import_tables.sql 追加列）
  external_id VARCHAR(256),
  external_source VARCHAR(64),
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 同步日志表（合并 006_sync_logs 与 anchor_management 两版，取并集）
CREATE TABLE IF NOT EXISTS public.sync_logs_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  doc_url TEXT NOT NULL,
  sync_type VARCHAR(32) DEFAULT 'manual',
  status VARCHAR(32) DEFAULT 'pending',
  record_count INTEGER DEFAULT 0,
  error_message TEXT,
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_corp_id ON public.sync_logs_bacad2ba_27a(corp_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs_bacad2ba_27a(status);

-- 系统设置表
CREATE TABLE IF NOT EXISTS public.system_settings_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  setting_key VARCHAR(128) NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(32) DEFAULT 'string',
  description VARCHAR(256),
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- ── 2. 知识库与 RAG 表 ──────────────────────────────────────────────────
-- 知识库主表
CREATE TABLE IF NOT EXISTS public.knowledge_base_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  title VARCHAR(512) NOT NULL,
  content TEXT,
  summary TEXT,
  source VARCHAR(32) DEFAULT 'manual',
  source_url TEXT,
  category VARCHAR(64),
  tags TEXT,
  doc_type VARCHAR(32),
  external_id VARCHAR(256),
  file_url TEXT,
  status VARCHAR(32) DEFAULT 'active',
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_source ON public.knowledge_base_bacad2ba_27a(source);
CREATE INDEX IF NOT EXISTS idx_kb_category ON public.knowledge_base_bacad2ba_27a(category);
CREATE INDEX IF NOT EXISTS idx_kb_external_id ON public.knowledge_base_bacad2ba_27a(external_id);

-- RAG 会话/消息表
CREATE TABLE IF NOT EXISTS public.rag_sessions_bacad2ba_27a (
  id TEXT PRIMARY KEY,
  corp_id VARCHAR(128),
  user_id VARCHAR(128) NOT NULL,
  title VARCHAR(256) DEFAULT '新对话',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.rag_messages_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  session_id TEXT NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_sessions_user ON public.rag_sessions_bacad2ba_27a(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_messages_session ON public.rag_messages_bacad2ba_27a(session_id);
CREATE INDEX IF NOT EXISTS idx_rag_messages_created ON public.rag_messages_bacad2ba_27a(created_at);

-- 知识切片表（含向量列，依赖 knowledge_base 与 pgvector 扩展）
CREATE TABLE IF NOT EXISTS public.knowledge_chunks_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES public.knowledge_base_bacad2ba_27a(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024),
  token_count INTEGER DEFAULT 0,
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON public.knowledge_chunks_bacad2ba_27a
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_knowledge_id ON public.knowledge_chunks_bacad2ba_27a(knowledge_id);

-- 向量相似度搜索函数（知识库 RAG 检索核心）
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1024),
  match_count INTEGER DEFAULT 5,
  filter_knowledge_ids INTEGER[] DEFAULT '{}'
)
RETURNS TABLE (
  id INTEGER,
  knowledge_id INTEGER,
  chunk_index INTEGER,
  content TEXT,
  similarity FLOAT,
  kb_title VARCHAR,
  kb_source VARCHAR,
  kb_category VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.knowledge_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    k.title AS kb_title,
    k.source AS kb_source,
    k.category AS kb_category
  FROM public.knowledge_chunks_bacad2ba_27a c
  JOIN public.knowledge_base_bacad2ba_27a k ON k.id = c.knowledge_id
  WHERE c.is_deleted = 'n'
    AND k.is_deleted = 'n'
    AND (filter_knowledge_ids = '{}' OR c.knowledge_id = ANY(filter_knowledge_ids))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ── 3. 聊天会话/消息/知识文档表（API 启动时也会自动建，此处为提前建好）──
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
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_size bigint DEFAULT 0,
  file_type text DEFAULT '',
  file_path text DEFAULT '',
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'parsing', 'ready', 'error')),
  index_id text DEFAULT '',
  bailian_file_id text DEFAULT '',
  emp_id text DEFAULT 'visitor',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_emp_id ON chat_sessions(emp_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_created ON knowledge_documents(created_at DESC);

-- RLS：全部放行（权限由应用层 need_login 中间件统一控制，RLS 仅作存在性占位）
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on chat_sessions" ON chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on knowledge_documents" ON knowledge_documents FOR ALL USING (true) WITH CHECK (true);

-- 给 chat 表追加 RAG 相关列（原 004_add_rag_fields_5e1d.sql，必须在 chat 表建好后执行）
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS type VARCHAR(64);
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS index_id VARCHAR(128);
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS model VARCHAR(64);
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;


-- ── 4. 活动推荐表 ───────────────────────────────────────────────────────
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
ALTER TABLE activity_recommends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on activity_recommends" ON activity_recommends;
CREATE POLICY "Allow all on activity_recommends" ON activity_recommends FOR ALL USING (true) WITH CHECK (true);

-- 活动推荐次数计数表 + 原子累加函数（原 014_activity_recommend_counts.sql）
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
ALTER TABLE activity_recommend_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on activity_recommend_counts" ON activity_recommend_counts;
CREATE POLICY "Allow all on activity_recommend_counts" ON activity_recommend_counts FOR ALL USING (true) WITH CHECK (true);

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


-- ── 5. 操作日志 / 导入记录表（原 add_sync_import_tables.sql 表部分）─────
CREATE TABLE IF NOT EXISTS public.operation_logs (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  operation_type VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id INTEGER,
  detail JSONB,
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.import_records (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  file_name VARCHAR(256) NOT NULL,
  file_type VARCHAR(32) NOT NULL,
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


-- ── 6. 管理员登录账号表 + 默认管理员 ────────────────────────────────────
-- ⚠️ 默认账号 admin / admin123（明文，仅用于首次登录），部署完成后请立即修改！
CREATE TABLE IF NOT EXISTS public.anchor_accounts (
  id SERIAL PRIMARY KEY,
  account_name VARCHAR(128) UNIQUE NOT NULL,
  account_password VARCHAR(256) NOT NULL,
  status VARCHAR(32) DEFAULT 'active',
  role VARCHAR(32) DEFAULT 'admin',
  corp_id VARCHAR(128) DEFAULT 'zhibotong',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_deleted CHAR(1) DEFAULT 'n'
);
CREATE INDEX IF NOT EXISTS idx_anchor_accounts_account_name ON public.anchor_accounts(account_name);
CREATE INDEX IF NOT EXISTS idx_anchor_accounts_status ON public.anchor_accounts(status);

INSERT INTO public.anchor_accounts (account_name, account_password, status, role)
VALUES ('admin', 'admin123', 'active', 'admin')
ON CONFLICT (account_name) DO UPDATE SET
  account_password = EXCLUDED.account_password,
  status = EXCLUDED.status,
  role = EXCLUDED.role,
  updated_at = NOW();


-- ════════════════════════════════════════════════════════════════════════
--  ✅ 数据库初始化完成。
--     接下来请去 Storage 建桶（见 docs/客户交接-部署手册.md 第 3 步）。
-- ════════════════════════════════════════════════════════════════════════
