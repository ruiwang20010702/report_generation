# Sentry 在中国的使用指南

## 📊 核心结论

✅ **官方Sentry在中国可以使用**，但需要了解以下情况：

- ⚠️ 访问速度较慢（服务器在海外）
- ⚠️ 可能偶尔连接不稳定
- ✅ **不影响应用性能**（错误上传是异步的）
- ✅ 免费额度充足（5,000 errors/月）
- ✅ 如果上传失败，SDK会自动重试

---

## 🎯 三种方案对比

| 方案 | 访问速度 | 稳定性 | 成本 | 维护成本 | 推荐场景 |
|------|---------|--------|------|---------|---------|
| **官方Sentry** | 慢 ⚠️ | 较稳定 | 免费/付费 | 零 | 开发、初期 |
| **阿里云ARMS** | 快 ✅ | 很稳定 | 有免费额度 | 低 | 生产环境 |
| **自建Sentry** | 快 ✅ | 很稳定 | ¥100-200/月 | 中 | 大规模 |

---

## 方案1：使用官方Sentry（推荐初期）

### 优点
- ✅ 快速开始，无需额外部署
- ✅ **永久免费**额度（5,000 errors/月）
  - 前14天：Business试用（全功能，无限events）
  - 之后：自动降级到免费Developer计划
- ✅ 功能完整，持续更新
- ✅ 文档丰富，社区活跃
- ✅ 零维护成本

### 缺点
- ⚠️ 国内访问较慢（3-5秒延迟）
- ⚠️ 可能偶尔连接超时
- ⚠️ Web控制台加载慢

### 配置方法

#### 1. 注册账号

访问：https://sentry.io/signup/

可能需要：
- 魔法上网工具（注册时）
- 或使用香港节点
- 或直接尝试（有时可以直接访问）

#### 2. 创建项目

1. 登录后，点击"Create Project"
2. 选择平台：
   - **Backend**: Node.js / Express
   - **Frontend**: React
3. 设置项目名称：如 `51talk-backend`、`51talk-frontend`
4. 复制 DSN

#### 3. 配置环境变量

```bash
# .env 配置
SENTRY_DSN=https://xxx@o123456.ingest.sentry.io/xxx
VITE_SENTRY_DSN=https://xxx@o123456.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production
```

#### 4. 验证配置

```bash
# 启动应用
npm run dev:all

# 触发一个测试错误，查看是否上传成功
# 登录 Sentry 控制台查看
```

### 优化建议

**1. 增加超时时间**（避免上传失败）

```typescript
// server/config/monitoring.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  
  // 增加超时时间
  transportOptions: {
    timeout: 10000, // 10秒
  },
  
  // 采样率（减少上传量）
  tracesSampleRate: 0.1, // 只采样10%的请求
});
```

**2. 设置离线缓存**（网络不稳定时）

```typescript
import { makeNodeTransport } from '@sentry/node';
import { makeOfflineTransport } from '@sentry/core';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  transport: makeOfflineTransport(makeNodeTransport),
  // 失败时会缓存，稍后重试
});
```

**3. 过滤敏感信息**

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  beforeSend(event) {
    // 移除敏感数据
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }
    return event;
  },
});
```

---

## 方案2：阿里云ARMS（推荐生产环境）

### 优点
- ✅ 国内访问快（<100ms）
- ✅ 非常稳定
- ✅ 与阿里云其他服务集成好
- ✅ 数据在国内，合规性好
- ✅ 有免费额度

### 缺点
- ⚠️ 需要配置和学习
- ⚠️ 功能不如Sentry完整
- ⚠️ 主要面向中国用户

### 配置方法

#### 1. 开通服务

访问：https://arms.console.aliyun.com/

1. 点击"立即开通"
2. 选择"前端监控"和"应用监控"
3. 同意服务协议

#### 2. 创建应用

**前端监控**：
1. 前端监控 → 应用列表 → 新建应用
2. 应用名称：`51talk-frontend`
3. 应用类型：Web
4. 获取监控代码

**后端监控**：
1. 应用监控 → 应用列表 → 新建应用
2. 应用名称：`51talk-backend`
3. 接入方式：Node.js
4. 安装SDK

#### 3. 安装SDK

```bash
# 前端
npm install @aliyun/rum-web --save

# 后端
npm install @aliyun/node-sdk-apm --save
```

#### 4. 前端集成

```typescript
// src/monitoring.ts
import ARMS from '@aliyun/rum-web';

