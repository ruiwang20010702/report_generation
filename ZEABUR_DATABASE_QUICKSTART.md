# Zeabur 数据库部署 - 快速操作清单

> 📌 **5 分钟完成数据库部署**

## ✅ 操作步骤

### 第 1 步：添加 PostgreSQL 服务（2 分钟）

1. 打开 [Zeabur 控制台](https://zeabur.com)
2. 进入你的项目：**51talkreportgeneration**
3. 点击 **"Add Service"** 按钮
4. 选择 **"Prebuilt"** 标签
5. 找到并点击 **"PostgreSQL"**
6. 等待服务创建完成（绿色 "Running" 状态）

✅ **完成后，`DATABASE_URL` 会自动注入到你的应用中！**

---

### 第 2 步：初始化数据库表（2 分钟）

1. 点击 PostgreSQL 服务卡片
2. 点击 **"Console"** 或 **"Connect"** 标签
3. 选择 **"Web Console"**（在线 SQL 编辑器）
4. 复制粘贴以下 SQL 并执行：

```sql
-- 创建 users 表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 创建 otps 表（验证码）
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(code);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- 创建 reports 表（分析报告）
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT,
  transcript TEXT,
  analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
```

5. 验证表创建成功：

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**预期结果：** 应该看到 `otps`, `reports`, `users` 三张表

---

### 第 3 步：重启应用服务（1 分钟）

1. 返回 Zeabur 项目页面
2. 点击你的应用服务卡片
3. 点击右上角的 **"⋯"** 菜单
4. 选择 **"Redeploy"**
5. 等待重新部署完成

---

### 第 4 步：验证数据库连接（1 分钟）

#### 方法 1：查看应用日志

1. 点击应用服务卡片
2. 进入 **"Logs"** 标签
3. 查找以下日志：

```
✅ 数据库连接成功: 2025-11-12T...
```

#### 方法 2：测试健康检查接口

```bash
curl https://your-app.zeabur.app/api/analysis/health
```

**成功响应示例：**
```json
{
  "status": "ok",
  "database": "connected",
  ...
}
```

#### 方法 3：测试用户注册

```bash
# 发送验证码
curl -X POST https://your-app.zeabur.app/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**成功响应示例：**
```json
{
  "message": "验证码已发送",
  "code": "123456"
}
```

然后在 PostgreSQL Web Console 中查询：

```sql
SELECT email, code, expires_at 
FROM otps 
WHERE email = 'test@example.com' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## 🎉 完成！

数据库部署成功后，你的应用现在支持：

- ✅ 用户注册与登录（邮箱验证码 + 密码）
- ✅ JWT 身份认证
- ✅ 视频分析报告存储
- ✅ 用户历史记录查询

---

## ❌ 常见问题

### 问题：日志显示 "数据库配置未设置"

**原因：** `DATABASE_URL` 未注入

**解决：**
1. 确认 PostgreSQL 服务状态为 "Running"
2. 重启应用服务（Redeploy）
3. 等待 2-3 分钟后重试

### 问题：连接超时（ETIMEDOUT）

**解决：**
1. 检查 PostgreSQL 和应用是否在同一个项目中
2. 等待几分钟（新服务需要初始化时间）
3. 重启应用服务

### 问题：表已存在错误

**解决：** 这是正常的！SQL 使用了 `IF NOT EXISTS`，重复执行不会有问题。

---

## 📚 详细文档

- [完整部署指南](ZEABUR_DATABASE_SETUP.md) - 包含故障排查和最佳实践
- [数据库设计说明](database/README.md) - 表结构和字段说明
- [Zeabur 部署总览](ZEABUR_DEPLOYMENT.md) - 完整的部署流程

---

## 🆘 需要帮助？

如果遇到问题：
1. 查看应用 Logs 标签的错误信息
2. 查看 PostgreSQL Metrics 标签的运行状态
3. 参考 [ZEABUR_DATABASE_SETUP.md](ZEABUR_DATABASE_SETUP.md) 的故障排查部分

