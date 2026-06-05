-- 查看现有表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'anchor_accounts'
ORDER BY ordinal_position;
