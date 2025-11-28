-- =====================================================
-- 迁移脚本：删除 reports 表的 analysis 旧字段
-- 
-- 背景：
--   analysis 和 analysis_data 两个字段存储了相同的内容
--   analysis 是旧字段，analysis_data 是新字段
--   现在统一使用 analysis_data，删除冗余的 analysis 字段
--
-- 执行时间：2025-11-28
-- =====================================================

-- 删除 analysis 列
ALTER TABLE reports DROP COLUMN IF EXISTS analysis;

-- 验证删除成功
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'reports' 
        AND column_name = 'analysis'
    ) THEN
        RAISE EXCEPTION 'analysis 列删除失败';
    ELSE
        RAISE NOTICE '✅ analysis 列已成功删除';
    END IF;
END $$;

