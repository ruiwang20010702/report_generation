# 环境配置指南

## 🎯 目标

配置完整的生产环境，准备部署到生产服务器。

---

## 📋 当前状态

✅ **已完成**：
- ✅ 所有测试通过（27个集成测试 + 单元测试）
- ✅ 生产环境优化完成（安全、日志、监控、性能）
- ✅ 数据库结构完整
- ✅ 代码质量检查通过

🔄 **进行中**：
- 🔄 环境变量配置
- 🔄 外部服务密钥获取
- 🔄 部署准备

---

## 📝 环境配置步骤

### 步骤 1：复制环境变量模板

```bash
# 复制示例文件
cp env.aliyun.example .env

# 或者使用交互式配置工具
npm run setup:env
```

### 步骤 2：获取必需的密钥和配置

以下是**必须配置**的环境变量清单：

#### 2.1 数据库配置（PostgreSQL）

**本地开发环境**：
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=english_learning
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false
```

**生产环境（阿里云 RDS）**：
```bash
DB_HOST=your-database.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=english_learning
DB_USER=your_user
DB_PASSWORD=your_password
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

#### 2.2 JWT 密钥（必填）

生成32位随机字符串：

```bash
# 方法1：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法2：使用 OpenSSL
openssl rand -hex 32

# 复制生成的字符串到 .env
JWT_SECRET=生成的随机字符串
```

#### 2.3 智谱 GLM API Key（必填 - 用于AI分析）

**获取步骤**：
1. 访问：https://open.bigmodel.cn/
2. 注册并登录
3. 进入控制台 → API Keys
4. 点击"创建新密钥"
5. 复制密钥（格式：`xxxxx.xxxxxx`）

```bash
GLM_API_KEY=your_glm_api_key_here
```

💡 **费用参考**：
- 首次注册送 18 元体验金
- GLM-4-Plus：¥0.05/千tokens（输入）+ ¥0.15/千tokens（输出）
- 一次完整分析约消耗 0.3-0.5 元

#### 2.4 阿里云通义听悟配置（必填 - 用于语音转文字）

**获取步骤**：

**A. 获取 AccessKey**：
1. 访问：https://ram.console.aliyun.com/manage/ak
2. 点击"创建 AccessKey"
3. 保存 AccessKey ID 和 AccessKey Secret

**B. 开通通义听悟服务**：
1. 访问：https://tingwu.console.aliyun.com/
2. 点击"开通服务"（选择"按量付费"）
3. 同意服务协议
4. 创建项目，获取项目 AppKey

**C. 配置环境变量**：
```bash
ALIYUN_ACCESS_KEY_ID=LTAI5txxxxxxxxxxxxxx
ALIYUN_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
ALIYUN_TINGWU_APP_KEY=your_tingwu_app_key
TINGWU_LANGUAGE=en
```

💡 **费用参考**：
- 免费额度：每天 2 小时（120分钟）
- 超出后：¥0.01/分钟
- 一次15分钟课程约消耗 ¥0.15

#### 2.5 邮件服务配置（可选 - 用于发送验证码）

**选项A：阿里云邮件推送（推荐）**

1. 访问：https://dm.console.aliyun.com/
2. 开通"邮件推送"服务
3. 创建发信域名并完成验证
4. 创建发信地址

```bash
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@yourdomain.com
```

**选项B：开发环境（无需配置）**

开发环境下，如果未配置邮件服务：
- 验证码会在 API 响应中返回
- 可以在浏览器 Network 面板看到验证码
- 不影响开发和测试

```bash
# 开发环境可以不配置邮件服务
# USE_MOCK_ANALYSIS=true
```

---

### 步骤 3：配置可选服务

#### 3.1 Sentry 错误追踪（生产环境推荐，可选）

**⚠️ 中国使用说明**：

官方Sentry（sentry.io）在中国**可以使用**，但有以下特点：
- ⚠️ 访问速度较慢（服务器在海外）
- ⚠️ 可能偶尔连接不稳定
- ✅ 不影响应用主要功能（错误上传是异步的）
- ✅ **永久免费**额度（5,000 errors/月，前14天全功能试用）

