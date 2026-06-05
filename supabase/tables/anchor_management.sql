CREATE TABLE public.anchors_bacad2ba_27a (
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

CREATE TABLE public.activities_bacad2ba_27a (
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
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.sync_logs_bacad2ba_27a (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(128),
  emp_id VARCHAR(128),
  doc_url TEXT,
  sync_type VARCHAR(32) DEFAULT 'manual',
  status VARCHAR(32) DEFAULT 'pending',
  record_count INTEGER DEFAULT 0,
  error_message TEXT,
  is_deleted CHAR(1) DEFAULT 'n',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.system_settings_bacad2ba_27a (
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
