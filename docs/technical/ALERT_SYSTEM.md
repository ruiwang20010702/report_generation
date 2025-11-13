# 告警通知系统文档

## 简介

告警通知系统能够实时监控系统运行状态，在出现异常或资源即将耗尽时自动发送邮件通知，帮助运维团队快速响应问题。

## 功能特性

### 监控项目

1. **额度监控**
   - 通义听悟免费额度预警
   - 剩余20分钟时发送警告
   - 剩余5分钟时发送严重告警

2. **数据库监控**
   - 数据库连接失败告警
   - 数据库查询错误告警
   - 慢查询检测（超过3秒）

3. **错误率监控**
   - 请求错误率统计
   - 错误率超过5%时告警

4. **服务异常监控**
   - 第三方API服务异常
   - 转录服务失败
   - AI分析服务失败

5. **性能监控**
   - 响应时间过慢告警
   - API调用耗时监控

### 告警级别

| 级别 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| INFO | ℹ️ | 蓝色 | 信息通知，无需立即处理 |
| WARNING | ⚠️ | 黄色 | 警告信息，建议关注 |
| CRITICAL | 🚨 | 红色 | 严重问题，需立即处理 |

## 快速开始

### 1. 配置告警邮箱

在 `.env` 文件中添加：

```bash
# 单个邮箱
ALERT_EMAIL=admin@example.com

# 多个邮箱（用逗号分隔）
ALERT_EMAIL=admin@example.com,devops@example.com,tech@example.com
```

### 2. 配置邮件服务

告警系统依赖邮件服务，请确保已正确配置 SMTP：

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=your-email@example.com
```

详见：`docs/getting-started/EMAIL_SETUP.md`

### 3. 测试告警系统

#### 方法1：通过 API 测试（开发环境）

```bash
# 启动服务
npm run dev:backend

# 发送测试告警
curl -X POST http://localhost:3001/api/test-alert
```

#### 方法2：通过代码测试

```typescript
import { testAlertSystem } from './services/alertService';

await testAlertSystem();
```

#### 方法3：触发实际告警

```typescript
// 额度告警测试
import { alertQuotaWarning } from './services/alertService';
await alertQuotaWarning('测试服务', 3, 120); // 剩余3分钟，总额度120分钟

// 数据库错误告警测试
import { alertDatabaseError } from './services/alertService';
await alertDatabaseError(new Error('连接超时'), '数据库连接');
```

## 告警配置

### 告警阈值

可在 `server/services/alertService.ts` 中自定义阈值：

```typescript
const ALERT_CONFIG = {
  // 额度告警阈值
  quotaThresholds: {
    warning: 20,   // 剩余20分钟时预警
    critical: 5,   // 剩余5分钟时严重告警
  },
  
  // 错误率告警阈值
  errorRateThreshold: 0.05, // 5%
  
  // 告警冷却时间（避免重复发送）
  cooldownMinutes: 30, // 30分钟内同类告警只发送一次
};
```

### 冷却机制

为避免短时间内重复发送相同告警，系统实现了冷却机制：
- 同一类型告警在30分钟内只发送一次
- 基于告警类型和详情生成唯一键
- 冷却时间可自定义配置

## 告警类型详解

### 1. 额度预警 (QUOTA_WARNING / QUOTA_CRITICAL)

**触发条件**：
- 通义听悟剩余额度 ≤ 20分钟：WARNING
- 通义听悟剩余额度 ≤ 5分钟：CRITICAL

**告警信息**：
```
通义听悟免费额度即将用完

服务名称: 通义听悟
剩余分钟数: 3 分钟
总额度: 120 分钟
使用率: 97.5%
建议: ⚠️ 额度严重不足，请立即充值或限制使用
```

**代码示例**：
```typescript
// 在转录完成后自动检查
await alertQuotaWarning(
  '通义听悟',
  tingwuService.getStats().remainingMinutes,
  tingwuService.getStats().freeMinutesLimit
);
```

### 2. 错误率告警 (ERROR_RATE_HIGH)

**触发条件**：
- 错误率 > 5%

**告警信息**：
```
系统错误率过高

错误率: 8.50%
错误数量: 17
总请求数: 200
阈值: 5%
建议: 请检查系统日志和 Sentry 错误追踪
```

**代码示例**：
```typescript
await alertHighErrorRate(
  0.085,  // 错误率 8.5%
  17,     // 错误数量
  200     // 总请求数
);
```

### 3. 数据库错误告警 (DATABASE_ERROR)

**触发条件**：
- 数据库连接失败
- 数据库查询错误
- 连接池错误

**告警信息**：
```
数据库连接失败

