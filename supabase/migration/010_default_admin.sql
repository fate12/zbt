-- 创建默认管理员账号
-- 邮箱: admin@zhibotong.com
-- 密码: admin123456
-- 角色: admin

-- 使用 Supabase Auth 内置函数创建用户
-- 注意：需要在 Supabase Dashboard 的 SQL Editor 中执行，或通过 API 创建

-- 方法 1：直接插入 auth.users（需要 SUPABASE_AUTH_KEY）
-- 这个方法在 SQL Editor 中可能不工作，建议使用方法 2

-- 方法 2：创建 profiles 表的触发器会自动创建
-- 先检查 profiles 表是否存在，如果不存在则创建

-- 创建 profiles 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  emp_id VARCHAR(128) UNIQUE,
  nick VARCHAR(128),
  avatar TEXT,
  role VARCHAR(32) DEFAULT 'member',
  corp_id VARCHAR(128),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()1
);

-- 创建默认管理员
-- 注意：由于 Supabase Auth 的限制，不能直接在 SQL 中创建 auth.users
-- 需要使用以下方法之一：

-- 方法 A：在 Supabase Dashboard → Authentication → Users 中手动创建
-- 邮箱: admin@zhibotong.com
-- 密码: admin123456
-- 然后手动设置 user_metadata: { role: 'admin', nick: '管理员' }

-- 方法 B：使用 Supabase Client 创建（推荐）
-- 在后端代码或初始化脚本中执行

-- 方法 C：使用 SQL 创建函数来注册用户
CREATE OR REPLACE FUNCTION public.create_admin_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- 创建用户
  user_id := gen_random_uuid();

  -- 插入 auth.users（需要特殊的权限）
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    user_id,
    'authenticated',
    'authenticated',
    'admin@zhibotong.com',
    crypt('admin123456', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"role": "admin", "nick": "管理员"}'::jsonb,
    NOW(),
    NOW()
  );

  -- 插入 profiles
  INSERT INTO public.profiles (
    id,
    emp_id,
    nick,
    role,
    corp_id
  ) VALUES (
    user_id,
    'admin001',
    '管理员',
    'admin',
    'zhibotong'
  );

  RETURN user_id;
END;
$$;

-- 执行创建管理员函数
-- SELECT public.create_admin_user();

-- 注意：如果上面的方法失败，请在 Supabase Dashboard 手动创建用户：
-- 1. 访问 https://supabase.com/dashboard/project/nyktrccpjcgdgjfbripq/auth/users
-- 2. 点击 "Add user" → "Create new user"
-- 3. 邮箱: admin@zhibotong.com
-- 4. 密码: admin123456
-- 5. 在 User Metadata 中添加: {"role": "admin", "nick": "管理员"}
-- 6. 点击 "Auto Confirm User"
