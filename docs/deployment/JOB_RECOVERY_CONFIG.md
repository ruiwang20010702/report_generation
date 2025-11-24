# 任务恢复时间窗口配置指南

## 📋 概述

从本版本开始，服务器重启时只会恢复**指定时间窗口内**的未完成任务，而不是恢复所有历史任务。这样可以避免恢复太旧的、可能已经失效的任务。

## 🎯 功能特性

- ✅ **默认恢复 2 小时内的任务**：平衡了任务恢复和系统启动速度
- ✅ **可配置时间窗口**：通过环境变量灵活调整
- ✅ **完全禁用恢复**：用于特殊场景（如测试、调试）
- ✅ **详细的恢复日志**：清楚显示恢复了多少任务，时间窗口是多少

## ⚙️ 配置方法

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `JOB_RECOVERY_TIME_WINDOW_HOURS` | `2` | 恢复多少小时内的未完成任务 |
| `DISABLE_ANALYSIS_JOB_RECOVERY` | `false` | 是否完全禁用任务恢复 |

### 配置示例

#### 1. 默认配置（推荐）

不需要任何配置，默认恢复最近 2 小时内的任务：

```bash
# .env 文件
# 不需要设置任何变量，使用默认值
```

#### 2. 恢复更长时间窗口

适用于任务处理时间较长的场景：

```bash
# .env 文件
JOB_RECOVERY_TIME_WINDOW_HOURS=4  # 恢复 4 小时内的任务
```

#### 3. 恢复更短时间窗口

适用于快速迭代的开发环境：

```bash
# .env 文件
JOB_RECOVERY_TIME_WINDOW_HOURS=1  # 恢复 1 小时内的任务
```

#### 4. 完全禁用任务恢复

⚠️ 不推荐在生产环境使用：

```bash
# .env 文件
DISABLE_ANALYSIS_JOB_RECOVERY=true  # 禁用任务恢复
```

## 📊 日志示例

### 启动时的恢复日志

#### 有任务需要恢复

```
✅ 数据库连接成功
📊 [AnalysisJobQueue] {"event":"recovery_started","pending":3,"timeWindowHours":2}
📊 [AnalysisJobQueue] {"event":"job_recovered","jobId":"abc123","originalStatus":"queued","newStatus":"queued"}
📊 [AnalysisJobQueue] {"event":"job_recovered","jobId":"def456","originalStatus":"processing","newStatus":"queued"}
📊 [AnalysisJobQueue] {"event":"job_recovered","jobId":"ghi789","originalStatus":"queued","newStatus":"queued"}
📊 [AnalysisJobQueue] {"event":"recovery_completed","recovered":3,"totalPending":3,"timeWindowHours":2}
ℹ️  Recovered 3 pending jobs from database (within 2 hours)
```

#### 没有任务需要恢复

```
✅ 数据库连接成功
📊 [AnalysisJobQueue] {"event":"recovery_completed","recovered":0,"timeWindowHours":2}
ℹ️  No pending jobs to recover (within 2 hours)
```

#### 禁用了任务恢复

```
✅ 数据库连接成功
⚠️  Skipping pending job recovery because DISABLE_ANALYSIS_JOB_RECOVERY=true
```

## 🔍 验证配置

使用提供的验证脚本检查配置：

```bash
npm run verify:job-recovery
# 或
./scripts/verify-job-recovery.sh
```

脚本会显示：
- 当前配置的时间窗口
- 数据库连接状态
- `analysis_jobs` 表的存在性
- 当前时间窗口内未完成的任务数量

## 💡 使用建议

### 场景 1：生产环境

**推荐配置：** 2-4 小时

```bash
JOB_RECOVERY_TIME_WINDOW_HOURS=2  # 或 4
```

**理由：**
- 大多数视频分析任务在 1-2 小时内完成
- 2-4 小时足以覆盖正常的服务器重启场景
- 不会恢复太旧的、可能已经失效的任务

### 场景 2：开发环境

**推荐配置：** 1 小时

```bash
JOB_RECOVERY_TIME_WINDOW_HOURS=1
```

**理由：**
- 开发环境频繁重启
- 较短的时间窗口加快启动速度
- 测试任务通常不需要长期保留

### 场景 3：长时间处理任务

**推荐配置：** 6-12 小时

```bash
JOB_RECOVERY_TIME_WINDOW_HOURS=8
```

**理由：**
- 如果你的视频分析任务可能需要数小时
- 确保即使服务器长时间重启也能恢复任务

### 场景 4：调试/测试

**推荐配置：** 禁用恢复

```bash
DISABLE_ANALYSIS_JOB_RECOVERY=true
```

**理由：**
- 每次启动都是全新的队列
- 避免旧任务干扰测试

## 🔧 故障排查

### 问题：任务没有被恢复

**可能原因：**

1. **任务太旧**
   - 检查任务的 `submitted_at` 时间
   - 如果超过了时间窗口，不会被恢复
   - **解决方案**：增加 `JOB_RECOVERY_TIME_WINDOW_HOURS`

2. **任务状态不对**
   - 只有 `queued` 和 `processing` 状态的任务会被恢复
   - `completed` 和 `failed` 状态不会被恢复
   - **解决方案**：检查数据库中任务的状态

3. **禁用了恢复功能**
   - 检查 `DISABLE_ANALYSIS_JOB_RECOVERY` 是否为 `true`
   - **解决方案**：移除或设置为 `false`

### 问题：启动速度太慢

**可能原因：** 时间窗口太大，恢复了太多任务

**解决方案：**
```bash
# 减少时间窗口
JOB_RECOVERY_TIME_WINDOW_HOURS=1
```

### 问题：启动时报错

**检查步骤：**

1. 验证数据库连接
   ```bash
   npm run test:db
   ```

2. 验证表结构
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'analysis_jobs';
   ```

3. 检查日志
   ```bash
   # 查看详细错误信息
   tail -f runtime-logs/server-*.log
   ```

## 📈 性能影响

| 时间窗口 | 典型任务数 | 启动延迟 | 推荐场景 |
|---------|-----------|---------|---------|
| 1 小时 | 0-10 | < 1 秒 | 开发环境 |
| 2 小时 | 0-20 | < 2 秒 | 生产环境（默认） |
| 4 小时 | 0-40 | < 3 秒 | 长任务场景 |
| 8 小时 | 0-80 | < 5 秒 | 特殊场景 |

**注意：** 实际影响取决于数据库性能和网络延迟。

## 🔗 相关文档

- [任务持久化迁移指南](./JOB_PERSISTENCE_MIGRATION.md)
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md)
- [生产环境准备指南](./PRODUCTION_READY_GUIDE.md)

## 🎓 技术细节

### SQL 查询

恢复任务时使用的 SQL 查询：

```sql
SELECT job_id, status, request_data, use_mock, submitted_at, started_at
FROM analysis_jobs
WHERE status IN ('queued', 'processing')
  AND submitted_at > NOW() - INTERVAL '2 hours'  -- 可配置
ORDER BY submitted_at ASC
```

### 状态重置

- `queued` 状态的任务：保持不变，直接加入队列
- `processing` 状态的任务：重置为 `queued`（因为服务器重启了，之前的处理已中断）

### 恢复流程

1. 检查持久化是否启用
2. 从数据库查询指定时间窗口内的未完成任务
3. 将 `processing` 状态重置为 `queued`
4. 加载到内存队列
5. 触发队列处理
6. 记录恢复日志

---

**最后更新：** 2025-11-24  
**版本：** 1.0.0

