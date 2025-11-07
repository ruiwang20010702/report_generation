# 🚀 快速部署指南

**3 步完成 Vercel 部署！**

## 步骤 1: 安装 CLI

```bash
npm install -g vercel
vercel login
```

## 步骤 2: 部署

```bash
vercel --prod
```

## 步骤 3: 设置环境变量

```bash
vercel env add OPENAI_API_KEY production
vercel env add ASSEMBLYAI_API_KEY production
```

## ✅ 验证

```bash
curl https://your-app.vercel.app/api/health
```

---

## 📖 详细文档

需要更多帮助？查看：

1. **[部署总结](VERCEL_DEPLOYMENT_SUMMARY.md)** - 完整概览 ⭐
2. **[5 分钟快速开始](docs/QUICK_START_VERCEL.md)** - 新手友好
3. **[部署检查清单](DEPLOYMENT_CHECKLIST.md)** - 逐步验证
4. **[完整部署指南](docs/VERCEL_DEPLOYMENT.md)** - 详细步骤

---

## 💰 成本预估

200 用户规模：**~$500/月**

- Vercel Pro: $20
- OpenAI: $150（优化后）
- AssemblyAI: $300（优化后）
- 监控: $26

详见 [成本分析](docs/COST_ESTIMATION.md)

---

## 🎯 适用规模

- 👥 200 日活用户
- 📊 500-600 次分析/天
- ⚡ 20 并发请求/分钟
- 📈 99% 可用性

---

**就这么简单！** 🎉

有问题？查看 [故障排除](docs/TROUBLESHOOTING.md)

