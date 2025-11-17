-- ============================================================
-- 数据库字段命名规范迁移脚本
-- ============================================================
-- 说明：此脚本用于将旧字段名迁移到符合命名规范的新字段名
-- 执行前：请先备份数据库！
-- 适用版本：PostgreSQL 14+
-- ============================================================

-- 检查当前数据库版本
SELECT version();

-- ============================================================
-- 阶段 1：检查当前字段（迁移前）
-- ============================================================

\echo '============================================================'
\echo '📊 迁移前字段检查'
\echo '============================================================'

-- 检查 users 表字段
\echo ''
\echo '👤 users 表当前字段：'
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 检查 reports 表字段
\echo ''
\echo '📄 reports 表当前字段：'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reports' 
ORDER BY ordinal_position;

-- 检查索引
\echo ''
\echo '🔍 当前索引：'
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'reports')
ORDER BY tablename, indexname;

-- ============================================================
-- 阶段 2：开始迁移（事务中执行）
-- ============================================================

\echo ''
\echo '============================================================'
\echo '🔄 开始字段名迁移...'
\echo '============================================================'

BEGIN;

\echo ''
\echo '1️⃣ 迁移 users 表...'

-- 检查旧字段是否存在
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        -- 重命名字段
        ALTER TABLE users RENAME COLUMN password_hash TO passwd_hash;
        RAISE NOTICE '✓ users.password_hash → users.passwd_hash';
    ELSE
        RAISE NOTICE '⊗ users.password_hash 不存在（可能已迁移）';
    END IF;
END $$;

-- 删除旧的非唯一索引
DROP INDEX IF EXISTS idx_users_email;
RAISE NOTICE '✓ 删除旧索引 idx_users_email';

-- 创建新的唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users(email);
RAISE NOTICE '✓ 创建唯一索引 uniq_users_email';

\echo ''
\echo '2️⃣ 迁移 reports 表...'

-- 检查并迁移 audio_duration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'audio_duration'
    ) THEN
        ALTER TABLE reports RENAME COLUMN audio_duration TO audio_dur;
        RAISE NOTICE '✓ reports.audio_duration → reports.audio_dur';
    ELSE
        RAISE NOTICE '⊗ reports.audio_duration 不存在（可能已迁移）';
    END IF;
END $$;

-- 检查并迁移 cost_breakdown
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'cost_breakdown'
    ) THEN
        ALTER TABLE reports RENAME COLUMN cost_breakdown TO cost_detail;
        RAISE NOTICE '✓ reports.cost_breakdown → reports.cost_detail';
    ELSE
        RAISE NOTICE '⊗ reports.cost_breakdown 不存在（可能已迁移）';
    END IF;
END $$;

-- 删除旧索引
DROP INDEX IF EXISTS idx_reports_cost_breakdown;
RAISE NOTICE '✓ 删除旧索引 idx_reports_cost_breakdown';

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_reports_cost_detail ON reports USING GIN(cost_detail);
RAISE NOTICE '✓ 创建新索引 idx_reports_cost_detail';

-- 提交事务
COMMIT;

\echo ''
\echo '✅ 迁移完成！'

-- ============================================================
-- 阶段 3：验证迁移结果
-- ============================================================

\echo ''
\echo '============================================================'
\echo '✅ 迁移后验证'
\echo '============================================================'

-- 验证 users 表
\echo ''
\echo '👤 users 表字段（迁移后）：'
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 验证 reports 表
\echo ''
\echo '📄 reports 表字段（迁移后）：'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reports'
  AND column_name IN ('audio_dur', 'cost_detail', 'audio_duration', 'cost_breakdown')
ORDER BY ordinal_position;

-- 验证索引
\echo ''
\echo '🔍 索引验证：'
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'reports')
  AND (indexname LIKE 'uniq_%' OR indexname LIKE '%cost_detail%')
ORDER BY tablename, indexname;

-- ============================================================
-- 阶段 4：数据完整性检查
-- ============================================================

\echo ''
\echo '============================================================'
\echo '🔍 数据完整性检查'
\echo '============================================================'

-- 检查 users 表记录数
\echo ''
\echo '👤 users 表记录数：'
SELECT COUNT(*) AS user_count FROM users;

-- 检查 reports 表记录数
\echo ''
\echo '📄 reports 表记录数：'
SELECT COUNT(*) AS report_count FROM reports;

-- 检查 passwd_hash 是否有数据
\echo ''
\echo '🔐 passwd_hash 字段数据统计：'
SELECT 
    COUNT(*) AS total_users,
    COUNT(passwd_hash) AS users_with_password,
    COUNT(*) - COUNT(passwd_hash) AS users_without_password
FROM users;

-- 检查 cost_detail 字段
\echo ''
\echo '💰 cost_detail 字段数据统计：'
SELECT 
    COUNT(*) AS total_reports,
    COUNT(cost_detail) AS reports_with_cost,
    COUNT(*) - COUNT(cost_detail) AS reports_without_cost
FROM reports;

\echo ''
\echo '============================================================'
\echo '✅ 迁移验证完成！'
\echo '============================================================'
\echo ''
\echo '📝 后续步骤：'
\echo '  1. 检查上述输出，确认所有字段和索引已正确迁移'
\echo '  2. 更新应用代码中的字段引用（详见 FIELD_NAMING_CHANGES.md）'
\echo '  3. 更新 API 文档'
\echo '  4. 运行应用测试'
\echo ''
\echo '⚠️  如果迁移失败，可以使用备份恢复数据库'
\echo ''

-- ============================================================
-- 回滚脚本（如果需要）
-- ============================================================

-- 取消下面的注释可以回滚迁移（仅在出错时使用）

-- BEGIN;
-- 
-- -- 回滚 users 表
-- ALTER TABLE users RENAME COLUMN passwd_hash TO password_hash;
-- DROP INDEX IF EXISTS uniq_users_email;
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- 
-- -- 回滚 reports 表
-- ALTER TABLE reports RENAME COLUMN audio_dur TO audio_duration;
-- ALTER TABLE reports RENAME COLUMN cost_detail TO cost_breakdown;
-- DROP INDEX IF EXISTS idx_reports_cost_detail;
-- CREATE INDEX IF NOT EXISTS idx_reports_cost_breakdown ON reports USING GIN(cost_breakdown);
-- 
-- COMMIT;
-- 
-- SELECT '✅ 回滚完成' AS status;

