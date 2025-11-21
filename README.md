# 51Talk 英语学习分析系统

AI 驱动的英语学习视频对比分析平台，帮助老师和教研团队量化学生进步、追踪成本，并输出可直接分享的教学报告。

## 功能亮点

- 🔐 **企业账号登录**：支持 `@51talk.com` 邮箱验证码或密码登录，JWT + HttpOnly Cookie 保证安全。
- 🎙️ **通义听悟极速转写**：默认使用通义听悟教育模型，自动说话人识别，享受每天 120 分钟免费额度。
- 🧠 **智谱 GLM-4-Plus 深度分析**：固定使用国内质量最高的 GLM-4-Plus，输出结构化进步报告和成本明细。
- 📊 **进步对比仪表盘**：举手次数、完整句率、语言准确度、四大能力维度等指标一目了然。
- 🧾 **成本与用量追踪**：自动记录转写与模型调用费用，管理端可查询历史报告与成本统计。
- 🧪 **双模式支持**：本地开发可开启 Mock 数据，无需外部依赖；生产环境使用真实 AI 管线。

## 系统架构速览

- **前端**：React 18 + Vite + TypeScript + shadcn/ui + Tailwind，统一走 `VITE_API_URL` 调后端
- **后端**：Express + TypeScript，负责鉴权、转写调度、GLM 分析、报告合成、成本统计
- **数据库**：PostgreSQL 17 (PolarDB)，存储用户、验证码、报告记录
- **AI 服务**：
  - 智谱 GLM-4-Plus（文本分析）
  - 阿里云通义听悟（语音转写）
- **其他服务**：邮件推送（阿里云 DirectMail）、Sentry 监控

## 快速开始

### 前置依赖

- Node.js 18+（建议 20 LTS）
- npm 9+ 或 pnpm/yarn（示例命令使用 npm）
- 运行中的 PostgreSQL 数据库（本地或云端）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

1. 复制示例文件：
   ```bash
   cp env.aliyun.example .env
   ```
2. 或运行交互式向导：
   ```bash
   npm run setup:env
   ```
3. 核心配置项
   - 数据库：`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`
   - 通义听悟：`ALIYUN_ACCESS_KEY_ID`, `ALIYUN_ACCESS_KEY_SECRET`, `ALIYUN_TINGWU_APP_KEY`
   - 智谱 GLM：`GLM_API_KEY`
   - 邮件服务（验证码）：`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - 开发模式可设置 `USE_MOCK_ANALYSIS=true`，`GLM_API_KEY`/`ALIYUN_*` 可暂时留空

> 提示：开发环境若未配置邮件，API 会在响应体中返回验证码，便于调试。

### 3. 初始化数据库

```bash
# 检查环境变量
npm run check:env

# 创建基础表（users / otps / reports）
npm run setup:db

# 验证连接
npm run test:db
```

### 4. 启动开发环境

```bash
# 同时启动前后端（推荐）
npm run dev:all

# 仅后端（http://localhost:3001）
npm run dev:backend

# 仅前端（http://localhost:8080）
npm run dev:frontend
```

访问 `http://localhost:8080`，使用 `@51talk.com` 邮箱登录：

1. 验证码模式：点击发送验证码，开发环境可在浏览器 Network 面板的响应中看到 `data.code`
2. 密码模式：管理员可通过 `/api/auth/set-password` 或数据库脚本为账号设置密码

### 5. 运行一次分析

1. 在登录后首页填写学生信息与两段课堂视频 URL
2. **Mock 模式**：在表单勾选“使用模拟数据”（或 `.env` 设置 `USE_MOCK_ANALYSIS=true`）
3. **真实分析**：取消勾选、确保 `.env` 配置了通义听悟与 GLM；如需自带 Key，可在表单中填写
4. 等待转写 + 分析完成，下载长图报告或查看成本明细

## 模式切换

| 模式 | 触发条件 | 适用场景 |
| ---- | -------- | -------- |
| Mock 模式 | 表单开启“使用模拟数据” 或 `.env` 设置 `USE_MOCK_ANALYSIS=true` | UI 联调、演示、无外部依赖 |
| 真实分析 | `.env` 中 `USE_MOCK_ANALYSIS=false` 且具备 GLM / 通义听悟配置，或用户表单提供 GLM Key | 正式教学分析、成本统计 |

## 真实管线必备配置

- `GLM_API_KEY`：智谱开放平台 → 创建 API Key → 赋值到 `.env`
- `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`：阿里云控制台 → AccessKey 管理
- `ALIYUN_TINGWU_APP_KEY`：通义听悟控制台 → 创建项目 → 获取 AppKey
- 可选：`TINGWU_LANGUAGE`（默认 `en`）、`HTTPS_PROXY`（内网访问智谱/阿里云时使用）

参考文档：
- [docs/getting-started/ALIYUN_QUICKSTART.md](docs/getting-started/ALIYUN_QUICKSTART.md)
- [docs/model-config/AI模型对比.md](docs/model-config/AI模型对比.md)
- [docs/guides/快速开始-国内AI模型.md](docs/guides/快速开始-国内AI模型.md)

## 常用脚本

```bash
npm run dev:all         # 前后端并行
npm run dev:backend     # 仅后端
npm run dev:frontend    # 仅前端
npm run build           # 打包（结果位于 dist/ + build/server）
npm run start           # 运行生产构建
npm run lint            # ESLint
npm run setup:env       # 交互式环境变量配置
npm run setup:db        # 初始化数据库结构
npm run test:db         # 数据库连通性测试
npm run test:tingwu     # 通义听悟连通性测试
npm run setup:ai        # 向导式 AI 配置检查
```

