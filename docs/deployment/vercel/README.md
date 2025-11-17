# Vercel 配置归档

> ⚠️ **注意**：本目录包含的 Vercel 相关配置文件已归档，**不推荐继续使用 Vercel 进行部署**。

## 归档原因

项目已迁移到 **Zeabur** 平台进行部署，原因如下：

1. **数据库连接**：Zeabur 自动注入 `DATABASE_URL`，无需手动配置
2. **简化部署**：单服务架构，前后端一体化部署
3. **容器支持**：原生支持 Docker 容器部署
4. **开发体验**：更好的日志查看和环境变量管理

## 归档文件

- `vercel.json` - Vercel 部署配置文件
- `.vercelignore` - Vercel 忽略文件配置

## 推荐部署方式

请使用以下部署方式之一：

1. **Zeabur**（推荐）：参考项目根目录的 `QUICKSTART_ZEABUR.md`
2. **Docker 容器**：使用项目根目录的 `Dockerfile`
3. **传统部署**：参考 `docs/deployment/DEPLOY.md`

## 迁移指南

如果您当前使用 Vercel 部署，可以按以下步骤迁移到 Zeabur：

1. 在 Zeabur 创建新项目
2. 连接 GitHub 仓库
3. 添加 PostgreSQL 服务
4. 配置环境变量（参考 `QUICKSTART_ZEABUR.md`）
5. 执行数据库初始化脚本 `database/init.sql`
6. 部署并验证

---

归档时间：2025-11-17

