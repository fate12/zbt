-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 知识切片表
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

-- 向量相似度搜索索引 (HNSW, cosine)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON public.knowledge_chunks_bacad2ba_27a
  USING hnsw (embedding vector_cosine_ops);

-- 按知识条目查询的索引
CREATE INDEX IF NOT EXISTS idx_chunks_knowledge_id ON public.knowledge_chunks_bacad2ba_27a(knowledge_id);