ARMS.init({
  pid: '你的项目ID',
  endpoint: 'https://arms-retcode.aliyuncs.com/r.png',
  
  // 采样配置
  sample: 100, // 100%采样
  
  // 忽略特定错误
  ignore: {
    ignoreErrors: /Script error/i,
  },
  
  // 用户信息
  setUsername: (userId: string) => userId,
});

// API错误监控
ARMS.api({
  api: '/api/reports',
  success: true,
  time: 100,
  code: 200,
});
```

#### 5. 后端集成

```typescript
// server/monitoring/arms.ts
import { ApmClient } from '@aliyun/node-sdk-apm';

const apmClient = new ApmClient({
  endpoint: 'https://arms-apm.aliyuncs.com',
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
  appName: '51talk-backend',
});

// Express 中间件
export const armsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    apmClient.reportTrace({
      traceId: req.id,
      spanId: generateSpanId(),
      operationName: `${req.method} ${req.path}`,
      duration,
      tags: {
        httpMethod: req.method,
        httpUrl: req.path,
        httpStatusCode: res.statusCode,
      },
    });
  });
  
  next();
};
```

#### 6. 环境变量配置

```bash
# .env
ALIYUN_ACCESS_KEY_ID=你的AccessKey
ALIYUN_ACCESS_KEY_SECRET=你的Secret
ARMS_FRONTEND_PID=前端项目ID
ARMS_BACKEND_APP_NAME=51talk-backend
```

### 费用

**免费额度**（每月）：
- 前端监控：100万次PV
- 应用监控：100万次调用

**超出后**：
- 前端监控：¥0.02/千次
- 应用监控：¥0.01/千次

**估算**：
- 1000日活用户，每人10次操作 = 30万次/月
- 成本：免费额度内

---

## 方案3：自建Sentry（大规模使用）

### 优点
- ✅ 完全控制
- ✅ 无使用限制
- ✅ 数据完全私有
- ✅ 可以定制功能

### 缺点
- ⚠️ 需要维护服务器
- ⚠️ 需要2-4GB内存
- ⚠️ 需要技术能力
- ⚠️ 需要定期更新

### 部署步骤

#### 1. 准备服务器

**推荐配置**：
- CPU：2核
- 内存：4GB
- 硬盘：40GB
- 系统：Ubuntu 20.04 LTS

**云服务商**：
- 阿里云ECS（推荐）
- 腾讯云CVM
- Zeabur（Docker部署）

**成本**：¥100-200/月

#### 2. 安装Docker

```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 3. 部署Sentry

```bash
# 克隆自建版本
git clone https://github.com/getsentry/self-hosted.git
cd self-hosted

# 运行安装脚本
./install.sh

# 启动服务
docker-compose up -d
```

#### 4. 配置Nginx反向代理

```nginx
# /etc/nginx/sites-available/sentry
server {
    listen 80;
    server_name sentry.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 5. 配置HTTPS

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d sentry.yourdomain.com
```

#### 6. 创建项目并使用

1. 访问：https://sentry.yourdomain.com
2. 注册管理员账号
3. 创建项目
4. 获取DSN（格式：https://xxx@sentry.yourdomain.com/xxx）

#### 7. 应用中配置

```bash
# .env
SENTRY_DSN=https://xxx@sentry.yourdomain.com/xxx
SENTRY_ENVIRONMENT=production
```

---

## 🎯 决策流程图

```
开始
 │
 ├─ 现在是开发/测试阶段？
 │   └─ Yes → 使用官方Sentry或暂不配置 ✅
 │
 ├─ 用户量 < 1000/天？
 │   └─ Yes → 使用官方Sentry ✅
 │
 ├─ 需要与阿里云其他服务集成？
 │   └─ Yes → 使用阿里云ARMS ✅
 │
 ├─ 用户量 > 10000/天？
 │   └─ Yes → 考虑自建Sentry ✅
 │
 └─ 默认 → 使用官方Sentry ✅
```

---

## 💡 推荐路线

### 阶段1：开发和MVP（现在）

**使用官方Sentry或暂不配置**

```bash
# 方式1：不配置（最简单）
# .env 中不设置 SENTRY_DSN

# 方式2：使用官方Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx
```

✅ 理由：
- 快速开始
- 零成本
- 功能够用

---

### 阶段2：早期用户（100-1000日活）

**继续使用官方Sentry**

