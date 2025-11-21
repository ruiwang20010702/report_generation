# Zeabur 快速开始（10分钟部署）

最快速的Zeabur部署指南，让你的应用快速上线。

## 🎯 目标

10分钟内在Zeabur上部署完整应用（前后端 + 数据库）

---

## 📦 准备工作（5分钟）

### 1. 准备密钥

你需要获取以下密钥（保存在记事本中）：

#### ✅ 智谱 GLM API Key（必填）
```
获取地址：https://open.bigmodel.cn/
注册 → 控制台 → API Keys → 创建新密钥
示例：4e8f7d2c9b1a6e3f5d8a9c2b7e4f6d1a.xxxxxx
```

#### ✅ 阿里云 Access Key（必填）
```
获取地址：https://ram.console.aliyun.com/manage/ak
创建AccessKey → 获取 ID 和 Secret
示例：
  ID: LTAI5txxxxxxxxxxxxxx
  Secret: a1b2c3d4e5f6xxxxxxxxxx
```

#### ✅ JWT Secret（必填）
```bash
# 在终端运行以下命令生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用在线工具
https://www.random.org/strings/
```

### 2. 代码推送到 GitHub

```bash
# 如果还没有仓库
git init
git add .
git commit -m "Ready for deployment"

# 创建 GitHub 仓库后
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

---

## 🚀 部署步骤（5分钟）

### 步骤 1：创建项目（30秒）

1. 访问 https://zeabur.com
2. 使用 GitHub 登录
3. 点击 "New Project"
4. 区域选择：**Singapore**（离中国最近）
5. 项目名称：`english-learning`

### 步骤 2：添加数据库（1分钟）

1. 点击 "Add Service" → "PostgreSQL"
2. 版本选择：**15**
3. 点击创建
4. 等待状态变为 "Running"（约30-60秒）

### 步骤 3：创建数据库表（1分钟）

1. 点击数据库服务 → "Console"
2. 复制粘贴以下SQL（一次性执行）：

```sql
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建验证码表
CREATE TABLE IF NOT EXISTS otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE
);

-- 创建报告表
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
```

3. 确认执行成功（无错误提示）

### 步骤 4：连接应用（1分钟）

1. 回到项目页面
2. 点击 "Add Service" → "Git"
3. 选择你的 GitHub 仓库
4. 分支：**main**
5. Zeabur 开始自动构建（约3-5分钟）

### 步骤 5：配置环境变量（2分钟）

1. 点击应用服务 → "Variables"
2. 点击 "Add Variable"，逐个添加：

```bash
NODE_ENV=production
USE_MOCK_ANALYSIS=false
GLM_API_KEY=【粘贴你的智谱GLM密钥】
ALIYUN_ACCESS_KEY_ID=【粘贴你的阿里云ID】
ALIYUN_ACCESS_KEY_SECRET=【粘贴你的阿里云Secret】
TINGWU_LANGUAGE=en
JWT_SECRET=【粘贴生成的随机字符串】
```

**注意**：不需要设置 `PORT` 和 `DATABASE_URL`，Zeabur 会自动注入这些变量。

3. 保存后，应用会自动重启

---

## ✅ 验证部署（2分钟）

### 1. 获取域名

1. 点击应用服务 → "Domains"
2. 点击 "Generate Domain"
3. 获得域名：`your-app.zeabur.app`

### 2. 测试健康检查

在浏览器访问：
```
https://your-app.zeabur.app/api/analysis/health
```

期望看到：
```json
{
  "status": "ok",
  "timestamp": "2024-11-12T...",
  "useMock": false
}
```

### 3. 访问前端

打开浏览器访问：
```
https://your-app.zeabur.app
```

应该能看到应用首页！🎉

### 4. 查看日志

Zeabur 控制台 → 应用服务 → "Logs"

确认看到：
```
✅ 数据库连接成功
🚀 Server is running on port 8080
```

---

## 🎊 完成！

你的应用现在已经在 Zeabur 上运行了！

**测试功能**：
1. 注册账号
2. 提交视频分析
3. 查看报告

**监控成本**：
- 项目页面 → "Usage" 查看资源使用
- 设置预算警报：$30/月

---

## 🐛 遇到问题？

### 应用一直在 Building
- 查看 Build Logs
- 常见问题：依赖安装失败
- 解决：确保 `package.json` 无误

### 数据库连接失败
- 确认数据库服务状态为 "Running"
- 检查 `DATABASE_URL` 是否自动注入
- 解决：在应用服务中重新关联数据库

### 外部API调用失败
- 检查密钥是否正确复制
- 确认阿里云服务已开通
- 查看详细错误日志

### 成本超预算
- 立即增加限流（15分钟/1次）
- 减少实例数（maxReplicas: 1）
- 考虑迁移到阿里云

---

## 📚 下一步

- [ ] 配置自定义域名
- [ ] 设置预算警报
- [ ] 邀请用户测试
- [ ] 监控日志和性能
- [ ] 阅读完整文档：`./ZEABUR_DEPLOYMENT.md`

---

**预计总时间**：10-15 分钟
**月成本预估**：$12-30（¥86-216）
**支持并发**：20-40 用户（配合限流）

🚀 开始使用吧！
