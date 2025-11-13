# 生产环境就绪指南

## 概述

本文档提供了将 51Talk 英语学习分析系统部署到生产环境的完整指南。系统已经过全面的生产环境优化，包括监控、安全、性能和可靠性等方面。

## ✅ 已完成的生产环境优化

### 1. 错误追踪和监控

#### Sentry 集成
- ✅ 后端错误追踪（服务器异常、API错误）
- ✅ 前端错误追踪（React组件错误、网络错误）
- ✅ 性能监控（事务追踪、慢请求检测）
- ✅ 用户上下文（用户ID、请求信息）
- ✅ 面包屑追踪（用户操作路径）

**配置文档**: [`docs/deployment/SENTRY_SETUP.md`](./SENTRY_SETUP.md)

#### 告警通知系统
- ✅ 邮件告警（SMTP 配置）
- ✅ 多种告警类型：
  - 转录额度不足
  - API 错误率过高
  - 数据库连接失败
  - 系统资源耗尽
  - 性能下降
- ✅ 告警冷却机制（防止重复通知）
- ✅ 可配置的告警阈值

**配置文档**: [`docs/technical/ALERT_SYSTEM.md`](../technical/ALERT_SYSTEM.md)

#### Uptime 监控
- ✅ 多种监控服务配置指南（UptimeRobot、Better Stack）
- ✅ 健康检查端点配置
- ✅ 公开状态页面
- ✅ Webhook 集成

**配置文档**: [`docs/deployment/UPTIME_MONITORING.md`](./UPTIME_MONITORING.md)

### 2. 数据库优化

#### 索引优化
- ✅ 单列索引（`student_id`, `created_at`）
- ✅ 组合索引（`student_id + created_at`）
- ✅ JSON字段索引（GIN索引用于全文搜索）
- ✅ 部分索引（recent_reports）

#### 慢查询监控
- ✅ 自动检测慢查询（>3秒）
- ✅ 慢查询日志记录
- ✅ 慢查询告警
- ✅ 查询性能分析工具

#### 连接池管理
- ✅ 连接池健康检查
- ✅ 连接泄露检测
- ✅ 自动重连机制
- ✅ 连接池指标监控

**配置文档**: [`docs/technical/DATABASE_OPTIMIZATION.md`](../technical/DATABASE_OPTIMIZATION.md)

### 3. 安全加固

#### HTTP 安全头
- ✅ X-Frame-Options (防止点击劫持)
- ✅ X-Content-Type-Options (防止MIME嗅探)
- ✅ X-XSS-Protection (XSS过滤)
- ✅ Content-Security-Policy (内容安全策略)
- ✅ Strict-Transport-Security (HTTPS强制)
- ✅ Permissions-Policy (浏览器功能限制)

#### 输入验证和清理
- ✅ SQL注入防护
- ✅ XSS攻击防护
- ✅ 路径遍历防护
- ✅ 请求体大小限制
- ✅ 文件上传验证

#### 请求限流
- ✅ 全局限流（200请求/15分钟）
- ✅ 分析接口限流（15请求/10分钟）
- ✅ 认证接口限流（5次/15分钟）
- ✅ 慢速攻击防护

#### 其他安全措施
- ✅ CORS 配置（生产环境限制源）
- ✅ API Key 验证（可选）
- ✅ IP 白名单（可选）

**实现文件**: `server/middleware/security.ts`

### 4. 结构化日志

#### Request ID 追踪
- ✅ 每个请求自动生成唯一ID
- ✅ 整个请求链路追踪
- ✅ 响应头包含Request ID
- ✅ 支持自定义Request ID

#### 日志级别
- ✅ DEBUG - 调试信息
- ✅ INFO - 一般信息
- ✅ WARN - 警告
- ✅ ERROR - 错误
- ✅ CRITICAL - 严重错误

#### 结构化输出
- ✅ 开发环境：人类可读格式
- ✅ 生产环境：JSON格式（便于日志聚合）
- ✅ 时间戳、日志级别、类型、消息
- ✅ 上下文信息（requestId、duration等）

