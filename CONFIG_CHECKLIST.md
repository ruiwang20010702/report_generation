# 环境配置快速检查清单 ✅

完成所有测试后的环境配置清单，确保顺利部署。

---

## 🎯 当前状态

✅ **测试状态**: 所有 27 个集成测试通过  
✅ **代码质量**: 生产环境优化完成  
✅ **数据库**: 表结构和索引完整  
🔄 **下一步**: 环境配置和部署

---

## 📋 配置清单

### ✅ 第一步：基础检查

- [ ] Node.js 18+ 已安装
- [ ] npm 已安装
- [ ] 项目依赖已安装 (`npm install`)
- [ ] Git 仓库已初始化
- [ ] 代码已推送到 GitHub（如准备部署到 Zeabur）

**验证命令**:
```bash
node -v    # 应该显示 v18.x 或更高
npm -v     # 应该显示 9.x 或更高
ls node_modules  # 应该显示依赖目录
git status  # 应该显示干净的工作目录
```

---

### ✅ 第二步：环境文件配置

- [ ] 已复制 `.env` 文件 (`cp env.aliyun.example .env`)
- [ ] 或运行配置向导 (`npm run setup:env`)
- [ ] 或运行快速配置 (`./scripts/quick-setup.sh`)

**快速开始**:
```bash
# 方式1: 手动复制
cp env.aliyun.example .env

# 方式2: 交互式配置
npm run setup:env

# 方式3: 快速配置向导
./scripts/quick-setup.sh
```

---

### ✅ 第三步：必需的 API 密钥

#### 3.1 JWT Secret（安全密钥）

- [ ] 已生成 JWT Secret
- [ ] 已添加到 `.env` 文件的 `JWT_SECRET`

**生成方法**:
```bash
# 使用 Node.js 生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用 OpenSSL
openssl rand -hex 32

# 复制输出并添加到 .env:
# JWT_SECRET=生成的64位十六进制字符串
```

✅ **验证**: 字符串应该是 64 个字符长度

---

#### 3.2 智谱 GLM API Key（AI分析）

- [ ] 已注册智谱账号
- [ ] 已获取 API Key
- [ ] 已添加到 `.env` 文件的 `GLM_API_KEY`

**获取步骤**:
1. 访问：https://open.bigmodel.cn/
2. 注册并登录（建议使用手机号注册）
3. 进入"控制台"
4. 点击"API Keys" → "创建新密钥"
5. 复制密钥（格式：`xxxxx.xxxxxx`）
6. 粘贴到 `.env`:
   ```
   GLM_API_KEY=你的密钥
   ```

💰 **费用**: 
- 首次注册送 ¥18 体验金
- 约可进行 30-60 次完整分析
- 用完后需充值（¥100 起）

---

#### 3.3 阿里云 AccessKey（语音转文字）

- [ ] 已注册阿里云账号
- [ ] 已完成实名认证
- [ ] 已创建 AccessKey
- [ ] 已添加到 `.env` 的 `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`

**获取步骤**:
1. 访问：https://ram.console.aliyun.com/manage/ak
2. 登录阿里云账号
3. 点击"创建 AccessKey"
4. 记录 AccessKey ID 和 AccessKey Secret
5. 添加到 `.env`:
   ```
   ALIYUN_ACCESS_KEY_ID=LTAI5txxxxxxxxxxxxxx
   ALIYUN_ACCESS_KEY_SECRET=你的Secret
   ```

⚠️ **安全提示**: AccessKey Secret 只显示一次，请妥善保存

---

#### 3.4 通义听悟 AppKey（语音服务）

- [ ] 已开通通义听悟服务
- [ ] 已创建项目
- [ ] 已获取 AppKey
- [ ] 已添加到 `.env` 的 `ALIYUN_TINGWU_APP_KEY`

**获取步骤**:
1. 访问：https://tingwu.console.aliyun.com/
2. 点击"立即开通"（选择"按量付费"）
3. 同意服务协议并开通
4. 点击"创建项目"
5. 输入项目名称（如："英语学习分析"）
6. 创建后，在项目列表中找到 AppKey
7. 添加到 `.env`:
   ```
   ALIYUN_TINGWU_APP_KEY=你的AppKey
   TINGWU_LANGUAGE=en
   ```

💰 **费用**: 
- 免费额度：每天 120 分钟
- 超出后：¥0.01/分钟
- 一个15分钟视频约 ¥0.15

⚠️ **重要**: AccessKey 和 AppKey 必须属于同一个阿里云账号

---

### ✅ 第四步：数据库配置

#### 选项A: 本地开发（PostgreSQL）

- [ ] 已安装 PostgreSQL
- [ ] 已创建数据库
- [ ] 已配置数据库连接信息

```bash
# .env 配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=english_learning
DB_USER=postgres
DB_PASSWORD=你的密码
DB_SSL=false
```

