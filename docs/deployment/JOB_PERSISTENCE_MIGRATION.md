# 任务持久化功能迁移指南

## 📋 概述

本次更新为分析任务队列添加了数据库持久化功能，解决了服务器重启导致任务丢失的问题。

**主要改进：**
- ✅ 所有任务状态持久化到 PostgreSQL 数据库
- ✅ 服务器重启后自动恢复未完成的任务（默认恢复 2 小时内的任务）
- ✅ 支持降级到内存模式（数据库不可用时）
- ✅ 生产环境就绪

## 🚀 部署步骤

### 方法 1：新项目部署（推荐）

如果这是全新部署，直接使用更新后的 `schema.sql`：

```bash
# 执行完整的 schema.sql（包含所有表，包括新的 analysis_jobs 表）
psql $DATABASE_URL -f database/schema.sql
```

### 方法 2：现有项目迁移

如果数据库已经存在，需要添加 `analysis_jobs` 表：

```bash
# 执行迁移脚本
psql $DATABASE_URL -f database/migrations/add_analysis_jobs_table.sql
```

或者在数据库控制台中直接执行迁移脚本的内容。

## ✅ 验证部署

### 1. 检查表是否创建成功

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'analysis_jobs';
```

**预期结果：** 应该返回一行，表名为 `analysis_jobs`

### 2. 检查表结构

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'analysis_jobs'
ORDER BY ordinal_position;
```

**预期结果：** 应该看到以下字段：
- `id` (uuid)
- `job_id` (text)
- `status` (text)
- `request_data` (jsonb)
- `use_mock` (boolean)
- `result_data` (jsonb)
- `error_data` (jsonb)
- `submitted_at` (timestamp with time zone)
- `started_at` (timestamp with time zone)
- `completed_at` (timestamp with time zone)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### 3. 检查索引

```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'analysis_jobs';
```

**预期结果：** 应该看到以下索引：
- `analysis_jobs_pkey` (主键)
- `idx_analysis_jobs_job_id` (唯一索引)
- `idx_analysis_jobs_status`
- `idx_analysis_jobs_submitted_at`
- `idx_analysis_jobs_created_at`
- `idx_analysis_jobs_pending` (部分索引)

## 🔍 功能验证

### 1. 启动服务器

```bash
npm start
```

### 2. 检查启动日志

服务器启动时应该看到：

```
✅ 数据库连接成功: ...
📊 [AnalysisJobQueue] {"event":"queue_initialized",...}
📊 [AnalysisJobQueue] {"event":"persistence_enabled",...}
📊 [AnalysisJobQueue] {"event":"recovery_completed","recovered":0,"timeWindowHours":2}
ℹ️  No pending jobs to recover (within 2 hours)
```

如果有未完成的任务，会看到：

```
📊 [AnalysisJobQueue] {"event":"recovery_started","pending":N,"timeWindowHours":2}
📊 [AnalysisJobQueue] {"event":"job_recovered","jobId":"...",...}
📊 [AnalysisJobQueue] {"event":"recovery_completed","recovered":N,"totalPending":N,"timeWindowHours":2}
ℹ️  Recovered N pending jobs from database (within 2 hours)
```

### 3. 测试任务持久化

1. **提交一个分析任务**
   ```bash
   curl -X POST http://localhost:3001/api/analysis \
     -H "Content-Type: application/json" \
     -d '{"video1":"...","video2":"...","studentName":"Test",...}'
   ```

2. **检查数据库**
   ```sql
   SELECT job_id, status, submitted_at 
   FROM analysis_jobs 
   ORDER BY submitted_at DESC 
   LIMIT 5;
   ```
   应该能看到刚提交的任务。

3. **重启服务器**
   ```bash
   # 停止服务器（Ctrl+C）
   # 重新启动
   npm start
   ```

4. **验证任务恢复**
   查看启动日志，应该看到任务被恢复并继续处理。

## 📊 数据库表说明

