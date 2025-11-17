# 🚀 开始部署 Zeabur 数据库

> **当前状态：** 应用已部署，但缺少 `DATABASE_URL` 环境变量  
> **解决方案：** 在 Zeabur 上添加 PostgreSQL 服务（5 分钟完成）

---

## 📋 快速开始

### 选项 1：极简版（推荐新手）

直接查看：**[ZEABUR_DATABASE_QUICKSTART.md](ZEABUR_DATABASE_QUICKSTART.md)**

这是一个 5 分钟的快速操作清单，包含：
- ✅ 4 个简单步骤
- ✅ 复制粘贴即可的 SQL 脚本
- ✅ 验证方法和常见问题

---

### 选项 2：详细版（推荐深入了解）

查看：**[ZEABUR_DATABASE_SETUP.md](ZEABUR_DATABASE_SETUP.md)**

这是完整的部署指南，包含：
- 📖 6 个章节的详细说明
- 🔧 故障排查步骤
- 📊 数据库管理最佳实践
- 🆘 常见问题解答

---

### 选项 3：检查清单版（推荐打印使用）

查看：**[docs/deployment/ZEABUR_DATABASE_CHECKLIST.md](docs/deployment/ZEABUR_DATABASE_CHECKLIST.md)**

这是可打印的检查清单，包含：
- ☑️ 5 个部署阶段
- ☑️ 每个步骤的复选框
- ☑️ 故障排查流程
- ☑️ 部署记录表格

---

## 🎯 核心步骤（30 秒概览）

1. **添加 PostgreSQL 服务**  
   Zeabur 控制台 → Add Service → PostgreSQL

2. **初始化数据库表**  
   PostgreSQL Web Console → 执行 `database/init.sql`

3. **重启应用**  
   应用服务 → Redeploy

4. **验证连接**  
   查看应用日志 → 确认 "✅ 数据库连接成功"

---

## 📁 相关文件

### 部署文档
- `ZEABUR_DATABASE_QUICKSTART.md` - 5分钟快速部署
- `ZEABUR_DATABASE_SETUP.md` - 完整部署指南
- `docs/deployment/ZEABUR_DATABASE_CHECKLIST.md` - 检查清单

### 数据库脚本
- `database/init.sql` - 初始化脚本（一次性执行）
- `database/create_users_table.sql` - 用户表（单独执行）
- `database/create_otps_table.sql` - 验证码表（单独执行）
- `database/create_reports_table.sql` - 报告表（单独执行）

### 其他参考
- `database/README.md` - 数据库设计说明
- `ZEABUR_DEPLOYMENT.md` - Zeabur 部署总览
- `说明文档.md` - 项目全生命周期管理文档

---

## ❓ 常见问题

### Q1: 为什么需要数据库？

**A:** 你的应用需要数据库来存储：
- 👤 用户账号信息（邮箱、密码）
- 🔐 邮箱验证码（OTP）
- 📊 视频分析报告

没有数据库，用户无法注册登录，也无法保存分析结果。

---

### Q2: 会产生费用吗？

**A:** Zeabur PostgreSQL 服务：
- 🆓 **免费套餐**：包含基础资源，适合开发和小规模使用
- 💰 **付费套餐**：按使用量计费，可在控制台查看当前用量

建议先使用免费套餐测试，根据实际需求升级。

---

### Q3: 数据会丢失吗？

**A:** Zeabur PostgreSQL 提供：
- ✅ 自动每日备份
- ✅ 手动快照功能
- ✅ 高可用性保障

正常使用不会丢失数据。建议定期检查备份状态。

---

### Q4: 部署失败怎么办？

**A:** 按以下顺序排查：

1. **检查服务状态**  
   PostgreSQL 和应用服务都应该是 "Running"（绿色）

2. **查看应用日志**  
   Logs 标签 → 查找错误信息

3. **参考故障排查**  
   每个文档都包含"常见问题"章节

4. **重启服务**  
   大部分问题可以通过 Redeploy 解决

---

## 🎉 部署成功后

完成数据库部署后，你的应用将支持：

- ✅ **用户注册与登录**  
  邮箱验证码 + 密码登录

- ✅ **身份认证**  
  JWT Token 安全验证

- ✅ **报告存储**  
  视频分析结果持久化保存

- ✅ **历史记录**  
  用户可查看过往分析报告

---

## 📞 需要帮助？

- 📖 查看详细文档：[ZEABUR_DATABASE_SETUP.md](ZEABUR_DATABASE_SETUP.md)
- 🔍 查看项目说明：[说明文档.md](说明文档.md)
- 🌐 Zeabur 官方文档：https://zeabur.com/docs

---

## 🚀 现在就开始！

选择一个文档，跟着步骤操作，5 分钟内完成数据库部署！

**推荐：** [ZEABUR_DATABASE_QUICKSTART.md](ZEABUR_DATABASE_QUICKSTART.md)

