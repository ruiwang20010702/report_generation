# 数据库优化指南

## 简介

本文档介绍数据库性能优化策略，包括索引优化、慢查询监控、查询性能分析等内容。

## 索引策略

### 已创建的索引

#### reports 表

```sql
-- 按创建时间查询（倒序，最新的在前）
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- 按学生名称查询
CREATE INDEX idx_reports_student_name ON reports(student_name);

-- 按学生ID查询
CREATE INDEX idx_reports_student_id ON reports(student_id);

-- 组合索引：学生名称 + 创建时间（最优化）
CREATE INDEX idx_reports_student_created ON reports(student_name, created_at DESC);

-- 组合索引：学生ID + 创建时间
CREATE INDEX idx_reports_studentid_created ON reports(student_id, created_at DESC) 
WHERE student_id IS NOT NULL;
```

**索引选择说明**：
- **单列索引**：适用于简单的单字段查询
- **组合索引**：适用于多字段组合查询，提供更好的性能
- **部分索引**（WHERE 子句）：只索引满足条件的行，减少索引大小

#### users 表

```sql
-- 邮箱登录查询
CREATE INDEX idx_users_email ON users(email);

-- 按创建时间排序
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

#### otps 表

```sql
-- OTP 验证查询
CREATE INDEX idx_otps_email_code ON otps(email, code);

-- 按创建时间清理过期数据
CREATE INDEX idx_otps_created_at ON otps(created_at DESC);

-- 过期时间检查
CREATE INDEX idx_otps_expires_at ON otps(expires_at);
```

### 索引优化原则

1. **为频繁查询的字段创建索引**
   - WHERE 子句中的字段
   - JOIN 条件字段
   - ORDER BY 字段

2. **组合索引顺序很重要**
   ```sql
   -- 好：经常一起查询的字段
   CREATE INDEX idx_reports_student_created 
   ON reports(student_name, created_at DESC);
   
   -- 可能不够优化：顺序不当
   CREATE INDEX idx_reports_created_student 
   ON reports(created_at DESC, student_name);
   ```

3. **避免过度索引**
   - 索引会占用存储空间
   - 每个索引都会降低写入性能
   - 只为实际使用的查询创建索引

4. **使用部分索引节省空间**
   ```sql
   -- 只索引有 student_id 的记录
   CREATE INDEX idx_reports_studentid_created 
   ON reports(student_id, created_at DESC) 
   WHERE student_id IS NOT NULL;
   ```

## 慢查询监控

### 启用慢查询日志

#### 临时启用（当前会话）

```sql
-- 设置慢查询阈值为 1 秒
SET log_min_duration_statement = 1000;

-- 启用查询统计
SET log_statement = 'all';
SET log_duration = 'on';
```

#### 永久启用（推荐生产环境）

编辑 `postgresql.conf`：

```ini
# 记录执行时间超过 1 秒的查询
log_min_duration_statement = 1000

# 记录所有 DDL 语句
log_statement = 'ddl'

# 记录查询耗时
log_duration = on

# 日志行前缀（包含时间、进程ID、用户、数据库）
log_line_prefix = '%t [%p] %u@%d '

# 日志目标
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
```

重启 PostgreSQL 使配置生效：

```bash
# Ubuntu/Debian
sudo systemctl restart postgresql

# Docker
docker restart your-postgres-container
```

### 查看慢查询日志

```bash
# 查看日志位置
psql -c "SHOW log_directory;"
psql -c "SHOW log_filename;"

# 查看最新日志
tail -f /var/log/postgresql/postgresql-2025-11-13_000000.log

# 搜索慢查询
grep "duration" /var/log/postgresql/postgresql-*.log | grep -v "< 1000"
```

### 使用 pg_stat_statements

`pg_stat_statements` 扩展可以追踪所有查询的执行统计。

#### 安装扩展

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

#### 配置 postgresql.conf

```ini
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
```

#### 查询慢查询统计

```sql
-- 查看最慢的 20 条查询
SELECT * FROM slow_queries;

