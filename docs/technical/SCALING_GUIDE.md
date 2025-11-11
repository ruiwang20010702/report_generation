# 扩展性指南

本指南提供从 200 用户扩展到更大规模的策略和建议。

## 📊 扩展阶段

### 阶段 1: 小规模（< 200 用户）
**当前配置** ✅

- **架构**: Vercel Serverless
- **数据库**: Supabase 免费层
- **缓存**: 内存/Upstash 免费层
- **成本**: ~$100-200/月

### 阶段 2: 中等规模（200-1000 用户）
**需要优化**

- **架构**: 
  - Vercel Pro/Team
  - Redis 缓存（Upstash Pro）
  - CDN 加速
  
- **优化点**:
  - 实施请求队列
  - 增加缓存层
  - 优化数据库索引
  - 使用异步处理

- **成本**: ~$300-500/月

### 阶段 3: 大规模（> 1000 用户）
**需要重构**

- **架构**:
  - 微服务架构
  - 负载均衡
  - 消息队列（Redis/RabbitMQ）
  - 独立视频处理服务
  - 多区域部署

- **优化点**:
  - 水平扩展
  - 数据库分片
  - 内容分发网络
  - 专用视频处理集群

- **成本**: $1000+/月

---

## 🚀 扩展策略

### 1. 异步处理架构

当视频处理时间 > 30 秒时，建议使用异步架构：

```typescript
// 1. 接收请求，返回任务 ID
POST /api/analysis/submit
→ { taskId: 'abc123', status: 'pending' }

// 2. 后台处理
Background Worker 处理视频

// 3. 轮询或 Webhook 获取结果
GET /api/analysis/status/abc123
→ { status: 'completed', result: {...} }
```

**实现方案**：

#### 选项 A: 使用 Vercel Cron + Supabase
```typescript
// api/cron/process-queue.ts
import { supabase } from '@/lib/supabase';

export default async function handler(req, res) {
  // 每分钟执行一次
  const { data: pendingTasks } = await supabase
    .from('analysis_tasks')
    .select('*')
    .eq('status', 'pending')
    .limit(5);

  for (const task of pendingTasks) {
    // 处理任务
    await processTask(task);
  }

  res.status(200).json({ processed: pendingTasks.length });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/process-queue",
    "schedule": "* * * * *"
  }]
}
```

#### 选项 B: 使用消息队列（推荐 > 500 用户）
```typescript
// 使用 Upstash QStash
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// 提交任务
await qstash.publishJSON({
  url: 'https://your-app.vercel.app/api/process-video',
  body: { taskId: 'abc123', videoUrl: '...' },
});
```

### 2. 数据库优化

#### 2.1 索引优化
```sql
-- 创建索引加速查询
CREATE INDEX idx_analysis_user_id ON analysis_tasks(user_id);
CREATE INDEX idx_analysis_status ON analysis_tasks(status);
CREATE INDEX idx_analysis_created_at ON analysis_tasks(created_at DESC);

-- 组合索引
CREATE INDEX idx_user_status ON analysis_tasks(user_id, status);
```

#### 2.2 分页查询
```typescript
// 不好的做法
const allResults = await supabase
  .from('reports')
  .select('*');

// 好的做法：使用分页
const pageSize = 20;
const { data, count } = await supabase
  .from('reports')
  .select('*', { count: 'exact' })
  .range(page * pageSize, (page + 1) * pageSize - 1)
  .order('created_at', { ascending: false });
```

#### 2.3 数据归档
```typescript
// 定期归档旧数据
async function archiveOldReports() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // 移动到归档表
  await supabase.rpc('archive_old_reports', {
    before_date: sixMonthsAgo.toISOString(),
  });
}
```

### 3. 缓存策略

#### 3.1 多层缓存
```typescript
class CacheService {
  private memoryCache = new Map();
  private redis: Redis;

  async get(key: string): Promise<any> {
    // L1: 内存缓存
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // L2: Redis 缓存
    const redisValue = await this.redis.get(key);
    if (redisValue) {
      this.memoryCache.set(key, redisValue);
      return redisValue;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number) {
    // 写入两层缓存
    this.memoryCache.set(key, value);
    await this.redis.set(key, value, { ex: ttl });
  }
}
```

#### 3.2 缓存预热
```typescript
// 预加载热门数据
async function warmUpCache() {
  const popularUsers = await getPopularUsers();
  
  for (const user of popularUsers) {
    const reports = await fetchUserReports(user.id);
    await cache.set(`user:${user.id}:reports`, reports, 3600);
  }
}
```

### 4. 负载均衡

#### 4.1 API 负载均衡
使用多个 API 提供商：

