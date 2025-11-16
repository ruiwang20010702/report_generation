# 🚀 快速部署指南 - 阿里云 RDS 版本

## 一键部署到 Zeabur

### 前提条件 ✅
- [x] 阿里云 RDS PostgreSQL 数据库已创建
- [x] 数据库表已初始化
- [x] 本地测试连接成功

### 步骤 1: 提交代码

```bash
git add .
git commit -m "迁移到阿里云 RDS 数据库"
git push origin master
```

### 步骤 2: 在 Zeabur 控制台设置环境变量

登录 [Zeabur 控制台](https://zeabur.com)，找到您的项目，添加以下环境变量：

#### 必需变量（敏感信息）

```env
# 数据库密码
DB_PASSWORD=your_database_password

# JWT 密钥
JWT_SECRET=your_jwt_secret_here

# 阿里云配置
ALIYUN_ACCESS_KEY_ID=your_aliyun_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_aliyun_access_key_secret
ALIYUN_TINGWU_APP_KEY=your_tingwu_app_key

# AI 服务
GLM_API_KEY=your_glm_api_key

# 邮件服务
SMTP_PASS=your_smtp_password

# 监控服务
SENTRY_DSN=your_sentry_dsn
VITE_SENTRY_DSN=your_sentry_dsn
```

### 步骤 3: 触发部署

代码推送后，Zeabur 会自动部署。您也可以在控制台手动触发重新部署。

### 步骤 4: 验证部署

```bash
# 检查健康状态
curl https://your-app.zeabur.app/api/health

# 预期输出：
# {"status":"ok","timestamp":"2025-11-15T..."}
```

---

## 本地开发

### 启动后端服务器

```bash
npm run dev:server
```

### 启动前端开发服务器

```bash
npm run dev
```

### 测试数据库连接

```bash
npm run test:db
```

---

## 常见问题

### Q: 部署失败，显示数据库连接错误？
**A:** 检查以下几点：
1. Zeabur 控制台中的 `DB_PASSWORD` 是否设置正确
2. 阿里云 RDS 白名单是否包含 Zeabur 的 IP
3. 数据库是否可以从公网访问

### Q: 如何查看 Zeabur 的出口 IP？
**A:** 在 Zeabur 控制台的项目设置中可以找到出口 IP 地址，将其添加到阿里云 RDS 白名单。

### Q: 能否使用 VPC 专网连接？
**A:** 可以，但需要：
1. 阿里云 RDS 和 Zeabur 在同一区域
2. 配置 VPC 对等连接
3. 调整安全组规则

---

## 下一步

- [ ] 配置域名
- [ ] 设置 HTTPS 证书
- [ ] 配置 CDN 加速
- [ ] 启用自动备份
- [ ] 设置告警通知

---

## 技术支持

如遇到问题，请查看：
- [完整迁移文档](ALIYUN_RDS_MIGRATION.md)
- [数据库设置说明](database/SETUP_INSTRUCTIONS.md)
- [环境配置指南](ENVIRONMENT_SETUP_GUIDE.md)

