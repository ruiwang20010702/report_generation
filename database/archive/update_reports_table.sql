-- ============================================
-- 更新 reports 表结构
-- ============================================
-- 说明：添加学生姓名和分析数据字段，用于记录报告信息
-- ============================================

-- 1. 添加 student_name 字段（如果不存在）
ALTER TABLE reports ADD COLUMN IF NOT EXISTS student_name TEXT;

-- 2. 添加 analysis_data 字段（如果不存在）
ALTER TABLE reports ADD COLUMN IF NOT EXISTS analysis_data JSONB;

-- 3. 添加索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_reports_student_name ON reports(student_name);

-- 4. 添加注释
COMMENT ON COLUMN reports.student_name IS '学生姓名';
COMMENT ON COLUMN reports.analysis_data IS '完整的分析报告数据（JSON格式）';

-- ============================================
-- 验证表结构
-- ============================================
-- 执行以下查询确认字段已添加：
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'reports' 
-- ORDER BY ordinal_position;

