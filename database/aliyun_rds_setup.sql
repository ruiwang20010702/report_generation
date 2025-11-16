-- ============================================
-- 阿里云 RDS PostgreSQL 初始化脚本（简化版）
-- 适用于 report_write 用户权限
-- ============================================
-- 数据库信息：
-- Host: report-generation-project-pub.rwlb.rds.aliyuncs.com
-- Port: 5432
-- Database: postgres
-- User: report_write
-- Password: tJQeRmma-lixM%NR-V
--
-- 执行方式：
-- psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" -f aliyun_rds_setup.sql
-- ============================================

-- ============================================
-- 1. 创建 users 表（用户信息）
-- ============================================
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

-- 为 users 表创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 创建更新时间触发器函数（简化版，不依赖扩展）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 users 表创建更新触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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
CREATE INDEX IF NOT EXISTS idx_otps_email_code ON otps(email, code);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps(created_at DESC);

-- ============================================
-- 3. 创建 reports 表（分析报告）
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT,
  transcript TEXT,
  analysis JSONB,
  student_id TEXT,
  student_name TEXT,
  audio_duration INTEGER,
  file_name TEXT,
  file_url TEXT,
  analysis_data JSONB,
  cost_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引（加速报告查询）
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_student_name ON reports(student_name);
CREATE INDEX IF NOT EXISTS idx_reports_cost_breakdown ON reports USING GIN (cost_breakdown);

-- 组合索引：优化常见查询模式
CREATE INDEX IF NOT EXISTS idx_reports_student_created ON reports(student_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_studentid_created ON reports(student_id, created_at DESC) WHERE student_id IS NOT NULL;

-- 为 reports 表创建更新触发器
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 验证表创建成功
-- ============================================
-- 执行以下查询确认所有表都已创建：
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 预期结果：
-- - otps (7 columns)
-- - reports (14 columns)
-- - users (5 columns)

-- ============================================
-- 5. 查看 reports 表详细结构
-- ============================================
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reports' 
ORDER BY ordinal_position;

-- ============================================
-- 6. 查看所有索引
-- ============================================
SELECT
    schemaname,
    tablename,
    indexname,
 indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 7. 测试数据插入
-- ============================================
-- 插入测试用户
INSERT INTO users (email) VALUES ('test@example.com') 
ON CONFLICT (email) DO NOTHING 
RETURNING *;

-- 插入测试报告
INSERT INTO reports (student_name, audio_duration, transcript, analysis_data, file_name)
VALUES ('测试学生', 300, '这是一段测试转录文本', '{"test": true}'::jsonb, 'test.mp3')
RETURNING id, student_name, created_at;

-- 查询测试数据
SELECT * FROM users LIMIT 5;
SELECT * FROM reports LIMIT 5;

-- ============================================
-- 8. 常用查询示例
-- ============================================

-- 查看最近的报告
SELECT 
    id,
    student_name,
    audio_duration,
    created_at
FROM reports 
ORDER BY created_at DESC 
LIMIT 10;

-- 查看某个学生的所有报告
SELECT 
    id,
    created_at,
    audio_duration,
    file_name
FROM reports 
WHERE student_name = '张三' 
ORDER BY created_at DESC;

-- 统计报告总数
SELECT 
    COUNT(*) as total_reports,
    COUNT(DISTINCT student_name) as total_students
FROM reports;

-- ============================================
-- 数据库初始化完成！
-- ============================================
