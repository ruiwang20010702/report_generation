# Vercel 部署检查清单

使用本检查清单确保顺利部署到 Vercel。

## 📋 部署前准备

### 1. 账号与权限
- [ ] 已创建 Vercel 账号
- [ ] 已选择合适的计划（推荐 Pro，$20/月）
- [ ] 已连接 Git 仓库（GitHub/GitLab/Bitbucket）

### 2. API Keys 准备
- [ ] 已获取 OpenAI API Key
- [ ] 已获取 AssemblyAI API Key
- [ ] （可选）已设置 Supabase 凭证
- [ ] 已测试所有 API Keys 有效

### 3. 代码准备
- [ ] 代码已推送到 Git 仓库
- [ ] 本地构建成功：`npm run build`
- [ ] 无 TypeScript 错误：`npm run lint`
- [ ] 所有依赖已安装：`npm install`
- [ ] 已创建 `vercel.json` 配置文件

### 4. 环境变量准备
创建 `.env.production` 文件（不要提交到 Git）：

```bash
# AI Services
OPENAI_API_KEY=sk-...
ASSEMBLYAI_API_KEY=...

# Database (可选)
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# Mode
USE_MOCK_ANALYSIS=false
NODE_ENV=production
```

---

## 🚀 部署步骤

### 方法 1: 使用自动化脚本（推荐）

```bash
# 给脚本执行权限
chmod +x scripts/deploy-vercel.sh

# 部署到预览环境
./scripts/deploy-vercel.sh preview

# 部署到生产环境
./scripts/deploy-vercel.sh production
```

### 方法 2: 使用 Vercel CLI

#### Step 1: 安装 CLI
```bash
npm install -g vercel
```

#### Step 2: 登录
```bash
vercel login
```

#### Step 3: 首次部署
```bash
# 预览部署
vercel

# 生产部署
vercel --prod
```

#### Step 4: 设置环境变量
```bash
vercel env add OPENAI_API_KEY production
vercel env add ASSEMBLYAI_API_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
```

### 方法 3: 使用 Vercel Dashboard

1. 访问 https://vercel.com/dashboard
2. 点击 "Add New" → "Project"
3. 导入 Git 仓库
4. 配置项目设置：
   - Framework Preset: `Other`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. 添加环境变量（见下方）
6. 点击 "Deploy"

---

## ⚙️ 环境变量配置

在 Vercel Dashboard 的 Settings → Environment Variables 中添加：

| 变量名 | 值 | 环境 |
|--------|----|----- |
| `OPENAI_API_KEY` | `sk-...` | Production, Preview, Development |
| `ASSEMBLYAI_API_KEY` | `...` | Production, Preview, Development |
| `SUPABASE_URL` | `https://...` | Production, Preview, Development |
| `SUPABASE_ANON_KEY` | `...` | Production, Preview, Development |
| `USE_MOCK_ANALYSIS` | `false` | Production |
| `NODE_ENV` | `production` | Production |

**注意**：
- 每个变量可以分别为 Production、Preview、Development 环境设置不同的值
- 敏感信息永远不要提交到 Git

---

## ✅ 部署后验证

### 1. 健康检查
```bash
# 替换为你的实际域名
curl https://your-app.vercel.app/api/health
```

期望响应：
```json
{
  "status": "ok",
  "timestamp": "2025-11-06T...",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "openai": true,
    "assemblyai": true
  }
}
```

### 2. 前端测试
- [ ] 访问 https://your-app.vercel.app
- [ ] 页面正常加载
- [ ] 无控制台错误
- [ ] UI 正常显示

### 3. 功能测试
- [ ] 上传测试视频（小文件 < 10MB）
- [ ] 视频分析成功完成
- [ ] 结果正确显示
- [ ] 报告可以导出

### 4. 性能测试
- [ ] 页面加载时间 < 3 秒
- [ ] API 响应时间 < 5 秒（健康检查）
- [ ] 分析完成时间 < 60 秒

### 5. 监控设置
- [ ] Vercel Analytics 已启用
- [ ] 错误追踪已配置（Sentry）
- [ ] 日志可以正常查看

---

## 🔍 问题排查

### 部署失败
```bash
# 查看构建日志
vercel logs [deployment-url]

# 检查 TypeScript 错误
npm run lint

# 检查构建
npm run build
```

### API 返回 404
- [ ] 检查 `vercel.json` 的 rewrites 配置
- [ ] 确认 `api/` 目录结构正确
- [ ] 查看 Vercel Dashboard 的 Functions 页面

### 环境变量未生效
- [ ] 重新部署：`vercel --prod`
- [ ] 检查变量是否设置到正确的环境
- [ ] 检查变量名拼写是否正确

### 函数超时
- [ ] 升级到 Pro 计划（60 秒限制）
- [ ] 优化视频处理逻辑
- [ ] 减小测试文件大小

### CORS 错误
- [ ] 检查 `vercel.json` 的 headers 配置
- [ ] 确认 API 处理 OPTIONS 请求
- [ ] 检查前端 API 调用 URL

---

## 📊 监控与维护

### 日常监控
```bash
# 实时日志
vercel logs --follow

# 生产环境日志
vercel logs --prod

# 查看特定部署
vercel logs [deployment-url]
```

### Vercel Dashboard 检查
定期检查以下指标：
- 📈 **Analytics**: 请求量、响应时间
- 🚨 **Errors**: 错误率、错误详情
- ⚡ **Performance**: 函数执行时间
- 💸 **Usage**: 带宽、函数调用次数

### 性能优化建议
- [ ] 启用 Vercel Analytics
- [ ] 配置 CDN 缓存
- [ ] 实施 Rate Limiting
- [ ] 监控 API 配额使用

---

## 🔐 安全检查

### 部署安全
- [ ] API Keys 未提交到 Git
- [ ] 环境变量正确配置
- [ ] CORS 策略正确设置
- [ ] Rate Limiting 已启用

### 运行时安全
- [ ] 文件上传大小限制
- [ ] 文件类型验证
- [ ] 用户输入验证
- [ ] 错误消息不泄露敏感信息

---

## 📈 扩展准备

### 当前配置支持
- 👥 200 日活用户
- 📊 500-600 次分析/天
- ⚡ 20 并发请求

### 扩展信号
当出现以下情况时考虑扩展：
- 🔴 错误率 > 5%
- 🔴 响应时间 > 10 秒
- 🔴 用户增长 > 50%/月

### 扩展方案
参考：
- [性能优化指南](docs/PERFORMANCE_GUIDE.md)
- [扩展性指南](docs/SCALING_GUIDE.md)

---

## 📞 获取帮助

### 官方资源
- 📖 [Vercel 文档](https://vercel.com/docs)
- 💬 [Vercel 社区](https://github.com/vercel/vercel/discussions)
- 📧 [Vercel 支持](https://vercel.com/support)

### 项目文档
- [部署指南](docs/VERCEL_DEPLOYMENT.md)
- [性能优化](docs/PERFORMANCE_GUIDE.md)
- [故障排除](docs/TROUBLESHOOTING.md)

---

## ✨ 部署完成后

恭喜！你已成功部署到 Vercel。

下一步：
1. 📊 监控应用性能
2. 🧪 邀请用户测试
3. 📈 收集反馈
4. 🔄 持续优化

**祝你使用愉快！** 🚀

---

**最后更新**: 2025-11-06
**适用版本**: v1.0.0
**支持规模**: 200 用户

