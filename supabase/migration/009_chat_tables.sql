-- 聊天会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corp_id text DEFAULT '',
  emp_id text NOT NULL DEFAULT 'visitor',
  title text NOT NULL DEFAULT '新对话',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  sources jsonb,
  created_at timestamptz DEFAULT now()
);

-- 知识库文档表
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_chat_sessions_emp_id ON chat_sessions(emp_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_created ON knowledge_documents(created_at DESC);

-- RLS 策略（允许所有访问，认证由应用层控制）
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_sessions" ON chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on knowledge_documents" ON knowledge_documents FOR ALL USING (true) WITH CHECK (true);
