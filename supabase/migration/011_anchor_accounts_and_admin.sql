-- 创建账号表和管理员账号

-- 创建 anchor_accounts 表（如果不存在）
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

-- 插入默认管理员账号
-- 账号: admin
-- 密码: admin123
INSERT INTO public.anchor_accounts (
  account_name,
  account_password,
  status,
  role
) VALUES (
  'admin',
  'admin123',  -- 生产环境应该使用哈希密码
  'active',
  'admin'
) ON CONFLICT (account_name) DO UPDATE SET
  account_password = EXCLUDED.account_password,
  status = EXCLUDED.status,
  role = EXCLUDED.role,
  updated_at = NOW();

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anchor_accounts_account_name ON public.anchor_accounts(account_name);
CREATE INDEX IF NOT EXISTS idx_anchor_accounts_status ON public.anchor_accounts(status);
