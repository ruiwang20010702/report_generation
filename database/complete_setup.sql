-- ============================================
-- 51Talk 英语学习分析系统 - 完整数据库初始化脚本
-- ============================================
-- 数据库信息：
-- Host: report-generation-project-pub.rwlb.rds.aliyuncs.com
-- Port: 5432
-- Database: postgres
-- User: report_write
-- Password: tJQeRmma-lixM%NR-V
--
-- 执行方式：
-- 方法1：使用 psql 命令行工具
--   psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" -f complete_setup.sql
--
-- 方法2：使用 DBeaver / pgAdmin 等图形工具
-- 方法3：使用阿里云 RDS 控制台
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

-- 创建更新时间触发器函数
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

-- 添加表和字段注释
COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.id IS '用户唯一标识符';
COMMENT ON COLUMN users.email IS '用户邮箱（唯一）';
COMMENT ON COLUMN users.password IS '用户密码（已加密）';
COMMENT ON COLUMN users.created_at IS '用户创建时间';
COMMENT ON COLUMN users.updated_at IS '用户更新时间';

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

-- 添加表和字段注释
COMMENT ON TABLE otps IS '邮箱验证码表';
COMMENT ON COLUMN otps.id IS 'OTP唯一标识符';
COMMENT ON COLUMN otps.email IS '接收验证码的邮箱';
COMMENT ON COLUMN otps.code IS '6位数验证码';
COMMENT ON COLUMN otps.expires_at IS '验证码过期时间';
COMMENT ON COLUMN otps.used IS '验证码是否已使用';
COMMENT ON COLUMN otps.used_at IS '验证码使用时间';
COMMENT ON COLUMN otps.created_at IS '验证码创建时间';

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

-- 启用行级安全（可选，根据需求启用）
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取报告
DROP POLICY IF EXISTS "Enable read access for all users" ON reports;
CREATE POLICY "Enable read access for all users" ON reports
  FOR SELECT USING (true);

-- 创建策略：允许所有人插入报告
DROP POLICY IF EXISTS "Enable insert access for all users" ON reports;
CREATE POLICY "Enable insert access for all users" ON reports
  FOR INSERT WITH CHECK (true);

-- 添加表和字段注释
COMMENT ON TABLE reports IS '51Talk 课程视频/音频分析报告';
COMMENT ON COLUMN reports.id IS '报告唯一标识符';
COMMENT ON COLUMN reports.user_id IS '用户ID（外键）';
COMMENT ON COLUMN reports.video_url IS '视频URL';
COMMENT ON COLUMN reports.transcript IS '完整转录文本';
COMMENT ON COLUMN reports.analysis IS '分析结果（旧版字段）';
COMMENT ON COLUMN reports.student_id IS '学生ID（唯一标识）';
COMMENT ON COLUMN reports.student_name IS '学生姓名';
COMMENT ON COLUMN reports.audio_duration IS '音频/视频时长（秒）';
COMMENT ON COLUMN reports.file_name IS '原始文件名';
COMMENT ON COLUMN reports.file_url IS '文件URL（可选）';
COMMENT ON COLUMN reports.analysis_data IS '完整的分析报告数据（JSON格式）';
COMMENT ON COLUMN reports.cost_breakdown IS '成本详细信息（JSON格式）：包含转录成本、AI分析成本、总成本等';
COMMENT ON COLUMN reports.created_at IS '报告创建时间';
COMMENT ON COLUMN reports.updated_at IS '报告更新时间';

-- ============================================
-- 4. 启用性能监控扩展（可选）
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- 5. 分析表统计信息（优化查询计划）
-- ============================================
ANALYZE users;
ANALYZE otps;
ANALYZE reports;

-- ============================================
-- 6. 创建监控视图（可选，用于性能监控）
-- ============================================

-- 查看最慢的查询（TOP 20）
CREATE OR REPLACE VIEW slow_queries AS
SELECT
    round(total_exec_time::numeric, 2) AS total_time_ms,
    calls,
    round(mean_exec_time::numeric, 2) AS mean_time_ms,
    round(max_exec_time::numeric, 2) AS max_time_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS percentage,
    query
FROM pg_stat_statements
WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
ORDER BY total_exec_time DESC
LIMIT 20;

-- 查看未使用的索引
CREATE OR REPLACE VIEW unused_indexes AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%'
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 查看表大小和膨胀情况
CREATE OR REPLACE VIEW table_bloat AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    round(100 * pg_total_relation_size(schemaname||'.'||tablename) / 
          NULLIF(pg_database_size(current_database()), 0), 2) AS percentage_of_db
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看当前活跃的连接和查询
CREATE OR REPLACE VIEW active_queries AS
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    EXTRACT(EPOCH FROM (now() - query_start)) AS query_duration_seconds,
    LEFT(query, 100) AS query_snippet
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
ORDER BY query_start;

-- ============================================
-- 验证表创建成功
-- ============================================
-- 执行以下查询确认所有表都已创建：
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 预期结果：
-- - otps (7 columns)
-- - reports (14 columns)
-- - users (5 columns)

-- ============================================
-- 查看 reports 表详细结构
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
-- 查看所有索引
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
-- 数据库初始化完成！
-- ============================================
-- 
-- 📊 成本追踪字段 (cost_breakdown) 结构示例：
-- {
--   "transcription": {
--     "service": "tingwu",
--     "video1Duration": 300,
--     "video2Duration": 350,
--     "totalMinutes": 11,
--     "unitPrice": 0.01,
--     "cost": 0.11,
--     "currency": "CNY"
--   },
--   "aiAnalysis": {
--     "provider": "GLM",
--     "model": "glm-4-plus",
--     "totalTokens": 12700,
--     "totalCost": 0.635,
--     "currency": "CNY"
--   },
--   "total": {
--     "cost": 0.745,
--     "currency": "CNY",
--     "breakdown": "转录: ¥0.11 + AI分析: ¥0.64"
--   }
-- }
--
-- 📈 常用查询示例：
--
-- 1. 查看最近10份报告：
--    SELECT id, student_name, created_at FROM reports ORDER BY created_at DESC LIMIT 10;
--
-- 2. 查看某个学生的所有报告：
--    SELECT * FROM reports WHERE student_name = '张三' ORDER BY created_at DESC;
--
-- 3. 统计总成本：
--    SELECT 
--      COUNT(*) as report_count,
--      SUM((cost_breakdown->'total'->>'cost')::numeric) as total_cost_cny
--    FROM reports WHERE cost_breakdown IS NOT NULL;
--
-- 4. 查看性能监控：
--    SELECT * FROM slow_queries;
--    SELECT * FROM unused_indexes;
--    SELECT * FROM table_bloat;
--
-- 🔧 定期维护命令（建议每周执行）：
--    VACUUM ANALYZE users;
--    VACUUM ANALYZE otps;
--    VACUUM ANALYZE reports;
--
-- 🧹 清理过期数据：
--    -- 删除 7 天前的过期验证码：
--    DELETE FROM otps WHERE expires_at < NOW() - INTERVAL '7 days';
--
--    -- 删除 30 天前的旧报告（根据业务需求调整）：
--    DELETE FROM reports WHERE created_at < NOW() - INTERVAL '30 days';
--
-- ============================================