## API 概览

### 授权
- `POST /api/auth/send-otp`：发送 6 位验证码（限制 `@51talk.com` 域）
- `POST /api/auth/verify-otp`：验证码登录，返回用户与 token
- `POST /api/auth/login`：邮箱 + 密码登录
- `POST /api/auth/set-password`：设置/重置密码
- `GET /api/auth/me`：获取当前登录用户
- `POST /api/auth/logout`：清除登录状态

### 分析
- `POST /api/analysis/analyze`：核心分析接口（Mock / 真实模式自动判定）
- `POST /api/analysis/transcribe-test`：通义听悟调试工具，返回说话人片段
- `GET /api/analysis/health`：健康检查
- `GET /api/analysis/quota`：查询通义听悟剩余额度

### 管理
- `GET /api/admin/reports`：分页查询历史报告与成本
- `GET /api/admin/cost-statistics`：按用户汇总成本
- `GET /api/admin/user-reports/:userId`：指定用户生成的报告

所有接口默认启用全局限流、特定路径限流（分析请求 / 登录尝试）以及详细日志。

## 前端主要模块

- `VideoAnalysisForm`：表单校验、验证码发送、Mock 切换、AI Key 输入
- `LoadingState`：并行处理实时进度提示（15 秒刷新一次）
- `ReportDisplay`：三块数据展示、GLM 生成内容渲染、成本明细、长图导出
- `ProtectedRoute` + `AuthContext`：鉴权守卫与用户信息缓存

## 技术栈

**前端**
- React 18 + TypeScript
- Vite 5、@tanstack/react-query、React Router
- Tailwind CSS + shadcn/ui + Radix UI
- html2canvas、lucide-react、sonner

**后端**
- Express + TypeScript + tsx
- PostgreSQL (`pg`)、数据库连接池与守护
- 通义听悟 SDK、自研成本统计
- 智谱 GLM-4-Plus（OpenAI SDK 指向自定义 baseURL）
- Nodemailer（阿里云邮件推送）
- express-rate-limit、cookie-parser、dotenv、https-proxy-agent

## 文档导航

- 快速入门：`docs/getting-started/QUICK_START.md`
- 环境配置：`docs/getting-started/ENVIRONMENT_SETUP.md`
- 阿里云语音：`docs/getting-started/ALIYUN_QUICKSTART.md`
- AI 模型对比：`docs/model-config/AI模型对比.md`
- 故障排查：`docs/guides/IMMEDIATE_HELP.md`, `docs/guides/TROUBLESHOOTING.md`
- 测试指引：`docs/guides/TESTING_GUIDE.md`
- 部署：`docs/deployment/DEPLOY.md`

## 部署建议

- **Docker 容器**：使用项目根目录的 `Dockerfile`，支持一键容器化部署
- **阿里云 ECS/容器**：确保配置所有环境变量，开放 3001 端口，建议配置 HTTPS
- **Nginx 反向代理**：前端静态文件指向 `dist/`，API 请求代理到 `node build/server/index.js`

> **注意**：Vercel 和 Zeabur 相关配置已归档到 `docs/deployment/vercel/` 和 `docs/archive/`，当前不推荐使用这些平台部署

## 项目结构

```
51talk-learning-analysis/
├── src/                    # 前端源码
│   ├── components/        # React 组件（VideoAnalysisForm, ReportDisplay等）
│   ├── pages/             # 页面组件（Index, Login）
│   ├── contexts/          # Context（AuthContext）
│   ├── services/          # API 服务
│   └── assets/            # 静态资源
├── server/                 # 后端源码
│   ├── routes/            # API 路由（analysis, auth, admin）
│   ├── services/          # 业务服务（videoAnalysis, tingwu, email）
│   ├── middleware/        # 中间件（auth, security, logging）
│   ├── config/            # 配置（database, sentry）
│   └── utils/             # 工具函数
├── database/               # 数据库脚本
│   ├── schema.sql         # 完整表结构
│   ├── init.sql           # 初始化脚本
│   └── archive/           # 历史迁移脚本
├── scripts/                # 辅助脚本
│   ├── setup-database.ts  # 数据库初始化
│   ├── setup-env.ts       # 环境配置向导
│   └── check-env.ts       # 配置检查
├── tests/                  # 测试文件
│   └── integration/       # 集成测试（27个测试）
├── docs/                   # 项目文档
│   ├── archive/           # 归档的过时文档和说明文档
│   ├── work-reports/      # 工作日报周报
│   ├── deployment/        # 部署相关文档
│   │   └── vercel/       # Vercel 配置归档（不推荐使用）
│   ├── guides/            # 使用指南
│   ├── technical/         # 技术文档
│   └── getting-started/   # 快速入门
├── public/                 # 前端静态资源
├── build/                  # 后端构建产物
├── dist/                   # 前端构建产物
├── README.md              # 项目说明（本文件）
└── package.json           # 项目配置
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue / PR，或通过邮件与团队沟通改进需求。

## 相关链接

- 📊 [查看当前状态](docs/CURRENT_STATUS.md)
- ⚙️ [配置检查清单](docs/CONFIG_CHECKLIST.md)
- 🧪 [测试指南](tests/README.md)