### analysis_jobs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 数据库主键 |
| `job_id` | TEXT | 任务唯一标识符（与内存中的 job.id 对应） |
| `status` | TEXT | 任务状态：queued, processing, completed, failed |
| `request_data` | JSONB | 任务请求数据（VideoAnalysisRequest） |
| `use_mock` | BOOLEAN | 是否使用模拟数据 |
| `result_data` | JSONB | 任务结果（VideoAnalysisResponse，仅完成时） |
| `error_data` | JSONB | 错误信息（仅失败时） |
| `submitted_at` | TIMESTAMP | 任务提交时间 |
| `started_at` | TIMESTAMP | 任务开始处理时间 |
| `completed_at` | TIMESTAMP | 任务完成时间 |
| `created_at` | TIMESTAMP | 记录创建时间 |
| `updated_at` | TIMESTAMP | 记录更新时间（自动更新） |

## ⚙️ 环境变量配置

任务恢复功能支持以下环境变量：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `DISABLE_ANALYSIS_JOB_RECOVERY` | `false` | 设为 `true` 可完全禁用任务恢复功能 |
| `JOB_RECOVERY_TIME_WINDOW_HOURS` | `2` | 恢复多少小时内的未完成任务（避免恢复太旧的任务） |

**示例配置：**

```bash
# .env 文件

# 只恢复最近 4 小时内的任务
JOB_RECOVERY_TIME_WINDOW_HOURS=4

# 完全禁用任务恢复（不推荐）
# DISABLE_ANALYSIS_JOB_RECOVERY=true
```

**使用场景：**

- **默认（2小时）：** 适合大多数场景，避免恢复太旧的任务
- **较长时间窗口（4-8小时）：** 适合任务处理时间较长的场景
- **较短时间窗口（1小时）：** 适合快速迭代开发环境
- **禁用恢复：** 仅用于测试或调试，不推荐生产环境使用

## 🔧 故障排查

### 问题 1：表创建失败

**错误信息：** `relation "analysis_jobs" already exists`

**解决方案：**
```sql
-- 检查表是否存在
SELECT * FROM information_schema.tables WHERE table_name = 'analysis_jobs';

-- 如果存在但结构不对，可以删除重建（⚠️ 会丢失数据）
DROP TABLE IF EXISTS analysis_jobs CASCADE;
-- 然后重新执行迁移脚本
```

### 问题 2：持久化未启用

**症状：** 启动日志显示 `persistence_disabled`

**可能原因：**
- 数据库连接失败
- 环境变量未配置

**解决方案：**
1. 检查数据库连接配置
2. 确认 `DATABASE_URL` 或 `DB_HOST` 等环境变量已设置
3. 测试数据库连接：`npm run test:db`

### 问题 3：任务未恢复

**症状：** 重启后任务丢失

**检查步骤：**
1. 确认数据库中有未完成的任务：
   ```sql
   SELECT COUNT(*) FROM analysis_jobs WHERE status IN ('queued', 'processing');
   ```

2. 检查启动日志，确认恢复过程是否执行

3. 如果数据库中有任务但未恢复，检查：
   - 数据库连接是否成功
   - `recoverPendingJobs()` 是否被调用
   - 是否有错误日志

## 📝 注意事项

1. **数据清理：** 已完成和失败的任务会在内存中保留 24 小时（可通过 `ANALYSIS_JOB_TTL_MS` 环境变量调整），但数据库中的记录会永久保留。可以定期清理旧记录：

   ```sql
   -- 删除 30 天前已完成的任务
   DELETE FROM analysis_jobs 
   WHERE status IN ('completed', 'failed') 
     AND completed_at < NOW() - INTERVAL '30 days';
   ```

2. **性能考虑：** 
   - 数据库操作都是异步的，不会阻塞任务处理
   - 如果数据库不可用，系统会自动降级到内存模式
   - 建议定期清理旧记录以保持表大小合理

3. **监控建议：**
   - 监控 `analysis_jobs` 表的大小
   - 监控未完成任务的数量
   - 监控数据库连接状态

## 🎉 完成

部署完成后，系统将具备以下能力：

- ✅ 任务状态持久化
- ✅ 服务器重启后任务恢复
- ✅ 生产环境就绪
- ✅ 降级保护（数据库不可用时仍可工作）

如有问题，请查看日志或联系开发团队。

