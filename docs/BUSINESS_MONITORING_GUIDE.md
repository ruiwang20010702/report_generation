# 业务监控指南

本文档详细说明视频分析系统的业务监控体系，包括日志收集、报警策略和业务稳定性监控方案，确保业务故障能够及时发现和处理。

---

## 📊 一、业务日志收集

### 1.1 核心业务流程日志

**目的**: 追踪每次报告生成的完整生命周期

**需要收集的关键日志**：

- 请求接收：`studentName`, `studentId`, `video1`/`video2` URLs
- 处理模式：`useMock` / `real AI analysis`
- API Key来源：`user-provided` / `server-configured`
- 处理耗时：`elapsedTime`
- 成功/失败状态：✅ / ❌
- 失败原因：`ErrorType` + 具体错误消息

**日志格式示例**：

```json
{
  "timestamp": "2025-11-17T10:30:45.123Z",
  "requestId": "uuid-xxx",
  "event": "analysis_request",
  "userId": "user-123",
  "studentName": "张三",
  "studentId": "student-456",
  "video1": "https://...",
  "video2": "https://...",
  "mode": "real_ai",
  "apiKeySource": "user_provided",
  "status": "started"
}
```

**代码位置**：`server/routes/analysis.ts` 第171-220行

---

### 1.2 成本追踪日志

**目的**: 实时监控每次分析的成本开销

**需要收集的字段**：

| 字段 | 说明 | 来源 |
|------|------|------|
| `reportId` | 报告唯一ID | 数据库自动生成 |
| `userId` | 用户ID | 请求参数 |
| `studentName` | 学生姓名 | 请求参数 |
| `studentId` | 学生ID | 请求参数 |
| `createdAt` | 生成时间 | 数据库时间戳 |
| `costDetail.total.cost` | 总成本（元） | 成本计算模块 |
| `costDetail.transcription.cost` | 转录成本（元） | 通义听悟 |
| `costDetail.aiAnalysis.totalCost` | AI分析成本（元） | 智谱GLM |
| `costDetail.aiAnalysis.totalTokens` | Token使用量 | 智谱GLM |
| `costDetail.transcription.totalMinutes` | 音频时长（分钟） | 通义听悟 |

**监控点**：

- ⚠️ 单次成本异常（超过均值3倍）
- ⚠️ 用户累计成本突增（环比 > 200%）
- ⚠️ 服务总成本超预算

**代码位置**：`server/services/reportRecordService.ts` 第64-75行

---

### 1.3 依赖服务健康日志

**目的**: 监控外部服务（通义听悟、智谱GLM）的可用性和性能

#### 1.3.1 通义听悟服务

**关键指标**：

| 指标 | 字段 | 正常范围 | 异常阈值 |
|------|------|----------|----------|
| 剩余免费额度 | `remainingMinutes` | 0-120分钟 | < 10分钟 |
| 已使用额度 | `totalMinutesUsed` | 0-120分钟 | > 100分钟 |
| 转录任务状态 | `taskStatus` | ONGOING/COMPLETED | FAILED/INVALID |
| 任务耗时 | 轮询次数 × 5秒 | < 60秒 | > 180秒 |
| 错误码 | `errorCode` | 无 | TSC.AudioFileLink, PRE.AudioDurationQuotaLimit |

**日志格式示例**：

```json
{
  "timestamp": "2025-11-17T10:32:15.456Z",
  "service": "tingwu_transcription",
  "event": "transcription_completed",
  "taskId": "task-abc123",
  "videoDuration": 180,
  "processingTime": 45,
  "remainingQuota": 85,
  "status": "success"
}
```

**代码位置**：`server/services/tingwuTranscriptionService.ts`

#### 1.3.2 智谱GLM AI服务

**关键指标**：

| 指标 | 字段 | 正常范围 | 异常阈值 |
|------|------|----------|----------|
| 模型名称 | `model` | glm-4-plus | - |
| 输入Token | `promptTokens` | 1000-5000 | > 10000 |
| 输出Token | `completionTokens` | 500-3000 | > 5000 |
| 总Token | `totalTokens` | 1500-8000 | > 15000 |
| 调用耗时 | 响应时间 | < 10秒 | > 30秒 |
| 单次成本 | `cost` | ¥0.01-¥0.1 | > ¥1 |

