# Zeabur 部署指南

完整的 Zeabur 部署文档，包括应用服务和 PostgreSQL 数据库。

## 📋 部署清单

### ✅ 已完成的准备工作

- [x] Dockerfile 已优化
- [x] 添加了限流保护（控制成本和并发）
- [x] 数据库配置支持 DATABASE_URL
- [x] 创建了 zeabur.yaml 配置文件

### 📦 部署内容

- **主应用**：前后端一体（Express + React）
- **数据库**：PostgreSQL 15
- **限流保护**：
  - 全局：15分钟/200请求（已放宽）
  - 视频分析：10分钟/15请求（已大幅放宽，原5次）
  - 认证接口：15分钟/5请求

---

## 🚀 部署步骤

### 第一步：准备代码仓库

#### 1. 提交代码到 GitHub

```bash
# 如果还没有 git 仓库
git init
git add .
git commit -m "Ready for Zeabur deployment"

# 创建 GitHub 仓库后
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

#### 2. 确保 .gitignore 包含敏感文件

检查 `.gitignore` 文件包含：
```
node_modules/
.env
.env.local
build/
dist/
*.log
```

---

### 第二步：在 Zeabur 创建项目

#### 1. 访问 Zeabur 控制台

- 打开 https://zeabur.com
- 使用 GitHub 账号登录

#### 2. 创建新项目

1. 点击 **"New Project"**
2. 选择区域：**Asia (Singapore)** 或 **Asia (Hong Kong)** （离中国最近）
3. 项目名称：`english-learning-assistant`

---

### 第三步：部署 PostgreSQL 数据库

#### 1. 添加数据库服务

在项目中：
1. 点击 **"Add Service"**
2. 选择 **"PostgreSQL"**
3. 版本选择：**15**
4. 确认创建

#### 2. 等待数据库启动

- 等待状态变为 **"Running"**（约1-2分钟）
- Zeabur 会自动生成 `DATABASE_URL` 环境变量

#### 3. 创建数据库表

有两种方式：

**方式A：使用 Zeabur 控制台**

1. 在数据库服务页面，点击 **"Console"**
2. 复制粘贴以下 SQL（按顺序执行）：

```sql
-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. 创建验证码表
CREATE TABLE IF NOT EXISTS otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(code);

-- 3. 创建报告表
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  student_name TEXT NOT NULL,
  audio_duration INTEGER NOT NULL,
  transcript TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
```

**方式B：使用本地工具**

如果你有 `psql` 客户端：

```bash
# 从 Zeabur 控制台复制 DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host:5432/db"

# 执行 SQL 脚本
psql $DATABASE_URL -f database/create_users_table.sql
psql $DATABASE_URL -f database/create_otps_table.sql
psql $DATABASE_URL -f database/create_reports_table.sql
```

---

### 第四步：部署应用服务

#### 1. 连接 GitHub 仓库

1. 点击 **"Add Service"**
2. 选择 **"Git"**
3. 选择你的 GitHub 仓库
4. 分支选择：**main**

#### 2. Zeabur 会自动检测

- 检测到 `Dockerfile` → 使用 Docker 构建
- 检测到 `zeabur.yaml` → 读取配置

#### 3. 配置环境变量

在应用服务页面，点击 **"Variables"**，添加以下环境变量：

##### 必填变量

```bash
# 运行环境
NODE_ENV=production
USE_MOCK_ANALYSIS=false

# AI 模型（智谱GLM - 主要使用）
GLM_API_KEY=your_glm_api_key_here

# 阿里云语音服务（必填）
ALIYUN_ACCESS_KEY_ID=your_aliyun_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_aliyun_access_key_secret
TINGWU_LANGUAGE=en

# JWT 密钥（生成随机字符串）
JWT_SECRET=your_super_secret_random_string_at_least_32_chars
```

##### 可选变量

```bash
# 其他 AI 模型（可选）
OPENAI_API_KEY=your_openai_api_key  # 用于 Whisper
QWEN_API_KEY=your_qwen_api_key      # 通义千问
DEEPSEEK_API_KEY=your_deepseek_key  # DeepSeek

# 邮件服务（如果需要）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@example.com

# 阿里云代理（如果需要）
ALIYUN_ALLOW_PROXY=false
ALIYUN_REJECT_UNAUTHORIZED=true
```

**重要提示**：
- `DATABASE_URL` 会被 Zeabur 自动注入，**不需要手动设置**
- `PORT` 变量也会被 Zeabur 自动注入，**不需要手动设置**（Zeabur 会根据实际环境自动分配端口）

#### 4. 生成 JWT_SECRET

使用以下命令生成随机密钥：

```bash
# 方式1：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方式2：使用 OpenSSL
openssl rand -hex 32
```

#### 5. 部署

保存环境变量后：
1. Zeabur 会自动开始构建
2. 等待构建完成（约3-5分钟）
3. 状态变为 **"Running"**

---

### 第五步：配置域名（可选）

#### 1. 使用 Zeabur 免费域名

1. 在应用服务页面，点击 **"Domains"**
2. 点击 **"Generate Domain"**
3. 获得格式如：`your-app.zeabur.app`

#### 2. 绑定自定义域名（可选）

如果你有自己的域名：

1. 在 Zeabur 点击 **"Add Domain"**
2. 输入域名：`api.yourdomain.com`
3. 在域名提供商添加 CNAME 记录：
   ```
   api.yourdomain.com -> cname.zeabur-dns.com
   ```
4. 等待 DNS 生效（约10分钟）
5. Zeabur 会自动配置 HTTPS 证书

---

## ✅ 验证部署

### 1. 健康检查

访问健康检查端点：

```bash
curl https://your-app.zeabur.app/api/analysis/health
```

期望响应：
```json
{
  "status": "ok",
  "timestamp": "2024-11-12T02:30:00.000Z",
  "useMock": false
}
```

### 2. 数据库连接测试

查看应用日志（Zeabur 控制台 → Logs），应该看到：

```
✅ 数据库连接成功: 2024-11-12 02:30:00+00
```

如果看到连接失败，检查：
- 数据库服务是否正在运行
- DATABASE_URL 是否正确注入

### 3. 访问前端

打开浏览器访问：
```
https://your-app.zeabur.app
```

应该能看到应用首页。

### 4. 测试限流

快速发送3个请求到 `/api/analysis/analyze`，第3个应该被限流：

```bash
# 第1次
curl -X POST https://your-app.zeabur.app/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{"video1":"url1","video2":"url2","studentName":"Test"}'

