# Zeabur PostgreSQL 数据库部署指南

## 📋 目录
1. [在 Zeabur 上创建 PostgreSQL 服务](#1-在-zeabur-上创建-postgresql-服务)
2. [初始化数据库表结构](#2-初始化数据库表结构)
3. [验证数据库连接](#3-验证数据库连接)
4. [常见问题排查](#4-常见问题排查)

---

## 1. 在 Zeabur 上创建 PostgreSQL 服务

### 步骤 1.1：登录 Zeabur 控制台
1. 访问 [https://zeabur.com](https://zeabur.com)
2. 登录你的账号
3. 进入你的项目（51talkreportgeneration）

### 步骤 1.2：添加 PostgreSQL 服务
1. 在项目页面，点击 **"Add Service"** 按钮
2. 选择 **"Prebuilt"** 标签
3. 找到并点击 **"PostgreSQL"**
4. 等待服务创建完成（通常需要 1-2 分钟）

### 步骤 1.3：确认环境变量自动注入
创建 PostgreSQL 服务后，Zeabur 会**自动**将以下环境变量注入到你的应用中：

- `DATABASE_URL` - 完整的数据库连接字符串（格式：`postgresql://user:password@host:port/database`）
- `POSTGRES_HOST` - 数据库主机地址
- `POSTGRES_PORT` - 数据库端口（默认 5432）
- `POSTGRES_USERNAME` - 数据库用户名
- `POSTGRES_PASSWORD` - 数据库密码
- `POSTGRES_DATABASE` - 数据库名称

✅ **你的应用会优先使用 `DATABASE_URL`，无需手动配置其他变量！**

---

## 2. 初始化数据库表结构

### 方法 A：使用 Zeabur 控制台（推荐）

1. **进入数据库管理界面**
   - 在 Zeabur 项目页面，点击 PostgreSQL 服务卡片
   - 点击 **"Console"** 或 **"Connect"** 标签
   - 选择 **"Web Console"**（在线 SQL 编辑器）

2. **执行初始化 SQL**
   
   依次执行以下 SQL 语句（按顺序）：

   ```sql
   -- 1. 创建 users 表
   CREATE TABLE IF NOT EXISTS users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email VARCHAR(255) UNIQUE NOT NULL,
     password VARCHAR(255),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
   ```

   ```sql
   -- 2. 创建 otps 表（验证码）
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
   ```

   ```sql
   -- 3. 创建 reports 表（分析报告）
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

3. **验证表创建成功**
   
   执行以下查询确认所有表都已创建：
   
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   
   应该看到：`otps`, `reports`, `users`

### 方法 B：使用本地脚本连接（高级）

如果你想从本地执行初始化脚本：

1. **获取数据库连接信息**
   - 在 Zeabur PostgreSQL 服务页面
   - 点击 **"Instructions"** 或 **"Connection"**
   - 复制 `DATABASE_URL` 或单独的连接参数

2. **设置本地环境变量**
   
   创建临时文件 `.env.zeabur.local`：
   ```bash
   DATABASE_URL=postgresql://username:password@host:port/database
   ```

3. **执行初始化脚本**
   ```bash
   # 方式 1：使用 psql 命令行
   psql $DATABASE_URL -f database/create_users_table.sql
   psql $DATABASE_URL -f database/create_otps_table.sql
   psql $DATABASE_URL -f database/create_reports_table.sql

   # 方式 2：使用项目脚本（如果配置了 DATABASE_URL）
   npm run setup:db
   ```

---

## 3. 验证数据库连接

### 步骤 3.1：检查应用日志

1. 在 Zeabur 项目页面，点击你的应用服务
2. 进入 **"Logs"** 标签
3. 查看最新的运行日志

**成功的日志示例：**
```
🚀 Server is running on port 3001
📊 API endpoint: http://localhost:3001/api/analysis
🔧 Mock mode: OFF
🔑 OpenAI API Key: SET (length: 51)
🔑 通义听悟 AccessKey: SET
🔗 正在连接数据库...
✅ 连接已建立，执行查询...
✅ 数据库连接成功: 2025-11-12T06:30:45.123Z
```

**失败的日志示例：**
```
❌ 数据库连接失败: connection timeout
   错误代码: ETIMEDOUT
```

### 步骤 3.2：测试健康检查接口

访问你的应用健康检查端点：

```bash
curl https://your-app.zeabur.app/api/analysis/health
```

**成功响应示例：**
```json
{
  "status": "ok",
  "useMock": false,
  "timestamp": "2025-11-12T06:30:45.123Z",
  "aiProvider": "glm",
  "transcriptionProvider": "tingwu",
  "database": "connected"
}
```

### 步骤 3.3：测试用户注册流程

1. **发送验证码**
   ```bash
   curl -X POST https://your-app.zeabur.app/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. **检查数据库**
   在 Zeabur PostgreSQL Web Console 中执行：
   ```sql
   SELECT email, code, expires_at, used 
   FROM otps 
   WHERE email = 'test@example.com' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

---

## 4. 常见问题排查

### 问题 1：应用日志显示 "数据库配置未设置，跳过连接测试"

**原因：** `DATABASE_URL` 环境变量未正确注入

**解决方案：**
1. 确认 PostgreSQL 服务已成功创建
2. 在 Zeabur 项目页面，检查服务之间的连接关系
3. 重启应用服务：点击应用服务 → **"Redeploy"**

### 问题 2：数据库连接超时（ETIMEDOUT）

**原因：** 网络连接问题或数据库服务未就绪

**解决方案：**
1. 检查 PostgreSQL 服务状态（应显示 "Running"）
2. 确认应用和数据库在同一个 Zeabur 项目中
3. 等待 2-3 分钟后重试（新服务可能需要初始化时间）

### 问题 3：SSL 连接错误（self signed certificate）

**原因：** SSL 证书验证失败

**解决方案：**
你的代码已经处理了这个问题！检查 `server/config/database.ts` 第 21-23 行：

```typescript
ssl: process.env.NODE_ENV === 'production' ? {
  rejectUnauthorized: false, // Zeabur证书兼容性
} : false,
```

如果仍有问题，可以在 Zeabur 环境变量中添加：
```
DB_SSL_REJECT_UNAUTHORIZED=false
```

### 问题 4：表不存在（relation "users" does not exist）

**原因：** 数据库表结构未初始化

**解决方案：**
按照 [第 2 节](#2-初始化数据库表结构) 重新执行 SQL 初始化脚本

### 问题 5：如何查看 DATABASE_URL 的值？

**方法 1：通过日志（安全）**
在 `server/index.ts` 启动日志中临时添加：
```typescript
console.log(`🔑 DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
```

**方法 2：通过 Zeabur Console（直接查看）**
1. 进入 PostgreSQL 服务页面
2. 点击 **"Instructions"** 标签
3. 查看 "Connection String" 部分

---

## 5. 数据库管理最佳实践

### 5.1 备份策略
- Zeabur PostgreSQL 会自动进行每日备份
- 在 PostgreSQL 服务页面可以手动创建快照

### 5.2 连接池配置
你的应用已配置连接池（`server/config/database.ts`）：
```typescript
max: 10,                        // Zeabur环境最大连接数
idleTimeoutMillis: 30000,       // 空闲超时 30秒
connectionTimeoutMillis: 10000, // 连接超时 10秒
```

### 5.3 监控数据库性能
1. 在 Zeabur PostgreSQL 服务页面
2. 查看 **"Metrics"** 标签
3. 监控：
   - CPU 使用率
   - 内存使用率
   - 连接数
   - 查询性能

---

## 6. 下一步

✅ 数据库部署完成后，你可以：

1. **测试完整的用户注册流程**
   - 发送验证码 → 验证 OTP → 创建用户
   
2. **测试视频分析功能**
   - 上传视频 → 转写 → AI 分析 → 保存报告

3. **配置邮件服务**（如果还没配置）
   - 参考 `docs/getting-started/EMAIL_SETUP.md`

4. **监控应用运行状态**
   - 定期检查 Zeabur Logs
   - 监控数据库性能指标

---

## 📚 相关文档

- [Zeabur PostgreSQL 官方文档](https://zeabur.com/docs/marketplace/postgresql)
- [项目数据库设计](database/README.md)
- [Zeabur 部署指南](ZEABUR_DEPLOYMENT.md)
- [快速开始指南](QUICKSTART_ZEABUR.md)

---

## 🆘 需要帮助？

如果遇到问题：
1. 查看 Zeabur 应用日志（Logs 标签）
2. 查看 PostgreSQL 服务状态（Metrics 标签）
3. 参考本文档的 [常见问题排查](#4-常见问题排查) 部分
4. 联系 Zeabur 技术支持：[https://zeabur.com/docs](https://zeabur.com/docs)

