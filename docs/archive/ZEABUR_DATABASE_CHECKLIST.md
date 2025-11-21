# Zeabur 数据库部署检查清单

## 📋 部署前检查

- [ ] 已有 Zeabur 账号并登录
- [ ] 应用服务已成功部署并运行
- [ ] 了解当前应用的域名地址

---

## 🗄️ 数据库部署流程

### ✅ 阶段 1：创建 PostgreSQL 服务

- [ ] **1.1** 进入 Zeabur 项目页面
- [ ] **1.2** 点击 "Add Service" 按钮
- [ ] **1.3** 选择 "Prebuilt" → "PostgreSQL"
- [ ] **1.4** 等待服务状态变为 "Running"（绿色）
- [ ] **1.5** 确认服务卡片显示 PostgreSQL 图标

**预计耗时：** 1-2 分钟

---

### ✅ 阶段 2：验证环境变量自动注入

- [ ] **2.1** 点击应用服务卡片
- [ ] **2.2** 进入 "Variables" 或 "Environment" 标签
- [ ] **2.3** 确认存在 `DATABASE_URL` 变量（由 Zeabur 自动添加）
- [ ] **2.4** 确认 `DATABASE_URL` 的值格式为：`postgresql://...`

**注意：** 如果没有看到 `DATABASE_URL`，等待 1-2 分钟后刷新页面

**预计耗时：** 1 分钟

---

### ✅ 阶段 3：初始化数据库表结构

- [ ] **3.1** 点击 PostgreSQL 服务卡片
- [ ] **3.2** 点击 "Console" 或 "Connect" 标签
- [ ] **3.3** 选择 "Web Console"（打开在线 SQL 编辑器）
- [ ] **3.4** 复制 `database/init.sql` 的内容
- [ ] **3.5** 粘贴到 SQL 编辑器并执行
- [ ] **3.6** 确认执行成功（无错误提示）
- [ ] **3.7** 执行验证查询：
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' ORDER BY table_name;
  ```
- [ ] **3.8** 确认返回结果包含：`otps`, `reports`, `users`

**预计耗时：** 2-3 分钟

---

### ✅ 阶段 4：重启应用服务

- [ ] **4.1** 返回 Zeabur 项目页面
- [ ] **4.2** 点击应用服务卡片
- [ ] **4.3** 点击右上角 "⋯" 菜单
- [ ] **4.4** 选择 "Redeploy"
- [ ] **4.5** 等待部署完成（状态变为 "Running"）

**预计耗时：** 1-2 分钟

---

### ✅ 阶段 5：验证数据库连接

#### 方法 A：查看应用日志

- [ ] **5.1** 点击应用服务卡片
- [ ] **5.2** 进入 "Logs" 标签
- [ ] **5.3** 查找以下日志行：
  - `🔗 正在连接数据库...`
  - `✅ 连接已建立，执行查询...`
  - `✅ 数据库连接成功: 2025-11-12T...`

**成功标志：** 看到 "✅ 数据库连接成功"

**失败标志：** 看到 "❌ 数据库连接失败" 或 "⚠️ 数据库配置未设置"

#### 方法 B：测试健康检查接口

- [ ] **5.4** 在终端执行：
  ```bash
  curl https://your-app.zeabur.app/api/analysis/health
  ```
- [ ] **5.5** 确认响应包含：`"database": "connected"`

#### 方法 C：测试用户注册流程

- [ ] **5.6** 发送验证码：
  ```bash
  curl -X POST https://your-app.zeabur.app/api/auth/send-otp \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com"}'
  ```
- [ ] **5.7** 确认响应包含：`"message": "验证码已发送"`
- [ ] **5.8** 在 PostgreSQL Web Console 中查询：
  ```sql
  SELECT email, code FROM otps 
  WHERE email = 'test@example.com' 
  ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] **5.9** 确认查询返回结果（包含邮箱和验证码）

**预计耗时：** 3-5 分钟

