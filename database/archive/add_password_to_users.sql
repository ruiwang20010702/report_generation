-- 添加密码字段到 users 表
-- 此脚本用于将现有的邮箱验证码登录系统扩展为支持密码登录

-- 添加 password 字段（允许为空，因为现有用户可能没有密码）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password TEXT;

-- 添加注释
COMMENT ON COLUMN users.password IS '用户密码（bcrypt 加密后的哈希值）';