```typescript
class AIServiceBalancer {
  private providers = [
    { name: 'openai', client: openaiClient, weight: 70 },
    { name: 'anthropic', client: anthropicClient, weight: 30 },
  ];

  async analyze(text: string) {
    const provider = this.selectProvider();
    return await provider.client.analyze(text);
  }

  private selectProvider() {
    // 加权随机选择
    const total = this.providers.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * total;
    
    for (const provider of this.providers) {
      random -= provider.weight;
      if (random <= 0) return provider;
    }
    
    return this.providers[0];
  }
}
```

#### 4.2 区域负载均衡
```typescript
// 根据用户位置选择最近的区域
function getClosestRegion(userIp: string): string {
  const userLocation = geolocate(userIp);
  
  const regions = [
    { name: 'hkg1', lat: 22.3, lon: 114.2 },
    { name: 'sin1', lat: 1.3, lon: 103.8 },
    { name: 'syd1', lat: -33.9, lon: 151.2 },
  ];

  return findClosest(userLocation, regions);
}
```

### 5. 微服务拆分

当用户规模 > 1000 时，考虑微服务架构：

```
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │
    ┌────┴────┐
    │  Router │
    └─┬──┬──┬─┘
      │  │  │
┌─────┴──┴──┴─────┐
│                  │
├─ Video Service   │ ← 处理视频上传和预处理
├─ Analysis Service│ ← AI 分析
├─ Report Service  │ ← 生成和存储报告
└─ User Service    │ ← 用户管理
```

---

## 📈 监控指标

### 关键指标

#### 1. 系统指标
```typescript
interface SystemMetrics {
  // 请求指标
  requestsPerMinute: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;

  // 资源指标
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;

  // 业务指标
  activeUsers: number;
  analysisCompletionRate: number;
  averageAnalysisTime: number;
}
```

#### 2. 警报阈值
```typescript
const alerts = {
  errorRate: {
    warning: 1, // 1%
    critical: 5, // 5%
  },
  responseTime: {
    warning: 3000, // 3s
    critical: 10000, // 10s
  },
  memoryUsage: {
    warning: 80, // 80%
    critical: 95, // 95%
  },
};
```

### 实施监控

使用 Sentry 进行监控：

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// 捕获性能指标
const transaction = Sentry.startTransaction({
  op: 'video-analysis',
  name: 'Analyze Video',
});

try {
  const result = await analyzeVideo(videoBuffer);
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('error');
  Sentry.captureException(error);
} finally {
  transaction.finish();
}
```

---

## 💰 成本优化

### 1. API 成本优化

#### OpenAI
```typescript
// 使用更便宜的模型
const model = userPlan === 'premium' ? 'gpt-4o' : 'gpt-3.5-turbo';

// 限制 token 使用
const response = await openai.chat.completions.create({
  model,
  messages,
  max_tokens: 1000, // 限制输出长度
  temperature: 0.7,
});
```

#### AssemblyAI
```typescript
// 批量处理降低成本
async function batchTranscribe(videos: Buffer[]) {
  const results = await Promise.all(
    videos.map(video => assemblyai.transcribe(video))
  );
  return results;
}
```

### 2. 存储成本优化

```typescript
// 定期清理过期文件
async function cleanupOldFiles() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 删除旧的临时文件
  await supabase
    .from('uploads')
    .delete()
    .lt('created_at', thirtyDaysAgo.toISOString())
    .eq('type', 'temporary');
}
```

### 3. 带宽成本优化

```typescript
// 压缩视频
async function compressVideo(videoBuffer: Buffer): Promise<Buffer> {
  // 使用 ffmpeg 压缩
  return await ffmpeg.compress(videoBuffer, {
    videoBitrate: '1M',
    audioBitrate: '128k',
  });
}

// 使用 CDN 缓存
// vercel.json
{
  "headers": [
    {
      "source": "/api/reports/:id",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, s-maxage=3600"
        }
      ]
    }
  ]
}
```

---

## 🎯 扩展检查清单

准备扩展前检查：

### 技术准备
- [ ] 实施了缓存策略
- [ ] 优化了数据库查询
- [ ] 添加了性能监控
- [ ] 实施了错误追踪
- [ ] 配置了自动扩展
- [ ] 进行了负载测试
- [ ] 优化了 API 调用

### 架构准备
- [ ] 评估了当前架构限制
- [ ] 设计了扩展方案
- [ ] 准备了降级策略
- [ ] 配置了备份方案
- [ ] 文档已更新

### 运维准备
- [ ] 设置了监控告警
- [ ] 准备了应急预案
- [ ] 配置了自动恢复
- [ ] 培训了运维团队
- [ ] 建立了沟通渠道

---

## 📚 推荐资源

- [Vercel 最佳实践](https://vercel.com/docs/concepts/solutions/best-practices)
- [Scaling Node.js Applications](https://blog.risingstack.com/node-js-at-scale-understanding-node-js-event-loop/)
- [Database Indexing Best Practices](https://use-the-index-luke.com/)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)
- [System Design Primer](https://github.com/donnemartin/system-design-primer)

---

**扩展是一个渐进的过程，根据实际需求逐步优化！** 🚀

