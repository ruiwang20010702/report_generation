# Sentry 错误追踪配置指南

## 简介

Sentry 是一个强大的错误追踪和性能监控平台，可以帮助你：
- 实时追踪所有错误和异常
- 监控应用性能和慢查询
- 追踪用户操作路径
- 设置自动告警通知

## 快速开始

### 1. 创建 Sentry 账号

1. 访问 [https://sentry.io/](https://sentry.io/)
2. 点击 "Sign Up" 注册账号（可以使用 GitHub 账号快速注册）
3. 选择免费计划（5,000 errors/月，足够个人项目使用）

### 2. 创建项目

1. 登录后，点击 "Create Project"
2. 选择平台：
   - **后端**：选择 "Node.js"
   - **前端**：选择 "React"
3. 输入项目名称（如：`51talk-backend` 和 `51talk-frontend`）
4. 选择团队（使用默认团队即可）
5. 点击 "Create Project"

### 3. 获取 DSN

创建项目后，会自动显示 DSN（Data Source Name），格式如下：

```
https://abc123def456@o123456.ingest.sentry.io/7890123
```

复制这个 DSN，稍后会用到。

### 4. 配置环境变量

在你的 `.env` 文件中添加：

```bash
# 后端 Sentry DSN
SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id

# 前端 Sentry DSN
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id

# 环境标识（可选）
SENTRY_ENVIRONMENT=production
VITE_SENTRY_ENVIRONMENT=production
```

**注意**：
- 如果后端和前端使用同一个 Sentry 项目，DSN 相同
- 推荐为后端和前端创建独立项目，便于分别管理

## 验证集成

### 后端验证

1. 启动后端服务：
   ```bash
   npm run dev:backend
   ```

2. 查看启动日志，应该看到：
   ```
   ✅ Sentry 错误追踪已启用
      环境: development
      采样率: 100%
   ```

3. 触发测试错误（可选）：
   ```bash
   curl http://localhost:3001/api/test-error
   ```

### 前端验证

1. 启动前端服务：
   ```bash
   npm run dev:frontend
   ```

2. 打开浏览器控制台，应该看到：
   ```
   ✅ Sentry 前端错误追踪已启用
   ```

3. 在 Sentry 控制台查看是否收到错误报告

## 配置告警

### 设置告警规则

1. 在 Sentry 项目中，点击 "Alerts" → "Create Alert"
2. 选择告警类型：
   - **Issues**：当新错误发生时
   - **Metrics**：当错误率超过阈值时
   - **Crash Rate**：当崩溃率过高时

### 推荐告警配置

#### 1. 新错误告警
- **触发条件**：第一次出现新的错误
- **通知方式**：邮件
- **接收人**：所有团队成员

#### 2. 错误率告警
- **触发条件**：错误率 > 5%（每分钟错误数 / 请求数）
- **通知方式**：邮件 + Slack（可选）
- **接收人**：开发团队

#### 3. 性能告警
- **触发条件**：P95 响应时间 > 3秒
- **通知方式**：邮件
- **接收人**：技术负责人

## 最佳实践

### 1. 添加用户上下文

在用户登录后，设置用户信息：

```typescript
// 后端
import { setUser } from './config/sentry';

// 在认证中间件中
setUser({
  id: user.id,
  email: user.email,
  username: user.name,
});

// 前端
import { setUser } from './config/sentry';

// 在登录成功后
setUser({
  id: user.id,
  email: user.email,
  username: user.name,
});
```

### 2. 添加面包屑

追踪用户操作路径：

```typescript
import { addBreadcrumb } from './config/sentry';

// 记录关键操作
addBreadcrumb('用户开始视频分析', {
  studentName: '小明',
  videoCount: 2,
});
```

### 3. 手动捕获错误

对于特定的业务错误：

```typescript
import { captureError } from './config/sentry';

try {
  await analyzeVideo(video);
} catch (error) {
  captureError(error, {
    context: 'video-analysis',
    videoId: video.id,
  });
  throw error;
}
```

### 4. 性能监控

Sentry 会自动追踪：
- HTTP 请求耗时
- 数据库查询耗时
- 路由加载时间

你也可以手动追踪特定操作：

```typescript
import { Sentry } from './config/sentry';

const transaction = Sentry.startTransaction({
  op: 'video-transcription',
  name: '视频转录',
});

try {
  const result = await transcribeVideo(url);
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

## 生产环境配置

### 采样率调整

在 `.env` 中配置：

```bash
# 生产环境建议降低采样率以节省配额
NODE_ENV=production

# Sentry 会自动将采样率降至 10%
```

### 发布版本追踪

在 `package.json` 中维护版本号：

```json
{
  "version": "2.1.0"
}
```

Sentry 会自动使用这个版本号，便于追踪特定版本的错误。

### 源码映射（Source Maps）

在构建时生成源码映射：

```bash
# package.json
{
  "scripts": {
    "build": "vite build --sourcemap"
  }
}
```

## 常见问题

### Q1: 没有收到错误报告？

**检查清单**：
- ✅ 确认 `SENTRY_DSN` 配置正确
- ✅ 确认启动日志显示 "Sentry 已启用"
- ✅ 检查网络连接（防火墙、代理）
- ✅ 确认错误没有被过滤（查看 `ignoreErrors` 配置）

### Q2: 错误报告太多？

**解决方案**：
- 调整采样率（降低 `tracesSampleRate`）
- 增加 `ignoreErrors` 过滤规则
- 升级 Sentry 计划

### Q3: 如何禁用 Sentry？

**临时禁用**：
```bash
# 移除或注释掉 DSN
# SENTRY_DSN=
```

**条件启用**：
```bash
# 仅在生产环境启用
if (process.env.NODE_ENV === 'production') {
  initSentry();
}
```

## 成本估算

### 免费计划
- **错误数**：5,000/月
- **性能追踪**：10,000 transactions/月
- **会话重放**：50 sessions/月
- **团队成员**：无限制
- **数据保留**：30天

### 收费计划
- **开发者计划**：$26/月
  - 50,000 errors/月
  - 100,000 transactions/月
  - 500 replays/月

对于 200 用户的项目，**免费计划足够使用**。

## 监控指标说明

### 关键指标

- **Error Rate**：错误率（错误数 / 请求数）
- **Crash-free Rate**：无崩溃会话比例
- **APDEX Score**：应用性能指数（0-1，越高越好）
- **P50/P75/P95/P99**：响应时间百分位数

### 健康阈值

| 指标 | 健康 | 警告 | 危险 |
|------|------|------|------|
| Error Rate | < 1% | 1-5% | > 5% |
| Crash-free Rate | > 99% | 95-99% | < 95% |
| P95 Response | < 2s | 2-5s | > 5s |

## 相关资源

- [Sentry 官方文档](https://docs.sentry.io/)
- [Sentry Node.js SDK](https://docs.sentry.io/platforms/node/)
- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry 最佳实践](https://docs.sentry.io/product/best-practices/)

## 下一步

配置完 Sentry 后，建议：
1. ✅ 配置告警通知（邮件 + Slack）
2. ✅ 集成 UptimeRobot 或 Better Stack 进行可用性监控
3. ✅ 实现自定义告警系统（额度、错误率监控）

参考文档：`docs/deployment/PRODUCTION_CHECKLIST.md`

