# Uptime 监控服务配置指南

## 简介

Uptime 监控服务可以持续监控您的应用程序可用性，在服务中断时及时发送告警通知。本文档介绍如何配置和使用各种 Uptime 监控服务。

## 推荐服务对比

| 服务 | 免费额度 | 检查间隔 | 监控点数 | 通知方式 | 推荐度 |
|------|----------|----------|----------|----------|--------|
| **UptimeRobot** | 50个监控器 | 5分钟 | 50 | 邮件/Slack/Webhook | ⭐⭐⭐⭐⭐ |
| **Better Stack (Uptime)** | 10个监控器 | 30秒 | 10 | 邮件/Slack/SMS | ⭐⭐⭐⭐⭐ |
| **Pingdom** | 免费试用 | 1分钟 | 无限 | 邮件/SMS | ⭐⭐⭐⭐ |
| **Freshping** | 50个监控器 | 1分钟 | 50 | 邮件/Slack | ⭐⭐⭐⭐ |
| **StatusCake** | 10个监控器 | 5分钟 | 10 | 邮件/SMS | ⭐⭐⭐ |

## 方案一：UptimeRobot（推荐）

### 优势
- ✅ 免费额度最高（50个监控器）
- ✅ 操作简单，无需信用卡
- ✅ 支持多种通知方式
- ✅ 提供公开状态页面
- ✅ 历史数据保留90天

### 快速开始

#### 1. 注册账号