#### 专用日志记录器
- ✅ HTTP请求/响应日志
- ✅ 数据库操作日志
- ✅ 外部API调用日志
- ✅ 业务操作日志
- ✅ 安全事件日志

#### 性能监控
- ✅ 慢请求检测（>3秒）
- ✅ 慢查询检测（>1秒）
- ✅ 慢API调用检测（>5秒）

**实现文件**: `server/middleware/logging.ts`

### 5. 性能指标收集

#### 请求指标
- ✅ 总请求数
- ✅ 错误请求数
- ✅ 错误率
- ✅ 平均响应时间
- ✅ P50/P95/P99 响应时间
- ✅ 最快/最慢请求

#### 端点统计
- ✅ 每个端点的请求次数
- ✅ 平均响应时间
- ✅ 最快/最慢响应
- ✅ 错误次数和错误率
- ✅ Top 10 最慢端点

#### 系统资源监控
- ✅ 内存使用（堆、RSS、外部）
- ✅ CPU使用（用户态、系统态）
- ✅ 系统总内存和可用内存
- ✅ CPU核心数
- ✅ 系统负载平均值
- ✅ 进程运行时间

#### 指标报告
- ✅ 定期报告（每15分钟）
- ✅ JSON格式导出
- ✅ Prometheus格式导出
- ✅ HTTP端点：`/api/metrics`
- ✅ 自动告警（错误率、慢请求、高内存使用）

**实现文件**: `server/middleware/metrics.ts`

### 6. 健康检查

#### 健康检查端点
- ✅ `/api/health` - 基础健康检查
- ✅ `/api/health/detailed` - 详细健康检查
- ✅ `/api/health/live` - 存活探针（Liveness）
- ✅ `/api/health/ready` - 就绪探针（Readiness）

#### 检查项目
- ✅ 数据库连接状态
- ✅ 数据库响应时间
- ✅ 连接池状态
- ✅ 转录服务配置
- ✅ 转录额度检查
- ✅ 系统资源（内存、CPU）
- ✅ 外部服务配置（OpenAI、阿里云等）

**实现文件**: `server/routes/health.ts`

### 7. 优雅关闭

#### 关闭流程
- ✅ 捕获终止信号（SIGTERM、SIGINT）
- ✅ 停止接受新请求
- ✅ 等待现有请求完成（30秒超时）
- ✅ 关闭数据库连接池
- ✅ 刷新 Sentry 事件缓冲区
- ✅ 清理资源和定时器

#### 异常处理
- ✅ 未捕获的异常处理
- ✅ 未处理的 Promise 拒绝
- ✅ 错误日志记录
- ✅ Sentry 错误上报

**实现文件**: `server/utils/gracefulShutdown.ts`

### 8. 集成测试

#### 测试套件
- ✅ 健康检查端点测试
- ✅ 安全功能测试（安全头、限流、输入验证）
- ✅ 数据库操作测试（连接、CRUD、索引）
- ✅ API端点测试（验证、错误处理、分页）

#### 测试配置
- ✅ Jest 测试框架
- ✅ TypeScript支持
- ✅ ESM模块支持
- ✅ 代码覆盖率报告
- ✅ 测试环境设置

**测试文件**: `tests/integration/`

## 📋 部署检查清单

### 环境变量配置

#### 必需变量
- [ ] `DATABASE_URL` - 数据库连接字符串
- [ ] `OPENAI_API_KEY` - OpenAI API密钥
- [ ] `ALIYUN_ACCESS_KEY_ID` - 阿里云访问密钥
- [ ] `ALIYUN_ACCESS_KEY_SECRET` - 阿里云密钥
- [ ] `ALIYUN_TINGWU_APP_KEY` - 通义听悟应用密钥

#### 推荐变量
- [ ] `SENTRY_DSN` - Sentry项目DSN
- [ ] `ALERT_EMAIL` - 告警接收邮箱
- [ ] `SMTP_HOST` - SMTP服务器地址
- [ ] `SMTP_PORT` - SMTP端口
- [ ] `SMTP_USER` - SMTP用户名
- [ ] `SMTP_PASSWORD` - SMTP密码
- [ ] `ALLOWED_ORIGINS` - 允许的CORS源（生产环境）

