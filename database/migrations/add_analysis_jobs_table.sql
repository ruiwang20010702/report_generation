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