**失败原因分类**：

- `API key error`：API密钥无效或未配置
- `timeout`：请求超时
- `quota exceeded`：额度耗尽
- `rate limit`：请求频率超限

**代码位置**：`server/services/videoAnalysisService.ts` 第244-390行

---

### 1.4 错误分类日志

**目的**: 按错误类型统计，快速定位问题根因

**错误类型枚举**（`ErrorType`）：

| 错误类型 | HTTP状态码 | 说明 | 用户消息 |
|----------|-----------|------|----------|
| `VALIDATION_ERROR` | 400 | 参数验证失败 | 请求参数不正确，请检查输入信息 |
| `TRANSCRIPTION_ERROR` | 500 | 转录服务失败 | 视频转录失败，请检查视频链接和内容 |
| `AI_ANALYSIS_ERROR` | 500 | AI分析失败 | AI分析失败，请稍后重试 |
| `VIDEO_PROCESSING_ERROR` | 500 | 视频处理失败 | 视频处理失败，请检查视频格式和链接 |
| `API_KEY_ERROR` | 401 | API密钥问题 | API密钥无效或未配置，请检查配置 |
| `QUOTA_EXCEEDED` | 429 | 额度耗尽 | 服务额度已用完，请稍后再试或升级套餐 |
| `TIMEOUT_ERROR` | 504 | 请求超时 | 请求超时，请稍后重试或使用较短的视频 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 | 服务暂时不可用，请稍后重试 |

**日志格式示例**：

```json
{
  "timestamp": "2025-11-17T10:35:20.789Z",
  "requestId": "uuid-xxx",
  "event": "analysis_failed",
  "errorType": "TRANSCRIPTION_ERROR",
  "errorMessage": "转写任务失败: Audio file link invalid",
  "errorCode": "TSC.AudioFileLink",
  "userId": "user-123",
  "studentName": "张三",
  "videoUrl": "https://...",
  "elapsedTime": 120,
  "context": {
    "hint": "请确保文件URL是公开可访问的"
  }
}
```

**代码位置**：`server/utils/errors.ts` 第12-31行

---

### 1.5 性能指标日志

**目的**: 监控系统性能瓶颈

**需要收集的指标**：

#### 视频处理流程

| 阶段 | 指标 | 正常范围 | 关注阈值 | 严重阈值 |
|------|------|----------|----------|----------|
| 转录阶段 | `transcribeTime` | 30-60秒 | > 90秒 | > 180秒 |
| 分析阶段 | `analysisTime` | 10-30秒 | > 45秒 | > 90秒 |
| 报告生成阶段 | `reportTime` | 5-15秒 | > 30秒 | > 60秒 |
| 总耗时 | `totalTime` | 45-105秒 | > 180秒 | > 300秒 |

**注意**：转录和分析采用流水线并行处理，转录完成后立即开始分析，无需等待另一个视频。

#### 数据库操作

| 操作 | 指标 | 正常范围 | 关注阈值 |
|------|------|----------|----------|
| 报告写入 | INSERT耗时 | < 100ms | > 500ms |
| 报告查询 | SELECT耗时 | < 50ms | > 200ms |
| 成本统计 | 聚合查询耗时 | < 200ms | > 1000ms |

**日志格式示例**：

```json
{
  "timestamp": "2025-11-17T10:40:00.000Z",
  "requestId": "uuid-xxx",
  "event": "analysis_completed",
  "performance": {
    "transcribeTime": 45.2,
    "analysisTime": 28.5,
    "reportTime": 12.3,
    "totalTime": 86.0,
    "dbWriteTime": 0.085
  }
}
```

**代码位置**：`server/services/videoAnalysisService.ts` 第1256-1407行

---

## 🚨 二、日志报警策略

### 2.1 成功率报警

**触发条件**：