**初始化数据库**:
```bash
npm run setup:db
```

---

#### 选项B: Zeabur（推荐生产环境）

- [ ] 已注册 Zeabur 账号
- [ ] 已创建项目
- [ ] 已添加 PostgreSQL 服务
- [ ] 已执行 SQL 初始化脚本

```bash
# Zeabur 会自动注入 DATABASE_URL
# 只需要在 .env 设置:
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

📝 **SQL 初始化脚本**: 参考 `QUICKSTART_ZEABUR.md` 的步骤3

---

#### 选项C: 阿里云 RDS

- [ ] 已购买 RDS PostgreSQL 实例
- [ ] 已创建数据库
- [ ] 已配置白名单
- [ ] 已获取连接信息

```bash
# .env 配置
DB_HOST=your-instance.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=english_learning
DB_USER=your_user
DB_PASSWORD=your_password
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

---

### ✅ 第五步：可选配置

#### 5.1 邮件服务（推荐生产环境）

- [ ] 已开通阿里云邮件推送服务
- [ ] 已创建发信域名
- [ ] 已完成域名验证
- [ ] 已创建发信地址
- [ ] 已配置 SMTP 信息

```bash
# .env 配置
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=你的SMTP密码
SMTP_FROM=noreply@yourdomain.com
```

💡 **开发环境**: 可以跳过，验证码会在 API 响应中返回

---

#### 5.2 Sentry 错误监控（可选，推荐生产环境）

⚠️ **中国使用说明**：官方Sentry在中国可以使用，但访问较慢。建议：
- **初期**：使用官方Sentry或暂不配置
- **生产**：考虑阿里云ARMS（国内访问快）

**方案A：官方Sentry**（推荐初期）

- [ ] 已注册 Sentry 账号（https://sentry.io/）
- [ ] 已创建项目（Node.js + React）
- [ ] 已获取 DSN
- [ ] 已配置环境变量

```bash
# .env 配置
SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
```

💡 **费用**: 
- 前14天：Business试用（全功能，无限events）
- 之后：**永久免费**Developer计划（5,000 errors/月）
- 超出可升级付费

⚠️ **注意**: 国内访问较慢，但不影响应用性能（异步上传）

**方案B：阿里云ARMS**（推荐生产）

- [ ] 已开通ARMS服务（https://arms.console.aliyun.com/）
- [ ] 已创建应用
- [ ] 已集成SDK

✅ **优势**: 国内访问快、稳定、有免费额度

💡 **可以先不配置**：Sentry/ARMS都是可选的，不影响核心功能

---

### ✅ 第六步：配置验证

#### 6.1 环境变量检查

- [ ] 运行环境变量检查工具

```bash
npm run check:env

# 期望输出：
# ✓ JWT_SECRET 已设置
# ✓ GLM_API_KEY 已设置
# ✓ ALIYUN_ACCESS_KEY_ID 已设置
# ✓ ALIYUN_ACCESS_KEY_SECRET 已设置
# ✓ ALIYUN_TINGWU_APP_KEY 已设置
# ✓ 数据库配置完整
```

---

#### 6.2 数据库连接测试

- [ ] 测试数据库连接

```bash
npm run test:db

# 期望输出：
# ✅ 数据库连接成功
# ✅ 查询测试成功
# ✅ 表结构验证通过
```

---

#### 6.3 通义听悟测试（可选）

- [ ] 测试通义听悟连接

```bash
# 需要提供一个测试视频URL
node test-tingwu.ts

# 期望输出：
# ✅ 通义听悟连接成功
# ✅ 任务创建成功
```

---

#### 6.4 完整测试套件

- [ ] 运行所有测试

```bash
npm test

# 期望输出：
# Test Suites: 4 passed, 4 total
# Tests:       27 passed, 27 total
```

---

#### 6.5 启动开发服务器

- [ ] 启动前后端服务

```bash
npm run dev:all

# 前端: http://localhost:8080
# 后端: http://localhost:3001

# 访问健康检查：
# http://localhost:3001/api/health
```

---

### ✅ 第七步：部署准备

#### 7.1 代码准备

- [ ] 所有代码已提交
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 代码已推送到 GitHub
- [ ] 分支选择正确（通常是 `main` 或 `master`）

```bash
# 检查状态
git status

# 提交更改
git add .
git commit -m "Ready for production deployment"

# 推送到 GitHub
git push origin main
```

---

#### 7.2 选择部署平台

**选项A: Zeabur（推荐，最快）**

- [ ] 优势：10分钟快速部署、自动数据库、自动HTTPS
- [ ] 成本：$12-30/月（约¥86-216）
- [ ] 文档：参考 `QUICKSTART_ZEABUR.md`

**选项B: 阿里云（企业级）**

- [ ] 优势：国内访问快、数据合规、完全控制
- [ ] 成本：¥200-500/月
- [ ] 文档：参考 `docs/deployment/DEPLOY.md`

