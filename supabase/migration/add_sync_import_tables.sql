-- Add external tracking columns to activities table
ALTER TABLE public.activities_bacad2ba_27a ADD COLUMN IF NOT EXISTS external_id VARCHAR(256);
ALTER TABLE public.activities_bacad2ba_27a ADD COLUMN IF NOT EXISTS external_source VARCHAR(64);

-- Create operation_logs table
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

-- Create import_records table
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
