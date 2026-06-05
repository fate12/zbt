-- AI 知识库表
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