---

## 🎯 配置模式参考

### 开发模式（Mock - 无需外部API）

```bash
NODE_ENV=development
USE_MOCK_ANALYSIS=true
JWT_SECRET=生成的随机字符串
DB_HOST=localhost
DB_NAME=english_learning
# ... 其他数据库配置
```

✅ **用途**: UI开发、功能测试、演示

---

### 开发模式（真实 - 完整功能）

```bash
NODE_ENV=development
USE_MOCK_ANALYSIS=false
JWT_SECRET=生成的随机字符串
GLM_API_KEY=你的GLM密钥
ALIYUN_ACCESS_KEY_ID=你的AccessKey
ALIYUN_ACCESS_KEY_SECRET=你的Secret
ALIYUN_TINGWU_APP_KEY=你的AppKey
# ... 数据库配置
```

✅ **用途**: 集成测试、真实数据验证

---

### 生产环境（Zeabur）

```bash
NODE_ENV=production
USE_MOCK_ANALYSIS=false
JWT_SECRET=生成的随机字符串
GLM_API_KEY=你的GLM密钥
ALIYUN_ACCESS_KEY_ID=你的AccessKey
ALIYUN_ACCESS_KEY_SECRET=你的Secret
ALIYUN_TINGWU_APP_KEY=你的AppKey
TINGWU_LANGUAGE=en

# Zeabur 自动注入 DATABASE_URL 和 PORT
# 可选: SMTP配置、Sentry配置
```

✅ **用途**: 生产部署

---

## 🆘 常见问题快速解决

### Q: 我应该先配置什么？

**A**: 按照以下顺序：
1. 复制 `.env` 文件 ✅
2. 生成 JWT Secret ✅
3. 配置数据库 ✅
4. 获取 GLM API Key ✅
5. 获取阿里云密钥 ✅
6. 测试和验证 ✅

---

### Q: Mock 模式够用吗？

**A**: 
- ✅ UI开发和测试：完全够用
- ✅ 功能演示：完全够用
- ❌ 真实分析：需要真实API
- ❌ 生产部署：必须使用真实API

---

### Q: 最小配置是什么？

**A**: 开发环境最小配置：
```bash
JWT_SECRET=生成的随机字符串
USE_MOCK_ANALYSIS=true
# + 数据库配置（5项）
```

这样可以运行整个应用，只是分析结果是模拟的。

---

### Q: 邮件服务必须配置吗？

**A**: 
- 开发环境：**不需要**（验证码会在API响应中返回）
- 生产环境：**推荐配置**（更好的用户体验）

---

### Q: 如何确认配置正确？

**A**: 运行三个验证命令：
```bash
npm run check:env   # 检查环境变量
npm run test:db     # 测试数据库
npm test            # 运行测试套件
```

全部通过说明配置正确！

---

## 📚 相关文档

| 文档 | 用途 |
|------|------|
| `ENVIRONMENT_SETUP_GUIDE.md` | 详细配置指南 |
| `QUICKSTART_ZEABUR.md` | Zeabur 10分钟部署 |
| `DEPLOYMENT_CHECKLIST.md` | 部署清单 |
| `env.aliyun.example` | 环境变量模板 |
| `tests/README.md` | 测试文档 |
| `docs/getting-started/ALIYUN_QUICKSTART.md` | 阿里云快速开始 |

---

## ✅ 最终检查

完成以下所有项目后，你就可以开始部署了：

### 核心配置
- [ ] ✅ `.env` 文件已创建
- [ ] ✅ JWT_SECRET 已生成并配置
- [ ] ✅ 数据库配置完成
- [ ] ✅ GLM API Key 已获取
- [ ] ✅ 阿里云 AccessKey 已获取
- [ ] ✅ 通义听悟 AppKey 已获取

### 验证测试
- [ ] ✅ `npm run check:env` 通过
- [ ] ✅ `npm run test:db` 通过
- [ ] ✅ `npm test` 全部测试通过
- [ ] ✅ `npm run dev:all` 能正常启动
- [ ] ✅ 浏览器访问 http://localhost:8080 正常

### 部署准备
- [ ] ✅ 代码已推送到 GitHub
- [ ] ✅ 选择了部署平台（Zeabur / 阿里云）
- [ ] ✅ 阅读了对应的部署文档
- [ ] ✅ 准备好了生产环境的环境变量

---

## 🚀 准备好了？

**下一步**：
1. **Zeabur 部署**：查看 `QUICKSTART_ZEABUR.md`
2. **阿里云部署**：查看 `docs/deployment/DEPLOY.md`
3. **遇到问题**：查看 `ENVIRONMENT_SETUP_GUIDE.md`

---

**预计配置时间**: 30-60 分钟  
**部署时间**: 10-30 分钟  
**总计**: 1-2 小时即可上线！

**加油！🎉**