操作: 数据库查询
错误信息: connection timeout
错误类型: Error
建议: 请检查数据库连接配置和服务状态
```

**自动触发场景**：
- `testConnection()` 失败时
- `pool.query()` 出错时
- 连接池 `error` 事件触发时

### 4. 服务异常告警 (SERVICE_ERROR)

**触发条件**：
- 第三方API调用失败
- 转录服务异常
- AI分析服务异常

**告警信息**：
```
通义听悟服务异常

服务名称: 通义听悟
错误信息: Invalid AccessKey
错误类型: AuthenticationError
上下文: { videoUrl: "...", taskId: "..." }
建议: 请检查服务配置和API密钥
```

**代码示例**：
```typescript
try {
  await transcribeVideo(url);
} catch (error) {
  await alertServiceError('通义听悟', error, {
    videoUrl: url,
    taskId: taskId,
  });
  throw error;
}
```

### 5. 性能告警 (PERFORMANCE_SLOW)

**触发条件**：
- 数据库查询超过3秒
- API响应超过设定阈值

**告警信息**：
```
数据库查询响应过慢

操作名称: 数据库查询
响应时间: 5200ms
阈值: 3000ms
超出时间: 2200ms
建议: 请检查数据库查询、API调用和网络状况
```

**自动触发场景**：
- 数据库查询耗时超过3秒时

## 邮件格式

### 邮件主题

```
[LEVEL] Message
```

示例：
```
🚨 [CRITICAL] 通义听悟免费额度即将用完
⚠️ [WARNING] 数据库查询响应过慢
ℹ️ [INFO] 告警系统测试
```

### 邮件内容

采用 HTML 格式，包含：
- 彩色头部（根据级别显示不同颜色）
- 告警级别和类型
- 发生时间
- 详细信息表格
- 建议措施
- 邮件底部说明

示例：

![告警邮件示例](./alert-email-example.png)

## 告警 API

### sendAlert

通用告警发送函数。

```typescript
await sendAlert(
  AlertType.SERVICE_ERROR,
  AlertLevel.CRITICAL,
  '服务异常',
  {
    服务名称: '通义听悟',
    错误信息: 'API密钥无效',
  }
);
```

### alertQuotaWarning

额度预警（自动判断级别）。

```typescript
await alertQuotaWarning(
  '通义听悟',
  remainingMinutes,  // 剩余分钟数
  totalMinutes       // 总额度
);
```

### alertHighErrorRate

错误率告警。

```typescript
await alertHighErrorRate(
  errorRate,     // 错误率（0-1）
  errorCount,    // 错误数量
  totalRequests  // 总请求数
);
```

### alertDatabaseError

数据库错误告警。

```typescript
await alertDatabaseError(
  error,        // Error 对象
  operation     // 操作名称
);
```

### alertServiceError

服务异常告警。

```typescript
await alertServiceError(
  serviceName,  // 服务名称
  error,        // Error 对象
  context       // 可选：上下文信息
);
```

### alertSlowPerformance

性能告警。

```typescript
await alertSlowPerformance(
  operation,    // 操作名称
  duration,     // 实际耗时（毫秒）
  threshold     // 阈值（毫秒）
);
```

### testAlertSystem

测试告警系统。

```typescript
const success = await testAlertSystem();
```

## 集成示例

### 在服务中集成

```typescript
// server/services/tingwuTranscriptionService.ts
import { alertQuotaWarning } from './alertService.js';

class TingwuTranscriptionService {
  async transcribeFromURL(videoUrl: string) {
    // ... 转录逻辑 ...
    
    // 转录完成后检查额度
    await this.checkAndAlertQuota();
  }
  
  private async checkAndAlertQuota() {
    await alertQuotaWarning(
      '通义听悟',
      this.stats.remainingMinutes,
      this.stats.freeMinutesLimit
    );
  }
}
```

### 在数据库操作中集成

```typescript
// server/config/database.ts
import { alertDatabaseError, alertSlowPerformance } from '../services/alertService.js';

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // 检查慢查询
    if (duration > 3000) {
      await alertSlowPerformance('数据库查询', duration, 3000);
    }
    
    return res;
  } catch (error) {
    // 发送数据库错误告警
    await alertDatabaseError(error, '数据库查询');
    throw error;
  }
}
```

### 在错误处理中集成

```typescript
// server/routes/analysis.ts
import { alertServiceError } from '../services/alertService.js';

