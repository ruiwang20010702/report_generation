-- ============================================
-- 添加学生ID字段到 reports 表
-- ============================================
-- 说明：添加 student_id 字段，用于存储学生的唯一标识
-- ============================================

-- 1. 添加 student_id 字段（如果不存在）
ALTER TABLE reports ADD COLUMN IF NOT EXISTS student_id TEXT;

-- 2. 添加索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON reports(student_id);

-- 3. 添加注释
COMMENT ON COLUMN reports.student_id IS '学生ID（唯一标识）';

-- ============================================
-- 验证表结构
-- ============================================
-- 执行以下查询确认字段已添加：
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'reports' 
-- ORDER BY ordinal_position;