#### 可选变量
- [ ] `API_KEY` - API密钥验证
- [ ] `IP_WHITELIST` - IP白名单
- [ ] `NODE_ENV=production` - 生产环境标识

### 数据库准备

- [ ] 创建数据库和表
- [ ] 运行索引优化脚本：`database/optimize_indexes.sql`
- [ ] 测试数据库连接：`npm run test:db`
- [ ] 验证索引已创建
- [ ] 配置数据库备份

### 外部服务配置

- [ ] 注册 Sentry 账号并创建项目
- [ ] 配置邮件服务（SMTP）
- [ ] 设置 Uptime 监控（UptimeRobot或Better Stack）
- [ ] 测试告警通知：`curl -X POST http://localhost:3001/api/test-alert`

### 安全配置

- [ ] 配置 HTTPS（SSL/TLS证书）
- [ ] 设置 CORS 白名单（`ALLOWED_ORIGINS`）
- [ ] 启用防火墙规则
- [ ] 配置 API Key（如果需要）
- [ ] 配置 IP 白名单（如果需要）
- [ ] 审查请求限流配置

### 性能优化

- [ ] 配置 CDN（静态资源）
- [ ] 启用 gzip 压缩
- [ ] 配置缓存策略
- [ ] 优化数据库查询
- [ ] 配置进程管理器（PM2）

### 监控设置

- [ ] 配置 Sentry 错误追踪
- [ ] 设置 Uptime 监控
- [ ] 配置告警通知
- [ ] 设置日志聚合（可选：ELK、Datadog）
- [ ] 配置性能监控（可选：New Relic、APM）

### 测试验证

- [ ] 运行集成测试：`npm test`
- [ ] 测试健康检查：`curl http://localhost:3001/api/health`
- [ ] 测试详细健康检查：`curl http://localhost:3001/api/health/detailed`
- [ ] 测试性能指标：`curl http://localhost:3001/api/metrics`
- [ ] 手动测试核心功能
- [ ] 压力测试（可选）

### 文档和运维

- [ ] 阅读所有部署文档
- [ ] 准备应急预案
- [ ] 配置备份和恢复流程
- [ ] 设置日志轮转
- [ ] 准备监控仪表盘

## 🚀 部署步骤

### 1. 准备环境

```bash
# 克隆代码
git clone <repository-url>
cd test

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写所有必需的环境变量
```

### 2. 数据库设置

```bash
# 创建数据库（如果还没有）
createdb your_database_name

# 运行数据库迁移
npm run setup:db

# 优化数据库索引
psql -d your_database_name -f database/optimize_indexes.sql

# 测试数据库连接
npm run test:db
```

### 3. 构建应用

```bash
# 构建后端和前端
npm run build

# 验证构建产物
ls -la build/
ls -la dist/
```

### 4. 运行测试

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test:coverage
```

### 5. 启动生产服务器

```bash
# 使用 Node.js 直接运行
NODE_ENV=production npm start

# 或使用 PM2（推荐）
pm2 start build/server/index.js --name "51talk-analysis" --instances max --exec-mode cluster

# 查看日志
pm2 logs 51talk-analysis

# 监控状态
pm2 monit
```

### 6. 验证部署

```bash
# 检查健康状态
curl https://your-domain.com/api/health

# 检查详细健康状态
curl https://your-domain.com/api/health/detailed

# 检查性能指标
curl https://your-domain.com/api/metrics