| 时间窗口 | 失败率阈值 | 报警级别 |
|----------|-----------|----------|
| 5分钟 | > 10% | 🔴 严重 (P0) |
| 5分钟 | 5-10% | 🟠 警告 (P1) |
| 10分钟 | > 3% | 🟠 警告 (P1) |
| 1小时 | > 1% | 🟡 关注 (P2) |

**报警内容**：

- 失败率百分比
- 失败次数 / 总次数
- 按 `ErrorType` 分类统计
- 最近5条失败日志
- 受影响用户数

**SQL查询示例**：

```sql
-- 每5分钟统计成功率
SELECT 
  COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*) as success_rate,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  error_type,
  COUNT(DISTINCT user_id) as affected_users
FROM analysis_logs
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY error_type;
```

---

### 2.2 耗时报警

**触发条件**：

| 指标 | 阈值 | 报警级别 |
|------|------|----------|
| P95耗时 | > 180秒 | 🟠 警告 |
| P99耗时 | > 300秒 | 🔴 严重 |
| 单次耗时 | > 600秒 | 🔴 严重 |
| 连续超时 | 连续10次 > 120秒 | 🟠 警告 |

**报警内容**：

- P50/P95/P99耗时分布
- 最慢的5个请求详情
- 耗时分布：转录 vs 分析 vs 报告生成
- 可能的瓶颈分析

**监控点细分**：

```yaml
转录阶段：
  - 通义听悟任务创建时间
  - 任务轮询等待时间
  - 结果下载解析时间

AI分析阶段：
  - GLM API调用时间（视频1）
  - GLM API调用时间（视频2）
  - GLM对比报告生成时间

报告生成阶段：
  - 数据整合时间
  - 数据库写入时间
```

---

### 2.3 成本异常报警

**触发条件**：

| 场景 | 条件 | 报警级别 |
|------|------|----------|
| 单次成本异常 | > 均值 + 3σ | 🟠 警告 |
| 单次成本超高 | > ¥5 | 🔴 严重 |
| 单次成本偏高 | > ¥2 | 🟡 关注 |
| 用户累计成本突增 | 环比增长 > 200% | 🟠 警告 |
| 每小时总成本 | > 预算阈值 | 🔴 严重 |

**报警内容**：

- 异常报告ID
- 用户信息（userId, email）
- 学生信息（studentName, studentId）
- 成本详情：
  - 转录成本（元）
  - AI分析成本（元）
  - 总成本（元）
- Token使用量（与历史均值对比）
- 音频时长（与历史均值对比）

**SQL查询示例**：

```sql
-- 检测成本异常
WITH cost_stats AS (
  SELECT 
    AVG((cost_detail->'total'->>'cost')::numeric) as avg_cost,
    STDDEV((cost_detail->'total'->>'cost')::numeric) as stddev_cost
  FROM reports
  WHERE created_at > NOW() - INTERVAL '7 days'
)
SELECT 
  r.id, 
  r.user_id, 
  r.student_name,
  (r.cost_detail->'total'->>'cost')::numeric as cost,
  (r.cost_detail->'transcription'->>'totalMinutes')::numeric as minutes,
  (r.cost_detail->'aiAnalysis'->>'totalTokens')::integer as tokens
FROM reports r, cost_stats s
WHERE r.created_at > NOW() - INTERVAL '1 hour'
  AND (r.cost_detail->'total'->>'cost')::numeric > s.avg_cost + 3 * s.stddev_cost;
```

**成本参考值**（2025年4月价格）：

- 通义听悟：¥0.01/分钟
- 智谱GLM-4-Plus：¥0.005/1K tokens（输入+输出）
- 典型单次成本：¥0.05-¥0.20（3-5分钟视频）

---

### 2.4 额度监控报警

**触发条件（通义听悟）**：

| 剩余额度 | 报警级别 | 说明 |
|---------|----------|------|
| < 20分钟 | 🟡 提醒 | 可支撑约6-8个报告 |
| < 10分钟 | 🟠 警告 | 可支撑约3-4个报告 |
| = 0分钟 | 🔴 严重 | 切换到付费模式 |

