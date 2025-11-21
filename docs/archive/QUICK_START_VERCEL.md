# Vercel 快速部署指南

**5 分钟内完成部署！**

## 🎯 目标

本指南将帮助你在 5 分钟内将应用部署到 Vercel，适合 200 用户规模。

## 📋 前置要求

1. ✅ Vercel 账号（[注册](https://vercel.com/signup)）
2. ✅ OpenAI API Key（[获取](https://platform.openai.com/api-keys)）
3. ✅ AssemblyAI API Key（[获取](https://www.assemblyai.com/)）
4. ✅ Git 仓库（GitHub/GitLab/Bitbucket）

## 🚀 快速部署（3 种方法）

### 方法 1: 一键部署（最快）

1. 点击下方按钮：

[![部署到 Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/your-repo)

2. 连接 Git 仓库
3. 添加环境变量：
   ```
   OPENAI_API_KEY=sk-...
   ASSEMBLYAI_API_KEY=...
   ```
4. 点击 "Deploy"

✅ 完成！

### 方法 2: 使用 CLI（推荐）

```bash
# 1. 安装 CLI
npm install -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel --prod

# 4. 设置环境变量
vercel env add OPENAI_API_KEY production
vercel env add ASSEMBLYAI_API_KEY production
```

✅ 完成！

### 方法 3: 使用自动化脚本

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/your-repo.git
cd your-repo

# 2. 安装依赖
npm install

# 3. 创建 .env 文件
cat > .env << EOF
OPENAI_API_KEY=sk-...
ASSEMBLYAI_API_KEY=...
EOF

# 4. 运行部署脚本
chmod +x scripts/deploy-vercel.sh
./scripts/deploy-vercel.sh production
```

✅ 完成！

## ✅ 验证部署

### 1. 检查健康状态

```bash
curl https://your-app.vercel.app/api/health
```

期望响应：
```json
{
  "status": "ok",
  "services": {
    "openai": true,
    "assemblyai": true
  }
}
```

### 2. 访问应用

打开浏览器访问：`https://your-app.vercel.app`

### 3. 测试功能

1. 上传测试视频
2. 点击"生成报告"
3. 等待分析完成
4. 查看结果

## 🎉 成功！

你的应用已成功部署到 Vercel！

## 📊 下一步

### 立即操作
- [ ] 自定义域名（Vercel Dashboard → Settings → Domains）
- [ ] 启用 Vercel Analytics（Dashboard → Analytics）
- [ ] 设置监控告警

### 性能优化
- [ ] 配置 CDN 缓存
- [ ] 实施 Rate Limiting
- [ ] 优化图片资源

### 扩展准备
- [ ] 阅读 [性能优化指南](PERFORMANCE_GUIDE.md)
- [ ] 阅读 [扩展性指南](SCALING_GUIDE.md)
- [ ] 设置监控服务（Sentry/DataDog）

## 🔍 常见问题

### Q: 部署失败怎么办？
A: 查看构建日志：`vercel logs [deployment-url]`

### Q: API 返回 404？
A: 检查 `vercel.json` 配置和 `api/` 目录结构

### Q: 环境变量不生效？
A: 重新部署：`vercel --prod`

### Q: 函数超时？
A: 升级到 Pro 计划（60 秒限制）

## 📚 更多资源

- 📖 [完整部署指南](VERCEL_DEPLOYMENT.md)
- ✅ [部署检查清单](../DEPLOYMENT_CHECKLIST.md)
- ⚡ [性能优化指南](PERFORMANCE_GUIDE.md)
- 📈 [扩展性指南](SCALING_GUIDE.md)
- 🐛 [故障排除](TROUBLESHOOTING.md)

## 💡 提示

### 节省成本
- 使用 Upstash Redis 免费层
- 启用缓存减少 API 调用
- 优化视频文件大小

### 提升性能
- 选择就近的区域（香港/新加坡）
- 启用 Vercel Edge Network
- 使用 CDN 加速静态资源

### 安全建议
- 定期轮换 API Keys
- 实施 Rate Limiting
- 监控异常请求

## 🆘 获取帮助

遇到问题？
- 📧 查看 [故障排除文档](TROUBLESHOOTING.md)
- 💬 访问 [Vercel 社区](https://github.com/vercel/vercel/discussions)
- 🐛 提交 Issue

---

**部署愉快！** 🚀

最后更新：2025-11-06

