# 🚀 Vercel 部署快速参考

## 一键部署

```bash
vercel --prod
```

## 常用命令

```bash
# 登录
vercel login

# 预览部署
vercel

# 生产部署
vercel --prod

# 查看日志
vercel logs

# 查看日志（实时）
vercel logs --follow

# 查看域名
vercel domains

# 查看环境变量
vercel env ls

# 添加环境变量
vercel env add VARIABLE_NAME production

# 删除环境变量
vercel env rm VARIABLE_NAME production

# 查看部署列表
vercel ls

# 回滚部署
vercel rollback
```

## 环境变量

必需的环境变量：

```bash
OPENAI_API_KEY          # OpenAI API 密钥
ASSEMBLYAI_API_KEY      # AssemblyAI API 密钥
NODE_ENV=production     # 运行环境
```

可选的环境变量：

```bash
SUPABASE_URL            # Supabase 项目 URL
SUPABASE_ANON_KEY       # Supabase 匿名密钥
USE_MOCK_ANALYSIS=false # 是否使用模拟数据
```

## 健康检查

```bash
curl https://your-app.vercel.app/api/health
```

## 文档链接

- 📝 [部署总结](VERCEL_DEPLOYMENT_SUMMARY.md)
- ⚡ [快速开始](DEPLOY.md)
- ✅ [检查清单](DEPLOYMENT_CHECKLIST.md)
- 📖 [完整指南](docs/VERCEL_DEPLOYMENT.md)
- 💰 [成本分析](docs/COST_ESTIMATION.md)

## 支持

- 📧 Vercel 支持: https://vercel.com/support
- 📖 Vercel 文档: https://vercel.com/docs
- 💬 社区: https://github.com/vercel/vercel/discussions

---

**快速参考** | 最后更新: 2025-11-06

