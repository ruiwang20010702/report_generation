-- ============================================
-- 51Talk 英语学习分析系统 - 数据库初始化脚本
-- ============================================
-- 说明：在 Zeabur PostgreSQL Web Console 中执行此脚本
-- 执行顺序：users → otps → reports
-- ============================================

-- 1. 创建 users 表（用户信息）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  passwd_hash VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 为 email 字段创建唯一索引（加速查询 + 保证唯一性）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users(email);

-- 插入测试数据（可选，生产环境可删除）
-- INSERT INTO users (email) VALUES ('test@example.com') ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 2. 创建 otps 表（邮箱验证码）
-- ============================================
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引（加速验证码查询）
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(code);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- ============================================
-- 3. 创建 reports 表（分析报告）
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT,
  transcript TEXT,
  analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引（加速报告查询）
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- ============================================
-- 验证表创建成功
-- ============================================
-- 执行以下查询确认所有表都已创建：
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- 
-- 预期结果：
-- - otps
-- - reports
-- - users

-- ============================================
-- 清理过期数据（可选，定期执行）
-- ============================================
-- 删除 7 天前的过期验证码：
-- DELETE FROM otps WHERE expires_at < NOW() - INTERVAL '7 days';

-- 删除 30 天前的旧报告（根据业务需求调整）：
-- DELETE FROM reports WHERE created_at < NOW() - INTERVAL '30 days';