**报警内容**：

- 当前剩余额度（分钟）
- 已使用额度（分钟）
- 使用率百分比
- 预计耗尽时间（基于最近1小时使用速率）
- 今日分析次数
- 额度重置时间（每天0点）

**说明**：

- 免费额度：每天2小时（120分钟）
- 额度用完后自动切换到付费模式（¥0.01/分钟）
- 不影响服务可用性，但会产生费用

**代码位置**：`server/services/tingwuTranscriptionService.ts` 第1096-1107行

---

### 2.5 日志缺失报警

**触发条件**：

| 场景 | 时间阈值 | 报警级别 |
|------|---------|----------|
| 业务时段无分析请求日志 | 10分钟 | 🔴 严重 |
| 非业务时段无日志 | 30分钟 | 🟡 提醒 |
| 无报告写入数据库日志 | 30分钟 | 🟠 警告 |
| 健康检查失败 | 连续3次 | 🔴 严重 |

**报警内容**：

- 最后一次日志时间
- `/api/analysis/health` 响应状态
- `/api/analysis/quota` 响应内容
- 数据库连接状态
- 服务进程状态

**业务时段定义**：

- 工作日：09:00-22:00
- 周末：10:00-20:00

---

## 🛡️ 三、业务稳定性监控

### 3.1 入口健康监控

#### 3.1.1 健康检查接口

**监控端点**：`GET /api/analysis/health`

**监控指标**：

| 指标 | 正常值 | 异常阈值 | 报警级别 |
|------|--------|----------|----------|
| HTTP状态码 | 200 | 非200 | 🔴 严重 |
| 响应时间 | < 500ms | > 1秒 | 🟡 关注 |
| 响应时间 | < 500ms | > 5秒 | 🟠 警告 |
| 连续失败次数 | 0 | ≥ 3次 | 🔴 严重 |

**期望响应**：

```json
{
  "status": "ok",
  "timestamp": "2025-11-17T10:45:00.000Z",
  "useMock": false
}
```

**代码位置**：`server/routes/analysis.ts` 第260-266行

#### 3.1.2 额度查询接口

**监控端点**：`GET /api/analysis/quota`

**监控指标**：

| 指标 | 正常值 | 异常阈值 |
|------|--------|----------|
| HTTP状态码 | 200 | 非200 |
| 响应时间 | < 1秒 | > 2秒 |
| `available` 字段 | true | false |
| `remainingMinutes` | 0-120 | < 0（异常数据） |

**期望响应**：

```json
{
  "service": "通义听悟 (Tingwu)",
  "available": true,
  "quota": {
    "totalMinutes": 120,
    "usedMinutes": 35,
    "remainingMinutes": 85,
    "usagePercentage": 29,
    "isFreeQuotaExhausted": false
  },
  "period": {
    "startDate": "2025-11-17T00:00:00.000Z",
    "resetFrequency": "daily",
    "description": "每天0点自动重置免费额度"
  }
}
```

**代码位置**：`server/routes/analysis.ts` 第272-301行

#### 3.1.3 分析接口监控

**监控端点**：`POST /api/analysis/analyze`

**监控指标**：

| 指标 | 正常范围 | 关注阈值 | 严重阈值 |
|------|----------|----------|----------|
| QPS（每秒请求数） | 1-10 | > 20 | > 50 |
| 平均响应时间 | 45-105秒 | > 180秒 | > 300秒 |
| 错误率 | < 1% | > 3% | > 10% |
| 并发数 | 1-5 | > 10 | > 20 |

---

### 3.2 依赖资源监控

#### 3.2.1 PostgreSQL数据库

**监控指标**：

| 指标 | SQL查询 | 正常值 | 异常阈值 |
|------|---------|--------|----------|
| 连接池使用率 | `SELECT count(*) FROM pg_stat_activity` | < 80% | > 90% |
| 活跃连接数 | `WHERE state = 'active'` | < 20 | > 50 |
| 慢查询 | `WHERE query_start < now() - interval '1 second'` | 0 | > 5 |
| 死锁检测 | `SELECT * FROM pg_stat_database_conflicts` | 0 | > 0 |
| 磁盘空间使用率 | 系统监控 | < 80% | > 85% |

