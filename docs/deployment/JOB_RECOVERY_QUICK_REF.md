# 任务恢复功能 - 快速参考

## 🚀 快速开始

### 默认行为
服务器重启时**自动恢复最近 2 小时内**的未完成任务。

### 无需配置
开箱即用，不需要任何额外配置。

---

## ⚙️ 环境变量

```bash
# 自定义时间窗口（小时）
JOB_RECOVERY_TIME_WINDOW_HOURS=2    # 默认值

# 完全禁用恢复（不推荐）
DISABLE_ANALYSIS_JOB_RECOVERY=false  # 默认值
```

---

## 📝 常用配置

### 生产环境（推荐）
```bash
JOB_RECOVERY_TIME_WINDOW_HOURS=2
```

### 长任务场景
```bash
JOB_RECOVERY_TIME_WINDOW_HOURS=6
```

### 开发环境
```bash
JOB_RECOVERY_TIME_WINDOW_HOURS=1
```

### 禁用恢复（调试用）
```bash
DISABLE_ANALYSIS_JOB_RECOVERY=true
```

---

## 🔍 验证命令

```bash
# 验证配置
npm run verify:job-recovery

# 查看数据库中的未完成任务
psql $DATABASE_URL -c "
  SELECT job_id, status, submitted_at, 
         NOW() - submitted_at as age
  FROM analysis_jobs 
  WHERE status IN ('queued', 'processing')
  ORDER BY submitted_at DESC
  LIMIT 10;
"
```

---

## 📊 日志关键字

启动时查找这些日志：

```bash
# 有任务恢复
"recovery_started"
"Recovered N pending jobs from database (within X hours)"

# 无任务恢复  
"No pending jobs to recover (within X hours)"

# 禁用恢复
"Skipping pending job recovery"
```

---

## ⚡ 快速故障排查

| 问题 | 检查 | 解决 |
|------|------|------|
| 任务没恢复 | 任务是否超过时间窗口？ | 增加 `TIME_WINDOW_HOURS` |
| 启动太慢 | 时间窗口是否太大？ | 减少 `TIME_WINDOW_HOURS` |
| 禁用恢复 | 是否设置了 `DISABLE_*=true`？ | 移除或改为 `false` |

---

## 🔗 详细文档

- [完整配置指南](./JOB_RECOVERY_CONFIG.md)
- [迁移指南](./JOB_PERSISTENCE_MIGRATION.md)
- [变更日志](../../CHANGELOG_JOB_RECOVERY.md)

---

**提示：** 大多数场景下使用默认配置（2小时）即可，无需修改。