# 测试前端
open https://your-domain.com
```

### 7. 配置监控

1. **Sentry**：
   - 访问 Sentry 控制面板
   - 验证错误追踪正常工作
   - 设置告警规则

2. **Uptime 监控**：
   - 配置健康检查监控器
   - 设置告警联系人
   - 创建状态页面（可选）

3. **告警通知**：
   - 发送测试告警验证配置
   - 确认邮件通知正常

## 📊 监控仪表盘

### 关键指标

监控以下关键指标以确保系统健康：

1. **可用性**
   - 目标：> 99.9%
   - Uptime 监控自动检查

2. **响应时间**
   - 目标：P95 < 1000ms
   - 通过 `/api/metrics` 查看

3. **错误率**
   - 目标：< 1%
   - Sentry 和性能指标追踪

4. **数据库性能**
   - 查询时间：< 100ms
   - 连接池使用率：< 80%

5. **系统资源**
   - 内存使用：< 80%
   - CPU使用：< 70%

### 告警阈值

系统会在以下情况自动发送告警：

- 错误率 > 5%
- P95响应时间 > 5000ms
- 内存使用 > 90%
- 系统内存使用 > 90%
- 数据库连接失败
- 转录额度 < 10次

## 🔧 运维指南

### 日常维护

#### 查看日志
```bash
# PM2 日志
pm2 logs

# 系统日志（如果使用 systemd）
journalctl -u 51talk-analysis -f
```

#### 监控性能
```bash
# 查看性能指标
curl http://localhost:3001/api/metrics | jq

# 查看详细健康状态
curl http://localhost:3001/api/health/detailed | jq
```

#### 数据库维护
```bash
# 检查慢查询
psql -d your_database -f database/slow_queries_view.sql

# 分析查询性能
EXPLAIN ANALYZE SELECT ...
```

### 故障排查

#### 1. 服务无响应

```bash
# 检查进程状态
pm2 status

# 重启服务
pm2 restart 51talk-analysis

# 查看日志
pm2 logs --lines 100
```

#### 2. 数据库连接失败

```bash
# 测试数据库连接
npm run test:db

# 检查连接池状态
curl http://localhost:3001/api/health/detailed | jq '.checks.database'
```

#### 3. 内存泄露

```bash
# 查看内存使用
pm2 monit

# 重启服务（临时措施）
pm2 restart 51talk-analysis

# 生成堆快照（高级）
node --inspect build/server/index.js
```

#### 4. 高错误率

```bash
# 查看 Sentry 错误报告
# 访问 https://sentry.io

# 检查最近的错误日志
pm2 logs --err --lines 50

# 查看性能指标
curl http://localhost:3001/api/metrics | jq '.requests'
```

### 备份和恢复

#### 数据库备份
```bash
# 创建备份
pg_dump -Fc your_database > backup_$(date +%Y%m%d).dump

# 恢复备份
pg_restore -d your_database backup_20231115.dump
```

#### 环境变量备份
```bash
# 备份环境变量（移除敏感信息后）
cp .env .env.backup
```

## 📚 相关文档

- [Sentry 配置指南](./SENTRY_SETUP.md)
- [告警系统文档](../technical/ALERT_SYSTEM.md)
- [数据库优化文档](../technical/DATABASE_OPTIMIZATION.md)
- [Uptime 监控配置](./UPTIME_MONITORING.md)
- [集成测试文档](../../tests/README.md)

## 🎯 性能基准

### 典型性能指标（参考）

| 指标 | 目标值 | 优秀 | 良好 | 需优化 |
|------|--------|------|------|--------|
| API响应时间（P95） | < 1s | < 500ms | < 1s | > 2s |
| 数据库查询时间 | < 100ms | < 50ms | < 100ms | > 200ms |
| 错误率 | < 1% | < 0.1% | < 1% | > 5% |
| 可用性 | > 99.9% | > 99.99% | > 99.9% | < 99% |
| 内存使用 | < 80% | < 60% | < 80% | > 90% |

## 🚨 应急联系

确保团队了解以下信息：

- **监控面板**：Sentry、UptimeRobot
- **日志位置**：PM2日志、应用日志
- **数据库访问**：连接信息、备份位置
- **告警通知**：接收邮箱、Slack频道
- **文档位置**：本仓库 `docs/` 目录

## ✅ 总结

通过完成本指南中的所有步骤，你的 51Talk 英语学习分析系统已经：

- ✅ 具备完善的错误追踪和监控
- ✅ 实现了全面的安全加固
- ✅ 优化了数据库性能
- ✅ 配置了结构化日志和追踪
- ✅ 建立了性能指标收集
- ✅ 实现了优雅关闭机制
- ✅ 编写了完整的集成测试

系统现在已经为生产环境做好了充分准备！🎉