**慢查询监控**：

```sql
-- 查找执行时间超过1秒的查询
SELECT 
  pid,
  now() - query_start as duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - query_start) > interval '1 second'
  AND state = 'active'
ORDER BY duration DESC;
```

#### 3.2.2 通义听悟API

**监控指标**：

| 指标 | 正常值 | 关注阈值 | 严重阈值 |
|------|--------|----------|----------|
| HTTP状态码分布 | 200占比 > 99% | 200占比 < 95% | 200占比 < 90% |
| 失败率 | < 0.5% | > 1% | > 5% |
| 平均响应时间 | 30-60秒 | > 90秒 | > 180秒 |
| 超时次数 | 0 | > 3次/小时 | > 10次/小时 |

**常见错误码**：

- `TSC.AudioFileLink`：文件链接无效
- `PRE.AudioDurationQuotaLimit`：额度不足
- `InvalidParameter`：参数错误

#### 3.2.3 智谱GLM API

**监控指标**：

| 指标 | 正常值 | 关注阈值 | 严重阈值 |
|------|--------|----------|----------|
| HTTP状态码分布 | 200占比 > 99% | 200占比 < 95% | 200占比 < 90% |
| 失败率 | < 0.5% | > 1% | > 5% |
| 平均响应时间 | 5-15秒 | > 30秒 | > 60秒 |
| Token限流次数 | 0 | > 5次/小时 | > 20次/小时 |

**常见错误**：

- `401 Unauthorized`：API Key无效
- `429 Too Many Requests`：请求频率超限
- `timeout`：请求超时

---

### 3.3 任务吞吐量监控

**监控指标**：

#### 每小时指标

| 指标 | 计算方式 | 正常范围 | 异常检测 |
|------|----------|----------|----------|
| 报告生成数量 | `COUNT(*)` | 5-50 | 环比下降 > 50% |
| 活跃用户数 | `COUNT(DISTINCT user_id)` | 3-20 | 环比下降 > 50% |
| 活跃学生数 | `COUNT(DISTINCT student_id)` | 5-30 | 环比下降 > 50% |
| 成功率 | 成功数/总数 | > 95% | < 90% |
| 平均成本 | `AVG(total_cost)` | ¥0.05-¥0.20 | 偏离均值 > 3σ |

**SQL查询示例**：

```sql
-- 每小时吞吐量统计
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as report_count,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(DISTINCT student_id) as active_students,
  COUNT(CASE WHEN cost_detail IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as success_rate,
  ROUND(AVG((cost_detail->'total'->>'cost')::numeric), 4) as avg_cost
FROM reports
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

#### 异常检测规则

| 场景 | 条件 | 报警级别 |
|------|------|----------|
| 业务断崖式下跌 | 环比下降 > 70% | 🔴 严重 |
| 业务明显下降 | 环比下降 > 50% | 🟠 警告 |
| 无新增报告 | 连续1小时无新报告（业务时段） | 🔴 严重 |

---

### 3.4 资源容量监控

#### 3.4.1 转录服务容量

**监控指标**：

| 指标 | 查询方式 | 监控目的 |
|------|----------|----------|
| 当日累计转录分钟数 | `SUM(totalMinutes)` | 追踪每日用量 |
| 免费额度使用率 | `usedMinutes / 120 * 100%` | 预警额度耗尽 |
| 预计剩余可处理视频数 | `remainingMinutes / avgMinutes` | 容量规划 |
| 平均视频时长 | `AVG(totalMinutes)` | 了解典型负载 |

**SQL查询示例**：

```sql
-- 今日转录服务使用统计
SELECT 
  COUNT(*) as total_reports,
  SUM((cost_detail->'transcription'->>'totalMinutes')::numeric) as total_minutes,
  AVG((cost_detail->'transcription'->>'totalMinutes')::numeric) as avg_minutes,
  MAX((cost_detail->'transcription'->>'totalMinutes')::numeric) as max_minutes
