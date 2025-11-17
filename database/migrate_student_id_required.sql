-- ============================================
-- 数据库迁移：student_id 字段改为必填
-- ============================================
-- 说明：将 student_id 字段从可选改为必填（添加 NOT NULL 约束）
-- 作者：系统管理员
-- 日期：2025-11-17
-- ============================================

-- 开始事务
BEGIN;

-- 1. 检查是否有空值（如果有，需要先处理）
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM reports
  WHERE student_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION '❌ 发现 % 条记录的 student_id 为空，请先处理这些记录后再执行迁移', null_count;
  ELSE
    RAISE NOTICE '✅ 所有记录的 student_id 都不为空，可以安全添加 NOT NULL 约束';
  END IF;
END $$;

-- 2. 添加 NOT NULL 约束
ALTER TABLE reports 
ALTER COLUMN student_id SET NOT NULL;

-- 3. 更新字段注释
COMMENT ON COLUMN reports.student_id IS '学生ID（必填）';

-- 4. 验证约束已添加
DO $$
DECLARE
  is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO is_nullable
  FROM information_schema.columns
  WHERE table_name = 'reports' 
    AND column_name = 'student_id';
  
  IF is_nullable = 'NO' THEN
    RAISE NOTICE '✅ student_id 字段已成功设置为必填（NOT NULL）';
  ELSE
    RAISE EXCEPTION '❌ student_id 字段设置 NOT NULL 失败';
  END IF;
END $$;

-- 提交事务
COMMIT;

-- ============================================
-- 迁移完成
-- ============================================

-- 验证结果
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ student_id 字段迁移完成'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo '字段约束信息：'
SELECT 
  column_name AS "字段名",
  data_type AS "数据类型",
  is_nullable AS "可为空",
  column_default AS "默认值"
FROM information_schema.columns
WHERE table_name = 'reports' 
  AND column_name = 'student_id';

