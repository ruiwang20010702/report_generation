# Vercel 部署指南

本文档提供了将 51Talk 视频分析应用部署到 Vercel 的完整指南，适用于 200 用户规模。

## 📋 目录

- [前置要求](#前置要求)
- [快速部署](#快速部署)
- [环境变量配置](#环境变量配置)
- [性能优化](#性能优化)
- [限制与注意事项](#限制与注意事项)
- [监控与调试](#监控与调试)
- [常见问题](#常见问题)

---

## 前置要求

### 1. Vercel 账号
- 注册 [Vercel 账号](https://vercel.com/signup)
- 推荐使用 **Pro 计划**（$20/月），支持：
  - 更长的函数执行时间（60秒）
  - 更高的带宽限制
  - 更好的性能

### 2. API Keys
准备以下 API 密钥：
- **OpenAI API Key**（必需）：用于 AI 分析
- **AssemblyAI API Key**（必需）：用于语音转录
- **Supabase 凭证**（可选）：用于数据存储

### 3. 代码仓库
将代码推送到 GitHub、GitLab 或 Bitbucket

---

## 快速部署

### 方法 1：使用 Vercel CLI（推荐）

#### 1. 安装 Vercel CLI
```bash
npm install -g vercel
```

#### 2. 登录 Vercel
```bash
vercel login
```

#### 3. 部署项目
```bash
# 在项目根目录执行
vercel

# 生产环境部署
vercel --prod
```

#### 4. 配置环境变量
```bash
# 设置 OpenAI API Key
vercel env add OPENAI_API_KEY

# 设置 AssemblyAI API Key
vercel env add ASSEMBLYAI_API_KEY

# 设置其他环境变量（如需要）
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
```

### 方法 2：使用 Vercel Dashboard

#### 1. 导入 Git 仓库
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **"Add New"** → **"Project"**
3. 选择你的 Git 仓库
4. 点击 **"Import"**

#### 2. 配置项目设置
- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

#### 3. 添加环境变量
在 **"Environment Variables"** 部分添加：

```
OPENAI_API_KEY=your_openai_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
NODE_ENV=production

# 可选
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
USE_MOCK_ANALYSIS=false
```

#### 4. 部署
点击 **"Deploy"** 开始部署

---

## 环境变量配置

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | `sk-...` |
| `ASSEMBLYAI_API_KEY` | AssemblyAI API 密钥 | `...` |

### 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `USE_MOCK_ANALYSIS` | 是否使用模拟数据 | `false` |
| `SUPABASE_URL` | Supabase 项目 URL | - |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | - |
| `NODE_ENV` | 运行环境 | `production` |
| `HTTPS_PROXY` | HTTP 代理（如需要） | - | 

### 在 Vercel CLI 中设置环境变量

```bash
# 生产环境
vercel env add OPENAI_API_KEY production

# 预览环境
vercel env add OPENAI_API_KEY preview

# 开发环境
vercel env add OPENAI_API_KEY development

# 所有环境
vercel env add OPENAI_API_KEY
```

---

## 性能优化

### 1. 区域配置
在 `vercel.json` 中配置就近区域：

```json
{
  "regions": ["hkg1", "sin1"]
}
```

支持的亚太区域：
- `hkg1` - 香港
- `sin1` - 新加坡
- `syd1` - 悉尼
- `bom1` - 孟买
- `icn1` - 首尔

### 2. 函数配置
优化 Serverless Function 性能：

```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

**注意**：
- Hobby 计划：最大 10 秒
- Pro 计划：最大 60 秒
- Enterprise 计划：最大 300 秒

### 3. Rate Limiting
应用已内置基于内存的 Rate Limiting：
- 每个 IP 每分钟最多 10 次请求
- 生产环境建议使用 Redis（如 [Upstash](https://upstash.com/)）

升级到 Redis Rate Limiting：

```bash
# 安装依赖
npm install @upstash/redis

# 设置环境变量
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### 4. 缓存策略
为静态资源添加缓存：

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### 5. 文件上传优化
对于大型视频文件：
- 推荐使用 [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) 存储
- 或使用客户端直接上传到 S3/CloudFlare R2

---

## 限制与注意事项

### Vercel Serverless Functions 限制

#### Hobby 计划
- ⏱️ **执行时间**: 10 秒
- 💾 **内存**: 1024 MB
- 📦 **部署大小**: 100 MB
- 🌐 **带宽**: 100 GB/月

#### Pro 计划
- ⏱️ **执行时间**: 60 秒
- 💾 **内存**: 3008 MB
- 📦 **部署大小**: 250 MB
- 🌐 **带宽**: 1 TB/月

### 视频处理注意事项

1. **文件大小限制**
   - 请求体限制：4.5 MB（Hobby）/ 4.5 MB（Pro）
   - 建议视频文件 < 50 MB
   - 对于大文件，使用客户端直接上传

2. **处理时间**
   - 视频转录可能需要 30-60 秒
   - Pro 计划支持最长 60 秒执行时间
   - 对于更长的视频，考虑异步处理架构

3. **并发限制**
   - Hobby: 1 个并发
   - Pro: 10 个并发（默认）
   - Enterprise: 可自定义

### 200 用户规模建议

根据预计流量：
- **日活用户**: 200
- **平均每用户分析**: 2-3 次/天
- **总请求量**: ~500 次/天
- **峰值并发**: ~10-20 请求/分钟

**推荐配置**：
- ✅ **Vercel Pro 计划**（$20/月）
- ✅ **Redis Rate Limiting**（Upstash 免费层）
- ✅ **CDN 缓存**（Vercel 内置）
- ⚠️ 监控 OpenAI/AssemblyAI 的 API 配额

---

## 监控与调试

### 1. 查看日志
```bash
# 实时日志
vercel logs

# 特定部署
vercel logs [deployment-url]

# 生产环境
vercel logs --prod
```

### 2. Vercel Dashboard
访问 [Vercel Dashboard](https://vercel.com/dashboard) 查看：
- 📊 **分析**: 请求量、响应时间
- 🚨 **错误**: 错误率、错误详情
- ⚡ **性能**: 函数执行时间
- 💸 **使用量**: 带宽、函数调用次数

### 3. 健康检查
```bash
curl https://your-app.vercel.app/api/health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2025-11-06T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "openai": true,
    "assemblyai": true
  }
}
```

### 4. 性能监控
集成第三方监控服务：
- [Sentry](https://sentry.io/) - 错误追踪
- [LogRocket](https://logrocket.com/) - 会话回放
- [Datadog](https://www.datadoghq.com/) - APM 监控

---

## 常见问题

### Q1: 部署后 API 返回 404
**A**: 检查 `vercel.json` 中的 `rewrites` 配置是否正确。

### Q2: 函数超时
**A**: 
- 升级到 Pro 计划获得 60 秒执行时间
- 优化视频处理逻辑
- 考虑异步处理架构

### Q3: Rate Limit 错误
**A**: 
- 检查是否达到 Vercel 并发限制
- 检查 OpenAI/AssemblyAI API 配额
- 考虑实现请求队列

### Q4: 文件上传失败
**A**: 
- 检查文件大小是否超过 50 MB
- 确认 `bodyParser: false` 配置正确
- 考虑使用客户端直接上传

### Q5: CORS 错误
**A**: 
- 检查 `vercel.json` 中的 CORS 配置
- 确认 API 路由正确处理 OPTIONS 请求

### Q6: 环境变量不生效
**A**: 
- 重新部署：`vercel --prod`
- 检查变量是否设置到正确的环境
- 确认没有拼写错误

---

## 部署检查清单

部署前请确认：

- [ ] 代码已推送到 Git 仓库
- [ ] 已创建 Vercel 账号
- [ ] 已设置所有必需的环境变量
- [ ] 已测试本地构建：`npm run build`
- [ ] 已配置 `vercel.json`
- [ ] 已选择合适的 Vercel 计划
- [ ] 已配置区域（靠近用户）
- [ ] 已设置 Rate Limiting
- [ ] 已配置错误监控
- [ ] 已测试 API 健康检查

---

## 下一步

部署成功后：

1. 📊 **监控性能**: 观察 Dashboard 数据
2. 🧪 **测试功能**: 上传测试视频
3. 🔍 **检查日志**: 确保没有错误
4. 📈 **优化成本**: 根据使用量调整配置
5. 🔐 **安全审计**: 确保 API Keys 安全

---

## 支持与反馈

遇到问题？
- 📖 查看 [Vercel 文档](https://vercel.com/docs)
- 💬 访问 [Vercel 社区](https://github.com/vercel/vercel/discussions)
- 🐛 提交 Issue 到项目仓库

---

**部署愉快！** 🚀