访问 [https://uptimerobot.com/](https://uptimerobot.com/) 并注册免费账号。

#### 2. 创建监控器

1. 点击 "Add New Monitor"
2. 选择监控类型：**HTTP(s)**
3. 填写基本信息：

```
Friendly Name: 51Talk Analysis API
URL: https://your-domain.com/api/health
Monitoring Interval: 5 minutes
```

4. （可选）添加告警联系人：
   - 邮箱通知（默认已启用）
   - Slack 通知
   - Webhook 通知

#### 3. 高级配置

**关键字监控**：
```
Keyword: "healthy"
Keyword Type: Exists
```

**自定义 HTTP 请求头**：
```
Authorization: Bearer your-token (如果需要)
```

**超时设置**：
```
Default: 30 seconds
```

#### 4. 创建状态页面（可选）

1. 进入 "Status Pages"
2. 点击 "Add New Status Page"
3. 选择要显示的监控器
4. 自定义页面样式
5. 获取公开链接：`https://status.uptimerobot.com/your-page`

### 推荐监控配置

为 51Talk 英语学习分析系统创建以下监控器：

#### 监控器 1：主页面可用性
```
Name: 51Talk - Frontend
URL: https://your-domain.com/
Interval: 5 minutes
Keyword: <!DOCTYPE html>
```

#### 监控器 2：API 健康检查
```
Name: 51Talk - API Health
URL: https://your-domain.com/api/health
Interval: 5 minutes
Keyword: "healthy"
```

#### 监控器 3：详细健康检查
```
Name: 51Talk - Detailed Health
URL: https://your-domain.com/api/health/detailed
Interval: 10 minutes
```

#### 监控器 4：就绪探针
```
Name: 51Talk - Readiness
URL: https://your-domain.com/api/health/ready
Interval: 5 minutes
```

## 方案二：Better Stack (Uptime)

### 优势
- ✅ 检查间隔最短（30秒）
- ✅ 漂亮的控制面板
- ✅ 强大的告警规则
- ✅ 集成事件管理
- ✅ 详细的分析报告

### 快速开始

#### 1. 注册账号

访问 [https://betterstack.com/uptime](https://betterstack.com/uptime) 并注册账号。

#### 2. 创建监控

1. 点击 "Create Monitor"
2. 选择监控类型：**HTTPS**
3. 填写配置：

```
Name: 51Talk API
URL: https://your-domain.com/api/health
Check frequency: 30 seconds (推荐 1 minute 免费版)
Incident after: 3 failed checks
```

4. 设置期望响应：
```
Expected status code: 200
Expected response body: Contains "healthy"
```

#### 3. 配置告警

1. 进入 "Incidents" → "Policies"
2. 创建告警策略：
   - **邮件**：立即通知
   - **Slack**：5分钟后通知（避免误报）
   - **SMS**：15分钟后通知（严重问题）

#### 4. 集成 Slack（可选）

1. 进入 "Integrations"
2. 选择 "Slack"
3. 授权并选择通知频道
4. 测试集成

### 推荐配置

```
Monitor 1: 51Talk - API Health
  URL: https://your-domain.com/api/health
  Interval: 1 minute
  Expected: 200, contains "healthy"

Monitor 2: 51Talk - Database
  URL: https://your-domain.com/api/health/detailed
  Interval: 2 minutes
  Expected: 200, database status: "healthy"
```

## 方案三：Pingdom

### 优势
- ✅ 企业级监控平台
- ✅ 全球多个监控节点
- ✅ 详细的性能分析
- ✅ 高级告警规则

### 快速开始

1. 访问 [https://www.pingdom.com/](https://www.pingdom.com/)
2. 注册免费试用（14天）
3. 创建 HTTP 监控
4. 配置告警联系人

### 配置示例

```
Name: 51Talk API
URL: https://your-domain.com/api/health
Check interval: 1 minute
Alert when: Down for 2 minutes
```

## 健康检查端点

应用已内置以下健康检查端点：

### 1. 基础健康检查

```
GET /api/health
```

**响应示例**：
```json
{
  "status": "healthy",
  "timestamp": "2025-11-13T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### 2. 详细健康检查

```
GET /api/health/detailed
```

**响应示例**：
```json
{
  "status": "healthy",
  "timestamp": "2025-11-13T12:00:00.000Z",
  "responseTime": "45ms",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": "12ms",
      "connectionCount": 5
    },
    "transcription": {
      "status": "healthy",
      "tingwu": {
        "available": true,
        "remainingQuota": 100,
        "totalQuota": 120
      }
    },
    "system": {
      "status": "healthy",
      "memory": {
        "used": "256MB",
        "total": "512MB",
        "usagePercentage": 50
      },
      "uptime": "1h 23m 45s",
      "nodeVersion": "v20.9.0"
    },
    "services": {
      "openai": true,
      "aliyun": true,
      "sentry": true,
      "email": true,
      "alert": true
    }
  }
}
```

### 3. 存活探针 (Liveness)

```
GET /api/health/live
```

用于容器编排系统（Kubernetes等），检查进程是否存活。

### 4. 就绪探针 (Readiness)

```
GET /api/health/ready
```

检查服务是否准备好接受流量（包括数据库连接等）。

## 告警配置最佳实践

### 1. 分级告警

根据严重程度设置不同的告警延迟：

| 级别 | 失败次数 | 延迟 | 通知方式 |
|------|----------|------|----------|
| 轻微 | 1次失败 | 无通知 | 仅记录 |
| 警告 | 2次连续失败 | 5分钟 | 邮件 |
| 严重 | 3次连续失败 | 立即 | 邮件 + Slack |
| 紧急 | 持续10分钟 | 立即 | 邮件 + Slack + SMS |

### 2. 通知组配置

```
开发团队：
  - 邮件：dev@example.com
  - Slack：#dev-alerts
  - 工作时间：24/7

运维团队：
  - 邮件：ops@example.com
  - Slack：#ops-alerts
  - 电话：仅严重告警
```

### 3. 维护窗口

在计划维护期间暂停告警：
1. 设置维护窗口
2. 暂停相关监控器
3. 维护完成后恢复

## 集成 Webhook

### 接收告警到自定义系统

```typescript
// server/routes/webhooks.ts
app.post('/api/webhooks/uptime', (req, res) => {
  const { monitorID, monitorURL, alertType, alertDetails } = req.body;
  
  // 处理告警
  if (alertType === 'down') {
    // 服务中断
    await alertServiceError('Uptime Monitor', new Error(alertDetails));
  }
  
  res.status(200).json({ received: true });
});
```

### UptimeRobot Webhook 配置

1. 进入 "Alert Contacts"
2. 添加 "Webhook"
3. URL：`https://your-domain.com/api/webhooks/uptime`
4. POST 值：
```
monitorID=*monitorID*
monitorURL=*monitorURL*
alertType=*alertType*
alertDetails=*alertDetails*
```

## 监控指标

### 关键指标

- **可用性**：目标 > 99.9%
- **响应时间**：目标 < 500ms
- **平均故障恢复时间 (MTTR)**：目标 < 15分钟
- **平均故障间隔时间 (MTBF)**：目标 > 30天

### 查看统计

```
UptimeRobot:
  Dashboard → Statistics → 选择时间范围

Better Stack:
  Monitors → Select Monitor → Analytics
```

## 故障排查

### Q1: 误报太多？

**解决方案**：
1. 增加失败次数阈值（如 3次连续失败才告警）
2. 延长检查间隔
3. 检查健康检查端点是否太严格
4. 添加更长的超时时间

### Q2: 没有收到告警？

**检查清单**：
1. ✅ 确认告警联系人已添加
2. ✅ 检查邮件是否在垃圾箱
3. ✅ 测试告警通知（发送测试告警）
4. ✅ 确认监控器状态为"已启用"

### Q3: 健康检查总是失败？

**可能原因**：
1. 数据库连接失败
2. 响应时间超时
3. 返回状态码不是 200
4. 响应内容不包含期望的关键字

**解决方案**：
```bash
# 手动测试健康检查
curl -v https://your-domain.com/api/health

# 查看详细信息
curl https://your-domain.com/api/health/detailed | jq
```

## 公开状态页面

### 创建状态页面

UptimeRobot 免费提供公开状态页面：

1. 进入 "Status Pages"
2. 创建新页面
3. 选择要显示的监控器
4. 自定义样式：
   - Logo
   - 颜色主题
   - 自定义域名（付费功能）

### 示例页面

```
https://status.51talk-analysis.com

显示内容：
- 整体状态
- 各服务状态
- 最近事件
- 历史可用性（30天/90天）
```

### 嵌入到应用

```html
<!-- 在你的页面中嵌入状态小组件 -->
<script src="https://uptimerobot.com/inc/js/status-widget.js"></script>
<div class="uptimerobot-widget" data-monitor-id="your-monitor-id"></div>
```

## 集成 CI/CD

### 部署时暂停监控

```yaml
# .github/workflows/deploy.yml
- name: Pause Uptime Monitor
  run: |
    curl -X POST "https://api.uptimerobot.com/v2/editMonitor" \
      -d "api_key=${{ secrets.UPTIMEROBOT_API_KEY }}" \
      -d "id=${{ secrets.MONITOR_ID }}" \
      -d "status=0"

- name: Deploy Application
  run: ./deploy.sh

- name: Resume Uptime Monitor
  run: |
    curl -X POST "https://api.uptimerobot.com/v2/editMonitor" \
      -d "api_key=${{ secrets.UPTIMEROBOT_API_KEY }}" \
      -d "id=${{ secrets.MONITOR_ID }}" \
      -d "status=1"
```

## 最佳实践总结

1. ✅ **多个监控器**：监控不同的端点和服务
2. ✅ **合理的检查间隔**：5-10分钟足够大多数场景
3. ✅ **分级告警**：避免告警疲劳
4. ✅ **关键字检查**：不仅检查状态码，还要检查响应内容
5. ✅ **维护窗口**：计划维护时暂停告警
6. ✅ **定期测试**：每月测试一次告警通知
7. ✅ **公开状态页面**：提升用户信任
8. ✅ **记录事件**：分析故障原因和趋势

## 相关文档

- [健康检查端点实现](../technical/HEALTH_CHECK.md)
- [告警系统文档](../technical/ALERT_SYSTEM.md)
- [Sentry 错误追踪](./SENTRY_SETUP.md)
- [生产环境检查清单](./PRODUCTION_CHECKLIST.md)

## 下一步

配置完 Uptime 监控后，建议：
1. ✅ 实现安全加固（请求限制、安全头）
2. ✅ 优化结构化日志
3. ✅ 添加性能指标收集
4. ✅ 编写集成测试