# 第2次（10分钟内）
curl -X POST https://your-app.zeabur.app/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{"video1":"url1","video2":"url2","studentName":"Test"}'

# 第3次（10分钟内） - 应该被限流
# 响应：429 Too Many Requests
```

---

## 📊 监控和成本

### 查看资源使用

在 Zeabur 控制台：
1. 点击项目名称
2. 查看 **"Usage"** 标签
3. 监控：
   - CPU 使用率
   - 内存使用
   - 网络流量
   - **当前成本**

### 成本预估

基于 $5/月 套餐：

**轻度使用（10-20用户/天）**：
```
应用：$5-10/月
数据库：$5/月
流量：$2/月
总计：$12-17/月 (约 ¥86-122)
```

**中度使用（50-80用户/天，有限流）**：
```
应用：$15-25/月
数据库：$8/月
流量：$5/月
总计：$28-38/月 (约 ¥200-274)
```

**警告阈值**：
- 如果月成本超过 $30，考虑：
  1. 增加限流（减少到每15分钟1次）
  2. 迁移到阿里云（更经济）

### 设置预算警报

1. Zeabur 控制台 → Settings
2. 设置预算上限：$30/月
3. 接近限额时会收到邮件通知

---

## 🔧 维护和更新

### 更新代码

```bash
# 1. 修改代码
git add .
git commit -m "Your update message"

# 2. 推送到 GitHub
git push

# 3. Zeabur 会自动检测并重新部署
```

### 查看日志

Zeabur 控制台 → 应用服务 → **Logs**

查找关键信息：
- `🚀 Server is running` - 启动成功
- `✅ 数据库连接成功` - 数据库正常
- 错误信息和堆栈跟踪

### 回滚版本

如果新版本有问题：

1. Zeabur 控制台 → Deployments
2. 找到之前的成功版本
3. 点击 **"Redeploy"**

### 备份数据库

**自动备份**：
- Zeabur 每天自动备份
- 保留7天

**手动备份**：
```bash
# 导出数据
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 上传到云存储（推荐）
```

---

## 🐛 故障排除

### 问题1：应用无法启动

**症状**：部署后一直显示 "Building" 或 "Error"

**解决**：
1. 查看 Build Logs
2. 常见原因：
   - 依赖安装失败 → 检查 `package.json`
   - 构建超时 → 优化 Dockerfile
   - 内存不足 → 增加实例内存

### 问题2：数据库连接失败

**症状**：日志显示 "数据库连接失败"

**解决**：
1. 确认数据库服务正在运行（状态为 "Running"）
2. 确认数据库和应用在同一个项目中
3. Zeabur 会自动注入 `DATABASE_URL` 环境变量
4. 在应用服务中，点击 Variables → 应该能看到 `DATABASE_URL`（如果看不到，可能需要等待几分钟）
5. 如果仍然失败，尝试重新部署应用

### 问题3：外部API调用失败

**症状**：阿里云API超时或失败

**解决**：
1. 检查 API 密钥是否正确
2. 确认阿里云服务已开通
3. 检查免费额度是否用完
4. 查看详细错误日志

### 问题4：成本超预算

**症状**：月成本超过 $30

**解决**：
1. **立即**增加限流：
   ```typescript
   // server/index.ts - 修改限流配置
   const analysisLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 改为15分钟
     max: 1, // 改为1次
   });
   ```

2. 减少实例数：
   ```yaml
   # zeabur.yaml
   scaling:
     maxReplicas: 1  # 改为1
   ```

3. 考虑迁移到阿里云

### 问题5：限流过于严格

**症状**：用户抱怨无法使用

**解决方案A**：放宽限流（会增加成本）
```typescript
const analysisLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3, // 增加到3次
});
```

**解决方案B**：实现用户认证 + VIP 通道
- 免费用户：严格限流
- 付费用户：宽松限流或无限制

---

## 📚 相关文档

- [Zeabur 官方文档](https://zeabur.com/docs)
- [PostgreSQL 环境变量](https://zeabur.com/docs/databases/postgresql)
- [自定义域名](https://zeabur.com/docs/domains)
- [项目README](./README.md)
- [环境变量配置](./env.aliyun.example)

---

## 🎉 完成！

你的应用现在已经部署在 Zeabur 上了！

**下一步**：
- ✅ 测试所有功能
- ✅ 邀请用户试用
- ✅ 监控成本和性能
- ✅ 根据反馈优化

如果遇到问题，查看本文档的"故障排除"部分。