-- 或直接查询
SELECT
    round(total_exec_time::numeric, 2) AS total_time_ms,
    calls,
    round(mean_exec_time::numeric, 2) AS mean_time_ms,
    round(max_exec_time::numeric, 2) AS max_time_ms,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

## 性能监控视图

运行 `database/optimize_indexes.sql` 创建以下监控视图：

### 1. slow_queries

查看最慢的查询（TOP 20）

```sql
SELECT * FROM slow_queries;
```

输出示例：

| total_time_ms | calls | mean_time_ms | max_time_ms | percentage | query |
|---------------|-------|--------------|-------------|------------|-------|
| 15234.56 | 1200 | 12.70 | 523.45 | 45.2% | SELECT * FROM reports WHERE... |

### 2. unused_indexes

查看未使用的索引（可考虑删除）

```sql
SELECT * FROM unused_indexes;
```

### 3. table_bloat

查看表膨胀情况

```sql
SELECT * FROM table_bloat;
```

### 4. active_queries

查看当前活跃的查询

```sql
SELECT * FROM active_queries;
```

## 查询优化技巧

### 1. 使用 EXPLAIN 分析查询计划

```sql
-- 查看查询计划
EXPLAIN SELECT * FROM reports WHERE student_name = 'John';

-- 查看详细执行统计
EXPLAIN ANALYZE SELECT * FROM reports WHERE student_name = 'John';
```

**关键指标**：
- **Seq Scan**：全表扫描（慢，应避免）
- **Index Scan**：索引扫描（快）
- **Bitmap Index Scan**：位图索引扫描（较快）
- **Cost**：估算的查询成本
- **Actual time**：实际执行时间

### 2. 优化 WHERE 子句

```sql
-- ❌ 不好：使用函数会导致索引失效
SELECT * FROM reports WHERE LOWER(student_name) = 'john';

-- ✅ 好：直接比较
SELECT * FROM reports WHERE student_name = 'John';

-- ✅ 更好：使用函数索引
CREATE INDEX idx_reports_student_lower ON reports(LOWER(student_name));
```

### 3. 避免 SELECT *

```sql
-- ❌ 不好：查询所有字段
SELECT * FROM reports WHERE student_name = 'John';

-- ✅ 好：只查询需要的字段
SELECT id, student_name, created_at FROM reports WHERE student_name = 'John';
```

### 4. 使用 LIMIT 限制结果集

```sql
-- 获取最新 10 条记录
SELECT * FROM reports 
ORDER BY created_at DESC 
LIMIT 10;
```

### 5. 批量操作优化

```sql
-- ❌ 不好：逐条插入
INSERT INTO reports VALUES (...);
INSERT INTO reports VALUES (...);
INSERT INTO reports VALUES (...);

-- ✅ 好：批量插入
INSERT INTO reports VALUES (...), (...), (...);
```

### 6. 使用 JSONB 索引

```sql
-- 为 JSONB 字段创建 GIN 索引
CREATE INDEX idx_reports_analysis_gin ON reports USING GIN (analysis_data);

-- 查询 JSON 字段
SELECT * FROM reports WHERE analysis_data @> '{"status": "completed"}';
```

## 维护任务

### 定期 VACUUM

清理死元组，回收空间：

```sql
-- 分析并清理
VACUUM ANALYZE reports;
VACUUM ANALYZE users;
VACUUM ANALYZE otps;

-- 完全清理（会锁表，谨慎使用）
VACUUM FULL reports;
```

### 自动 VACUUM

PostgreSQL 默认启用自动 VACUUM，配置在 `postgresql.conf`：

```ini
autovacuum = on
autovacuum_naptime = 1min
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
```

### 重建索引

```sql
-- 重建单个索引
REINDEX INDEX idx_reports_created_at;

-- 重建表的所有索引
REINDEX TABLE reports;

-- 重建数据库的所有索引
REINDEX DATABASE your_database;
```

### 更新统计信息

```sql
-- 更新单表统计
ANALYZE reports;

-- 更新所有表统计
ANALYZE;
```

## 连接池配置

### 应用层连接池

当前配置（`server/config/database.ts`）：