router.post('/analyze', async (req, res, next) => {
  try {
    const result = await videoAnalysisService.analyze(req.body);
    res.json(result);
  } catch (error) {
    // 发送服务异常告警
    await alertServiceError('视频分析', error, {
      studentName: req.body.studentName,
      videoUrls: req.body.videoUrls,
    });
    next(error);
  }
});
```

## 最佳实践

### 1. 合理设置告警阈值

根据实际业务场景调整阈值：
- 额度预警：建议提前20-30分钟告警，留出充足处理时间
- 错误率：根据系统稳定性设置，建议3-5%
- 慢查询：根据业务复杂度设置，建议2-5秒

### 2. 使用冷却机制

避免告警轰炸：
- 同一问题在短时间内只发送一次
- 冷却时间建议15-30分钟
- 严重问题可缩短冷却时间

### 3. 提供详细上下文

告警信息应包含：
- 出错时间
- 相关参数
- 错误堆栈
- 建议措施

### 4. 分级处理

根据告警级别采取不同措施：
- **INFO**：记录日志，定期查看
- **WARNING**：工作时间内处理，优先级中等
- **CRITICAL**：立即处理，必要时触发短信/电话告警

### 5. 结合 Sentry

告警系统与 Sentry 互补：
- 告警系统：实时通知、业务指标监控
- Sentry：详细错误追踪、性能分析、用户行为回溯

```typescript
// 严重告警同时记录到 Sentry
if (level === AlertLevel.CRITICAL) {
  Sentry?.captureMessage(message, {
    level: 'error',
    tags: { alertType: type },
    extra: details,
  });
}
```

### 6. 定期测试

建议每周或每月测试一次告警系统：
```bash
curl -X POST http://localhost:3001/api/test-alert
```

## 故障排查

### Q1: 没有收到告警邮件？

**检查清单**：
1. ✅ 确认 `ALERT_EMAIL` 已配置
2. ✅ 确认邮件服务配置正确（SMTP）
3. ✅ 检查垃圾邮件文件夹
4. ✅ 查看服务器日志（是否有发送失败记录）
5. ✅ 测试邮件服务：`npm run test:email`
6. ✅ 测试告警系统：`POST /api/test-alert`

### Q2: 告警太频繁？

**解决方案**：
1. 增加冷却时间（`cooldownMinutes`）
2. 调整告警阈值（提高触发条件）
3. 过滤低优先级告警

### Q3: 告警延迟？

**可能原因**：
1. 邮件服务器响应慢
2. 网络延迟
3. 邮件队列积压

**解决方案**：
- 使用国内邮件服务（阿里云邮件推送）
- 检查网络连接
- 考虑异步发送（不阻塞主流程）

### Q4: 如何添加自定义告警？

```typescript
// 1. 定义新的告警类型
export enum AlertType {
  // ... 现有类型
  CUSTOM_ALERT = 'custom_alert',
}

// 2. 创建告警函数
export async function alertCustom(message: string, details: Record<string, any>) {
  await sendAlert(
    AlertType.CUSTOM_ALERT,
    AlertLevel.WARNING,
    message,
    details
  );
}

// 3. 在业务代码中使用
import { alertCustom } from './services/alertService';
await alertCustom('自定义告警', { key: 'value' });
```

## 监控指标

### 告警统计

建议跟踪以下指标：
- 告警总数（按级别/类型分组）
- 告警响应时间
- 告警解决时间
- 重复告警次数

### 系统健康指标

- 额度使用率
- 数据库查询平均耗时
- 错误率趋势
- API可用性

## 进阶功能

### 1. 多渠道通知

除邮件外，可集成：
- 钉钉机器人
- 企业微信
- Slack
- 短信（阿里云SMS）
- 电话（阿里云语音）

### 2. 告警规则引擎

实现更灵活的告警规则：
```typescript
const rules = [
  {
    name: '连续错误告警',
    condition: (metrics) => metrics.continuousErrors > 5,
    action: async () => await alertServiceError(...),
  },
  {
    name: '用户活跃度下降',
    condition: (metrics) => metrics.activeUsers < metrics.avgActiveUsers * 0.5,
    action: async () => await sendAlert(...),
  },
];
```

### 3. 告警聚合

将同类告警聚合后发送：
```typescript
// 每小时聚合一次发送
const aggregatedAlerts = groupBy(alerts, 'type');
await sendAggregatedAlert(aggregatedAlerts);
```

### 4. 告警升级

根据时间和优先级自动升级：
```typescript
// 30分钟内未处理，升级为 CRITICAL
if (alert.level === 'WARNING' && alert.age > 30 * 60 * 1000) {
  await escalateAlert(alert);
}
```

## 相关文档

- [邮件服务配置](../getting-started/EMAIL_SETUP.md)
- [Sentry 错误追踪](../deployment/SENTRY_SETUP.md)
- [生产环境检查清单](../deployment/PRODUCTION_CHECKLIST.md)
- [系统监控指南](../deployment/MONITORING.md)

## 下一步

配置完告警系统后，建议：
1. ✅ 配置 Uptime 监控（UptimeRobot / Better Stack）
2. ✅ 实现优雅关闭机制
3. ✅ 增强健康检查端点
4. ✅ 添加性能指标收集

## 更新日志

- **2025-11-13**：初版发布，支持额度、数据库、错误率、服务异常、性能监控