**三种方案**：

**方案1：使用官方Sentry**（推荐初期使用）
1. 访问：https://sentry.io/
2. 注册账号
3. 创建新项目（Node.js + React）
4. 获取 DSN

```bash
SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
```

✅ 优点：免费、快速开始、功能完整  
⚠️ 缺点：国内访问较慢

**方案2：使用阿里云ARMS**（推荐生产环境）
- 🔗 https://arms.console.aliyun.com/
- ✅ 国内访问快、稳定
- 💰 有免费额度，按量付费

**方案3：自建Sentry**（大规模使用）
- 部署到阿里云ECS
- ✅ 完全控制、无限制
- 💰 服务器成本约¥100-200/月

**建议**：
- 开发/初期：使用官方Sentry或直接不配置
- 生产/大规模：考虑阿里云ARMS或自建

💡 **可以先不配置**：Sentry是可选的，不影响核心功能。等应用稳定后再考虑。

#### 3.2 开发模式配置

```bash
# 开发环境
NODE_ENV=development
USE_MOCK_ANALYSIS=true  # 使用模拟数据，无需外部API
VITE_API_URL=http://localhost:3001

# 生产环境
NODE_ENV=production
USE_MOCK_ANALYSIS=false  # 使用真实AI分析
```

---

## ✅ 验证配置

### 检查1：验证环境变量

```bash
# 运行环境变量检查工具
npm run check:env

# 期望输出：
# ✓ 数据库配置完整
# ✓ JWT密钥已设置
# ✓ GLM API Key已设置
# ✓ 阿里云配置完整
```

### 检查2：测试数据库连接

```bash
# 测试数据库连接
npm run test:db

# 期望输出：
# ✅ 数据库连接成功
# ✅ 表结构验证通过
```

### 检查3：测试通义听悟

```bash
# 测试通义听悟连接（需要视频URL）
npm run test:tingwu

# 或使用测试脚本
node test-tingwu.ts
```

### 检查4：运行完整测试套件

```bash
# 运行所有测试
npm test

# 期望输出：
# Test Suites: 4 passed, 4 total
# Tests:       27 passed, 27 total
```

---

## 📊 配置模式对比

| 模式 | 适用场景 | 必需配置 | 可选配置 |
|------|----------|----------|----------|
| **开发模式（Mock）** | 本地开发、UI测试 | DB + JWT | - |
| **开发模式（真实）** | 集成测试、功能验证 | DB + JWT + GLM + 通义听悟 | Email |
| **生产环境（阿里云）** | 企业部署 | 全部 | Sentry |
| **生产环境（Docker）** | 容器部署 | 全部 | Email + Sentry |

---

## 🚀 下一步：部署准备

配置完成后，你可以选择以下部署方式：

### 选项1：阿里云部署（适合企业）

**优势**：
- ✅ 国内访问速度快
- ✅ 数据合规（中国境内）
- ✅ 与其他阿里云服务集成

**步骤**：
```bash
# 1. 构建生产版本
npm run build

# 2. 上传到阿里云 ECS
# 3. 配置 Nginx 反向代理
# 4. 配置 SSL 证书

参考：docs/deployment/DEPLOY.md
```

**预计成本**：¥200-500/月

---

## 📝 环境变量清单（完整版）

以下是完整的环境变量清单，方便你逐项检查：

