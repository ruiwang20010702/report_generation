-- =====================================================
-- PostgreSQL 17 完整建表语句
-- 报告生成系统数据库架构
-- =====================================================

-- 创建扩展（如果不存在）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 用户表 (users)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    passwd_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 用户表索引
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 用户表字段注释
COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.id IS '用户唯一标识符';
COMMENT ON COLUMN users.email IS '用户邮箱（唯一）';
COMMENT ON COLUMN users.passwd_hash IS '密码哈希值';
COMMENT ON COLUMN users.created_at IS '创建时间';
COMMENT ON COLUMN users.updated_at IS '更新时间';
COMMENT ON COLUMN users.last_login IS '最后登录时间';

-- =====================================================
-- OTP验证码表 (otps)
-- =====================================================
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE
);

-- OTP表索引
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps(created_at);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- OTP表字段注释
COMMENT ON TABLE otps IS 'OTP验证码表';
COMMENT ON COLUMN otps.id IS 'OTP唯一标识符';
COMMENT ON COLUMN otps.email IS '接收验证码的邮箱';
COMMENT ON COLUMN otps.code IS '验证码';
COMMENT ON COLUMN otps.created_at IS '创建时间';
COMMENT ON COLUMN otps.expires_at IS '过期时间';
COMMENT ON COLUMN otps.used IS '是否已使用';
COMMENT ON COLUMN otps.used_at IS '使用时间';

-- =====================================================
-- 报告表 (reports)
-- =====================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_email TEXT,
    student_id TEXT NOT NULL,
    student_name TEXT,
    file_name TEXT,
    file_url TEXT,
    video_url TEXT,
    audio_dur INTEGER,
    transcript TEXT,
    analysis JSONB,
    analysis_data JSONB,
    cost_detail JSONB,
    total_cost DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 报告表索引
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_email ON reports(user_email);
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_student_name ON reports(student_name);
CREATE INDEX IF NOT EXISTS idx_reports_file_name ON reports(file_name);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_total_cost ON reports(total_cost);
CREATE INDEX IF NOT EXISTS idx_reports_cost_detail ON reports USING GIN(cost_detail);

-- 报告表字段注释
COMMENT ON TABLE reports IS '报告表';
COMMENT ON COLUMN reports.id IS '报告唯一标识符';
COMMENT ON COLUMN reports.user_id IS '用户ID（外键关联users表）';
COMMENT ON COLUMN reports.user_email IS '用户邮箱';
COMMENT ON COLUMN reports.student_id IS '学生ID（必填）';
COMMENT ON COLUMN reports.student_name IS '学生姓名';
COMMENT ON COLUMN reports.file_name IS '上传文件名';
COMMENT ON COLUMN reports.file_url IS '文件存储URL';
COMMENT ON COLUMN reports.video_url IS '视频URL';
COMMENT ON COLUMN reports.audio_dur IS '音频时长（秒）';
COMMENT ON COLUMN reports.transcript IS '转录文本';
COMMENT ON COLUMN reports.analysis IS '分析数据（旧字段）';
COMMENT ON COLUMN reports.analysis_data IS '完整报告分析数据（JSON格式）';
COMMENT ON COLUMN reports.cost_detail IS 'API调用成本明细（JSON格式）';
COMMENT ON COLUMN reports.total_cost IS '总成本（美元）';
COMMENT ON COLUMN reports.created_at IS '创建时间';
COMMENT ON COLUMN reports.updated_at IS '更新时间';

-- =====================================================
-- 自动更新 updated_at 触发器
-- =====================================================

-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 users 表添加触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 reports 表添加触发器
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 分析任务队列表 (analysis_jobs)
-- 用于持久化任务状态，支持服务器重启后恢复
-- =====================================================
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL UNIQUE,  -- 任务唯一标识符（与内存中的 job.id 对应）
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    request_data JSONB NOT NULL,  -- VideoAnalysisRequest 的完整数据
    use_mock BOOLEAN NOT NULL DEFAULT FALSE,
    result_data JSONB,  -- VideoAnalysisResponse（任务完成时存储）
    error_data JSONB,   -- 错误信息（任务失败时存储）
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 分析任务表索引
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_job_id ON analysis_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_submitted_at ON analysis_jobs(submitted_at);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at);

-- 用于查询未完成任务（启动时恢复）
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_pending ON analysis_jobs(status, submitted_at) 
    WHERE status IN ('queued', 'processing');

-- 分析任务表字段注释
COMMENT ON TABLE analysis_jobs IS '分析任务队列表（持久化存储）';
COMMENT ON COLUMN analysis_jobs.id IS '数据库主键（UUID）';
COMMENT ON COLUMN analysis_jobs.job_id IS '任务唯一标识符（与内存中的 job.id 对应）';
COMMENT ON COLUMN analysis_jobs.status IS '任务状态：queued(排队中), processing(处理中), completed(已完成), failed(失败)';
COMMENT ON COLUMN analysis_jobs.request_data IS '任务请求数据（VideoAnalysisRequest 的 JSON 格式）';
COMMENT ON COLUMN analysis_jobs.use_mock IS '是否使用模拟数据';
COMMENT ON COLUMN analysis_jobs.result_data IS '任务结果数据（VideoAnalysisResponse 的 JSON 格式，仅完成时存储）';
COMMENT ON COLUMN analysis_jobs.error_data IS '错误信息（任务失败时存储）';
COMMENT ON COLUMN analysis_jobs.submitted_at IS '任务提交时间';
COMMENT ON COLUMN analysis_jobs.started_at IS '任务开始处理时间';
COMMENT ON COLUMN analysis_jobs.completed_at IS '任务完成时间';
COMMENT ON COLUMN analysis_jobs.created_at IS '记录创建时间';
COMMENT ON COLUMN analysis_jobs.updated_at IS '记录更新时间';

-- 为 analysis_jobs 表添加自动更新 updated_at 触发器
DROP TRIGGER IF EXISTS update_analysis_jobs_updated_at ON analysis_jobs;
CREATE TRIGGER update_analysis_jobs_updated_at
    BEFORE UPDATE ON analysis_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 结束
-- =====================================================