✅ 理由：
- 免费额度充足
- 虽然慢但不影响用户
- 节省维护成本

---

### 阶段3：增长期（1000-10000日活）

**迁移到阿里云ARMS**

```bash
npm install @aliyun/rum-web @aliyun/node-sdk-apm
```

✅ 理由：
- 国内访问快
- 更稳定
- 成本可控
- 与阿里云其他服务集成

---

### 阶段4：大规模（>10000日活）

**考虑自建Sentry**

✅ 理由：
- 完全控制
- 无使用限制
- 成本更低（相对付费Sentry）

---

## 🔧 实用技巧

### 1. 如果Sentry偶尔连接失败

```typescript
// server/config/monitoring.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // 设置重试
  transportOptions: {
    retries: 3,
    timeout: 10000,
  },
  
  // 失败时不影响应用
  beforeSend(event) {
    try {
      return event;
    } catch (error) {
      console.error('Sentry error:', error);
      return null; // 丢弃这个事件，不影响应用
    }
  },
});
```

### 2. 本地开发时关闭Sentry

```bash
# .env.development
# SENTRY_DSN=  # 留空或注释掉
```

### 3. 只在生产环境启用

```typescript
// server/config/monitoring.ts
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
  });
}
```

### 4. 监控Sentry自身状态

```typescript
// 添加健康检查
app.get('/api/health/sentry', (req, res) => {
  const sentryEnabled = !!process.env.SENTRY_DSN;
  const sentryWorking = Sentry.getCurrentHub().getClient()?.getOptions().enabled;
  
  res.json({
    enabled: sentryEnabled,
    working: sentryWorking,
    message: sentryEnabled ? 'Sentry is configured' : 'Sentry is not configured'
  });
});
```

---

## ❓ 常见问题

### Q1: Sentry完全连接不上怎么办？

**A**: 临时关闭，不影响应用：

```bash
# .env
# SENTRY_DSN=  # 注释掉即可
```

应用会正常运行，只是不会上传错误日志。

---

### Q2: 如何测试Sentry是否工作？

**A**: 触发一个测试错误：

```typescript
// 添加测试路由
app.get('/api/test/sentry', (req, res) => {
  try {
    throw new Error('This is a test error for Sentry');
  } catch (error) {
    Sentry.captureException(error);
    res.json({ message: 'Error sent to Sentry' });
  }
});
```

然后访问 `/api/test/sentry`，检查Sentry控制台是否收到错误。

---

### Q3: Sentry会影响应用性能吗？

**A**: 不会！原因：
- ✅ 错误上传是**异步**的
- ✅ 不阻塞主请求
- ✅ 即使上传失败，也不影响用户
- ✅ 可以设置采样率降低开销

---

### Q4: 官方Sentry和阿里云ARMS哪个好？

**A**: 取决于阶段：

| 特性 | 官方Sentry | 阿里云ARMS |
|------|-----------|-----------|
| **适合阶段** | 开发、初期 | 生产、增长期 |
| **访问速度** | 慢 | 快 |
| **免费额度** | 5K errors/月 | 100万次调用/月 |
| **功能完整性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **学习成本** | 低 | 中 |

---

### Q5: 需要同时配置前端和后端的监控吗？

**A**: 推荐同时配置：
- ✅ 前端监控：捕获UI错误、用户行为
- ✅ 后端监控：捕获API错误、性能问题
- ✅ 前后端关联：通过Request ID追踪完整请求链路

但如果预算有限，可以只配置后端（更关键）。

---

## 📚 相关资源

**官方文档**：
- Sentry Node.js: https://docs.sentry.io/platforms/node/
- Sentry React: https://docs.sentry.io/platforms/javascript/guides/react/
- 阿里云ARMS: https://help.aliyun.com/product/34364.html

**社区资源**：
- Sentry自建指南: https://github.com/getsentry/self-hosted
- ARMS最佳实践: https://help.aliyun.com/document_detail/90279.html

---

## ✅ 总结

### 现在（开发阶段）
**推荐**：暂不配置或使用官方Sentry  
**理由**：快速、简单、够用

### 上线后（生产环境）
**推荐**：继续官方Sentry或迁移到阿里云ARMS  
**理由**：稳定、专业、成本可控

### 大规模（10000+日活）
**推荐**：考虑自建Sentry  
**理由**：完全控制、成本更低

---

**记住**：Sentry是可选的，不影响核心功能。先让应用跑起来，监控可以之后再加！🚀

