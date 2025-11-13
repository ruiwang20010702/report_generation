-- ============================================
-- 数据库索引优化脚本
-- ============================================
-- 用于提升查询性能和监控慢查询

-- ============================================
-- 1. 创建必要的索引
-- ============================================

-- reports 表索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_student_name ON reports(student_name);
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON reports(student_id);

-- 组合索引：学生名称 + 创建时间（用于按学生查询最新报告）
CREATE INDEX IF NOT EXISTS idx_reports_student_created ON reports(student_name, created_at DESC);

-- 组合索引：学生ID + 创建时间
CREATE INDEX IF NOT EXISTS idx_reports_studentid_created ON reports(student_id, created_at DESC) WHERE student_id IS NOT NULL;

-- users 表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- otps 表索引
CREATE INDEX IF NOT EXISTS idx_otps_email_code ON otps(email, code);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- ============================================
-- 2. 分析表统计信息
-- ============================================
-- PostgreSQL 使用统计信息来优化查询计划

ANALYZE reports;
ANALYZE users;
ANALYZE otps;

-- ============================================
-- 3. 启用慢查询日志
-- ============================================
-- 记录执行时间超过阈值的查询

-- 设置慢查询阈值为 1000ms（1秒）
-- 注意：此设置仅对当前会话有效
-- 要永久生效，需要在 postgresql.conf 中配置
SET log_min_duration_statement = 1000;

-- 启用查询统计信息
SET log_statement = 'all';
SET log_duration = 'on';
SET log_line_prefix = '%t [%p] %u@%d ';

-- ============================================
-- 4. 查看索引使用情况
-- ============================================
-- 用于检查哪些索引未被使用，可以考虑删除

-- 查看索引使用统计
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- ============================================
-- 5. 查看表大小和膨胀情况
-- ============================================

-- 查看各表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 6. 清理和维护
-- ============================================

-- VACUUM：清理死元组，回收空间
VACUUM ANALYZE reports;
VACUUM ANALYZE users;
VACUUM ANALYZE otps;

-- ============================================
-- 7. 创建监控视图
-- ============================================

-- 慢查询监控视图（需要 pg_stat_statements 扩展）
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

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

-- 查看表膨胀情况
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

-- ============================================
-- 8. 性能监控查询
-- ============================================

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
-- 9. 索引健康检查
-- ============================================

-- 检查缺失的索引（基于外键）
SELECT
    c.conrelid::regclass AS "table",
    string_agg(a.attname, ', ') AS columns,
    pg_size_pretty(pg_relation_size(c.conrelid)) AS table_size
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = c.conrelid
        AND i.indkey::int[] @> c.conkey::int[]
  )
GROUP BY c.conrelid, c.conname, c.conkey
ORDER BY pg_relation_size(c.conrelid) DESC;

-- ============================================
-- 使用说明
-- ============================================
/*
1. 首次运行：
   psql -U your_user -d your_database -f optimize_indexes.sql

2. 定期维护（建议每周执行）：
   - VACUUM ANALYZE（清理和更新统计）
   - 查看慢查询（slow_queries 视图）
   - 检查未使用索引（unused_indexes 视图）

3. 监控查询：
   SELECT * FROM slow_queries;
   SELECT * FROM unused_indexes;
   SELECT * FROM table_bloat;
   SELECT * FROM active_queries;

4. 慢查询日志位置：
   - 查看配置：SHOW log_directory;
   - 查看文件：SHOW log_filename;
   - 通常位于：/var/log/postgresql/ 或数据目录下的 pg_log/

5. 永久启用慢查询日志：
   在 postgresql.conf 中添加：
   log_min_duration_statement = 1000
   log_statement = 'all'
   log_duration = on
   然后重启 PostgreSQL 服务
*/

