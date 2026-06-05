-- Create sync_logs table
CREATE TABLE IF NOT EXISTS public.sync_logs_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  doc_url TEXT NOT NULL,
  sync_type VARCHAR(32) DEFAULT 'manual',
  status VARCHAR(32) DEFAULT 'pending',
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_corp_id ON public.sync_logs_bacad2ba_27a(corp_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs_bacad2ba_27a(status);
