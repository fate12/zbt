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

CREATE INDEX IF NOT EXISTS idx_rag_sessions_user ON public.rag_sessions_bacad2ba_27a (user_id);
CREATE INDEX IF NOT EXISTS idx_rag_messages_session ON public.rag_messages_bacad2ba_27a (session_id);
CREATE INDEX IF NOT EXISTS idx_rag_messages_created ON public.rag_messages_bacad2ba_27a (created_at);