```bash
# ========================================
# 核心配置（必填）
# ========================================
NODE_ENV=production                           # ✅ 必填
JWT_SECRET=your_jwt_secret                    # ✅ 必填
GLM_API_KEY=your_glm_key                      # ✅ 必填
ALIYUN_ACCESS_KEY_ID=your_ak_id               # ✅ 必填
ALIYUN_ACCESS_KEY_SECRET=your_ak_secret       # ✅ 必填
ALIYUN_TINGWU_APP_KEY=your_tingwu_key        # ✅ 必填

# ========================================
# 数据库配置
# ========================================
# 生产环境: 手动配置以下项
DB_HOST=your_db_host                          # 🔄 生产必填
DB_PORT=5432                                  # 🔄 生产必填
DB_NAME=your_db_name                          # 🔄 生产必填
DB_USER=your_db_user                          # 🔄 生产必填
DB_PASSWORD=your_db_password                  # 🔄 生产必填
DB_SSL=true                                   # 🔄 生产推荐

# ========================================
# 可选配置
# ========================================
USE_MOCK_ANALYSIS=false                       # ⭕ 可选
TINGWU_LANGUAGE=en                            # ⭕ 可选，默认en

# 邮件服务（可选）
SMTP_HOST=smtpdm.aliyun.com                   # ⭕ 生产推荐
SMTP_PORT=465                                 # ⭕ 生产推荐
SMTP_USER=your_smtp_user                      # ⭕ 生产推荐
SMTP_PASS=your_smtp_pass                      # ⭕ 生产推荐
SMTP_FROM=your_smtp_from                      # ⭕ 生产推荐

# Sentry 监控（可选）
SENTRY_DSN=your_sentry_dsn                    # ⭕ 生产推荐
VITE_SENTRY_DSN=your_sentry_dsn              # ⭕ 生产推荐

# 前端配置（开发环境）
VITE_API_URL=http://localhost:3001            # ⭕ 开发环境
```

---

## 🆘 常见问题

### Q1: 我没有阿里云账号，可以先测试吗？

**A**: 可以！使用 Mock 模式：
```bash
USE_MOCK_ANALYSIS=true
```
这样可以测试所有 UI 功能，无需外部 API。

### Q2: JWT_SECRET 应该设置为多长？

**A**: 至少32个字符，建议64个字符。使用命令生成：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Q3: 通义听悟配置后仍然失败？

**A**: 检查以下几点：
1. AccessKey 是否与 AppKey 属于同一个阿里云账号
2. 是否已开通通义听悟服务
3. 是否有足够的余额或免费额度
4. 查看详细错误日志：
```bash
npm run dev:backend
# 查看控制台输出
```

### Q4: 邮件服务配置很麻烦，可以跳过吗？

**A**: 可以！开发环境下：
- 验证码会在 API 响应中返回
- 可以在浏览器 DevTools 的 Network 面板查看

生产环境建议配置邮件服务以提升用户体验。

### Q5: 如何切换 Mock 模式和真实模式？

**A**: 有两种方式：
1. **全局切换**：修改 `.env` 中的 `USE_MOCK_ANALYSIS`
2. **请求级切换**：在前端表单勾选"使用模拟数据"

---

## 📚 相关文档

- 📖 [部署指南](./deployment/DEPLOY.md)
- 📖 [部署清单](./DEPLOYMENT_CHECKLIST.md)
- 📖 [阿里云快速开始](./docs/getting-started/ALIYUN_QUICKSTART.md)
- 📖 [生产环境优化总结](./PRODUCTION_OPTIMIZATION_SUMMARY.md)
- 📖 [测试指南](./tests/README.md)
- 📖 [数据库配置](./database/README.md)

---

## ✅ 配置完成检查清单

- [ ] 已复制 `.env` 文件
- [ ] JWT_SECRET 已生成并配置
- [ ] 数据库配置完成并测试通过
- [ ] GLM API Key 已获取并配置
- [ ] 阿里云 AccessKey 已获取
- [ ] 通义听悟 AppKey 已获取并配置
- [ ] 运行 `npm run check:env` 通过
- [ ] 运行 `npm run test:db` 通过
- [ ] 运行 `npm test` 全部测试通过
- [ ] 可选：邮件服务已配置
- [ ] 可选：Sentry 已配置
- [ ] 代码已推送到 GitHub
- [ ] 准备开始部署

---

**预计完成时间**：30-60 分钟（取决于是否需要注册新账号）

**下一步**：完成配置后，选择部署平台（阿里云或 Docker）并开始部署！🚀