---

## 🎉 部署完成检查

- [ ] ✅ PostgreSQL 服务状态为 "Running"
- [ ] ✅ 应用服务状态为 "Running"
- [ ] ✅ 应用日志显示数据库连接成功
- [ ] ✅ 健康检查接口返回正常
- [ ] ✅ 用户注册流程测试通过
- [ ] ✅ 数据库中可以查询到测试数据

---

## ❌ 故障排查

### 问题 1：DATABASE_URL 未注入

**症状：**
- 应用日志：`⚠️ 数据库配置未设置，跳过连接测试`
- 环境变量中没有 `DATABASE_URL`

**解决步骤：**
1. [ ] 确认 PostgreSQL 服务已创建且状态为 "Running"
2. [ ] 确认 PostgreSQL 和应用在同一个 Zeabur 项目中
3. [ ] 等待 2-3 分钟（环境变量注入需要时间）
4. [ ] 重启应用服务（Redeploy）
5. [ ] 刷新环境变量页面，再次检查

---

### 问题 2：数据库连接超时

**症状：**
- 应用日志：`❌ 数据库连接失败: connection timeout`
- 错误代码：`ETIMEDOUT`

**解决步骤：**
1. [ ] 检查 PostgreSQL 服务状态（应为 "Running"）
2. [ ] 检查 PostgreSQL Metrics 标签，确认服务正常运行
3. [ ] 等待 3-5 分钟（新服务需要初始化时间）
4. [ ] 重启应用服务
5. [ ] 如果仍失败，在环境变量中添加：
   ```
   DB_SSL_REJECT_UNAUTHORIZED=false
   ```

---

### 问题 3：表不存在错误

**症状：**
- API 调用返回：`relation "users" does not exist`
- 应用日志：`error: relation "otps" does not exist`

**解决步骤：**
1. [ ] 进入 PostgreSQL Web Console
2. [ ] 执行验证查询：
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
3. [ ] 如果表不存在，重新执行 `database/init.sql`
4. [ ] 重启应用服务

---

### 问题 4：SSL 证书错误

**症状：**
- 应用日志：`self signed certificate in certificate chain`

**解决步骤：**
1. [ ] 在 Zeabur 环境变量中添加：
   ```
   DB_SSL_REJECT_UNAUTHORIZED=false
   ```
2. [ ] 重启应用服务

**注意：** 你的代码已经处理了这个问题（`server/config/database.ts` 第 22 行），通常不需要额外配置。

---

## 📊 部署后监控

### 每日检查（推荐）

- [ ] 查看应用 Logs，确认无数据库错误
- [ ] 查看 PostgreSQL Metrics：
  - CPU 使用率 < 80%
  - 内存使用率 < 80%
  - 连接数 < 最大连接数的 80%

### 每周检查（推荐）

- [ ] 清理过期验证码：
  ```sql
  DELETE FROM otps WHERE expires_at < NOW() - INTERVAL '7 days';
  ```
- [ ] 检查报告数量：
  ```sql
  SELECT COUNT(*) FROM reports;
  ```
- [ ] 检查用户数量：
  ```sql
  SELECT COUNT(*) FROM users;
  ```

---

## 📚 相关文档

- [快速开始指南](../../ZEABUR_DATABASE_QUICKSTART.md)
- [详细部署指南](../../ZEABUR_DATABASE_SETUP.md)
- [数据库设计说明](../../database/README.md)
- [Zeabur 部署总览](../../ZEABUR_DEPLOYMENT.md)

---

## 📝 部署记录

**部署人员：** _________________

**部署日期：** 2025-11-12

**部署时间：** _________________

**PostgreSQL 服务 ID：** _________________

**应用服务域名：** _________________

**验证结果：**
- [ ] 数据库连接成功
- [ ] 健康检查通过
- [ ] 用户注册测试通过

**备注：**

_________________________________________________

_________________________________________________

_________________________________________________