FROM reports
WHERE DATE(created_at) = CURRENT_DATE
  AND cost_detail IS NOT NULL;
```

#### 3.4.2 AI服务容量

**监控指标**：

| 指标 | 查询方式 | 监控目的 |
|------|----------|----------|
| 累计Token使用量 | `SUM(totalTokens)` | 追踪Token消耗 |
| 平均Token/次 | `AVG(totalTokens)` | 了解典型负载 |
| 模型调用次数 | `COUNT(*)` | 统计调用频率 |
| Token使用率 | `usedTokens / quotaTokens` | 预警额度耗尽（如有配额） |

**SQL查询示例**：

```sql
-- 今日AI服务使用统计
SELECT 
  COUNT(*) as total_reports,
  SUM((cost_detail->'aiAnalysis'->>'totalTokens')::integer) as total_tokens,
  AVG((cost_detail->'aiAnalysis'->>'totalTokens')::integer) as avg_tokens,
  SUM((cost_detail->'aiAnalysis'->>'totalCost')::numeric) as total_ai_cost
FROM reports
WHERE DATE(created_at) = CURRENT_DATE
  AND cost_detail IS NOT NULL;
```

#### 3.4.3 趋势预测

**预测指标**：

| 指标 | 计算方式 | 用途 |
|------|----------|------|
| 未来1小时预计使用量 | 最近1小时速率 × 1 | 短期容量预警 |
| 今日预计总使用量 | (已用量 / 已过小时数) × 24 | 日度容量规划 |
| 额度耗尽预计时间 | 剩余额度 / 最近1小时速率 | 提前预警 |

**SQL查询示例**：

```sql
-- 预测今日总使用量
WITH hourly_stats AS (
  SELECT 
    COUNT(*) as reports_per_hour,
    SUM((cost_detail->'transcription'->>'totalMinutes')::numeric) as minutes_per_hour
  FROM reports
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND DATE(created_at) = CURRENT_DATE
)
SELECT 
  reports_per_hour * (24 - EXTRACT(HOUR FROM NOW())) as predicted_remaining_reports,
  minutes_per_hour * (24 - EXTRACT(HOUR FROM NOW())) as predicted_remaining_minutes
FROM hourly_stats;
```

---

## 📈 附录：监控指标汇总

### A.1 核心SLA指标

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| 服务可用性 | ≥ 99.5% | 健康检查成功率 |
| 成功率 | ≥ 95% | 分析请求成功率 |
| P95响应时间 | < 180秒 | 耗时百分位统计 |
| 错误恢复时间 | < 10分钟 | 故障检测到修复时间 |

### A.2 成本指标参考

| 场景 | 典型成本 | 说明 |
|------|----------|------|
| 单次分析（3分钟视频） | ¥0.05-¥0.10 | 转录¥0.03 + AI¥0.02-¥0.07 |
| 单次分析（5分钟视频） | ¥0.10-¥0.20 | 转录¥0.05 + AI¥0.05-¥0.15 |
| 每日100次分析 | ¥5-¥20 | 取决于视频长度和复杂度 |
| 每月3000次分析 | ¥150-¥600 | 规模化后平均成本下降 |

### A.3 报警优先级定义

| 级别 | 符号 | 响应时间 | 处理要求 |
|------|------|----------|----------|
| 🔴 严重 (P0) | Critical | 5分钟内 | 立即处理，必要时唤醒值班人员 |
| 🟠 警告 (P1) | Warning | 15分钟内 | 优先处理，影响用户体验 |
| 🟡 关注 (P2) | Info | 1小时内 | 记录跟进，可能影响服务质量 |

---

## 📝 维护说明

- **文档版本**: v1.0
- **最后更新**: 2025-11-17
- **适用系统**: 51Talk视频分析系统
- **相关文档**: 
  - 数据库Schema: `database/schema.sql`
  - 成本分析SQL: `sql_queries/cost_analysis.sql`
  - 错误处理: `server/utils/errors.ts`