```typescript
const dbConfig = {
  // 最大连接数
  max: 20,
  
  // 空闲连接超时（30秒）
  idleTimeoutMillis: 30000,
  
  // 连接超时（2秒）
  connectionTimeoutMillis: 2000,
};
```

**优化建议**：
- **开发环境**：max = 5-10
- **生产环境**：max = 20-50（根据负载调整）
- **高并发**：max = 50-100

### 数据库层配置

编辑 `postgresql.conf`：

```ini
# 最大连接数（默认 100）
max_connections = 100

# 保留的超级用户连接数
superuser_reserved_connections = 3

# 共享缓冲区（建议为系统内存的 25%）
shared_buffers = 256MB

# 有效缓存大小（建议为系统内存的 50-75%）
effective_cache_size = 1GB

# 工作内存（每个查询操作）
work_mem = 4MB

# 维护工作内存（VACUUM、CREATE INDEX 等）
maintenance_work_mem = 64MB
```

## 监控指标

### 1. 数据库大小

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

### 2. 表大小

```sql
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) AS total_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) AS table_size,
    pg_size_pretty(pg_indexes_size(tablename::regclass)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

### 3. 连接数统计

```sql
SELECT
    count(*) AS total_connections,
    sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END) AS active,
    sum(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) AS idle
FROM pg_stat_activity;
```

### 4. 缓存命中率

```sql
SELECT
    sum(heap_blks_read) AS heap_read,
    sum(heap_blks_hit) AS heap_hit,
    round(sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2) AS cache_hit_ratio
FROM pg_statio_user_tables;
```

**目标**：缓存命中率应该 > 99%

### 5. 索引使用率

```sql
SELECT
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 故障排查

### Q1: 查询很慢？

**排查步骤**：
1. 使用 `EXPLAIN ANALYZE` 查看查询计划
2. 检查是否使用了索引（避免 Seq Scan）
3. 查看 `slow_queries` 视图
4. 检查数据库负载（`active_queries`）
5. 确认统计信息是否最新（运行 `ANALYZE`）

### Q2: 数据库连接数过多？

```sql
-- 查看当前连接
SELECT * FROM pg_stat_activity;

-- 终止空闲连接
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' 
  AND query_start < now() - interval '10 minutes';
```

### Q3: 表膨胀严重？

```sql
-- 查看膨胀情况
SELECT * FROM table_bloat;

-- 清理
VACUUM FULL reports;
```

### Q4: 索引未被使用？

```sql
-- 查看未使用的索引
SELECT * FROM unused_indexes;

-- 删除未使用的索引
DROP INDEX idx_unused_index;
```

## 性能测试

### 使用 pgbench

```bash
# 初始化测试数据
pgbench -i -s 50 your_database

# 运行性能测试（10个客户端，1000个事务）
pgbench -c 10 -t 1000 your_database
```

### 使用 Apache Bench

```bash
# 测试 API 性能
ab -n 1000 -c 10 http://localhost:3001/api/analysis/reports
```

## 最佳实践总结

1. ✅ **为频繁查询的字段创建索引**
2. ✅ **使用组合索引优化多字段查询**
3. ✅ **启用慢查询日志，定期分析**
4. ✅ **使用 EXPLAIN ANALYZE 分析查询计划**
5. ✅ **定期 VACUUM 和 ANALYZE**
6. ✅ **监控数据库指标（缓存命中率、连接数、表大小）**
7. ✅ **避免 SELECT *，只查询需要的字段**
8. ✅ **使用连接池管理数据库连接**
9. ✅ **删除未使用的索引**
10. ✅ **根据业务需求调整数据库配置**

## 相关文档

- [告警系统文档](./ALERT_SYSTEM.md)
- [生产环境检查清单](../deployment/PRODUCTION_CHECKLIST.md)
- [系统监控指南](../deployment/MONITORING.md)

## 下一步

数据库优化完成后，建议：
1. ✅ 实现优雅关闭机制
2. ✅ 增强健康检查端点
3. ✅ 添加性能指标收集
4. ✅ 编写集成测试

