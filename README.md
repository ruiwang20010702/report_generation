# 51Talk 英语学习分析系统

一个基于AI的英语学习视频智能分析平台，帮助教师和家长追踪学生的英语学习进步。

## ✨ 主要功能

- 📹 **视频对比分析** - 上传两个不同时期的学习视频，AI自动分析进步情况
- 🇨🇳 **国内优化** - 使用**阿里云语音服务**，国内访问无需VPN（每月免费2小时）
- 🎙️ **语音转录服务** - 强制使用阿里云语音服务，确保输出一致性
- 🤖 **真实 AI 分析** - 支持多种AI模型（GPT-4、通义千问、DeepSeek、GLM-4）分析转录内容
- 💰 **成本优化** - 阿里云免费额度（120分钟/月），大幅降低运营成本
- 📊 **多维度评估** - 从流利度、自信度、语言应用、句型复杂度等维度全面评估
- 📈 **数据可视化** - 清晰展示举手次数、回答长度、完整句子率等关键指标
- 🎯 **个性化建议** - 针对发音、语法、语调等方面提供具体改进建议
- 📄 **长图报告导出** - 一键导出高质量的长图学习分析报告
- 🔄 **双模式支持** - 可选择真实 AI 分析或模拟数据测试
- 🚀 **性能优化** - 直接传 URL 转录，无需下载视频，节省时间和空间

## 🚀 快速开始

### 🇨🇳 国内用户推荐配置（5分钟搞定）

**超高性价比方案** - 比纯 OpenAI 方案节省 **99.5%** 成本！

#### 语音转文字：阿里云（免费）
- 📝 [5分钟快速配置](./docs/getting-started/ALIYUN_QUICKSTART.md)
- ✅ 每月免费 2 小时
- ✅ 国内直连，无需 VPN
- ✅ 速度快、质量好

#### 智能分析：国内 AI 模型（3选1）

| 模型 | 推荐场景 | 成本 | 配置时间 |
|------|---------|------|---------|
| 🔷 **DeepSeek** | 性价比首选 | ¥0.01/次 | [2分钟配置](./快速开始-国内AI模型.md#方案-1️⃣deepseek推荐---性价比最高) |
| 🇨🇳 **通义千问** | 免费额度大 | 月1000次免费 | [2分钟配置](./快速开始-国内AI模型.md#方案-2️⃣通义千问推荐---免费额度大) |
| 🧠 **智谱GLM** | 质量最好 | Flash免费 | [2分钟配置](./快速开始-国内AI模型.md#方案-3️⃣智谱-glm-4推荐---质量最好) |

📚 **详细对比** → [AI模型对比.md](./AI模型对比.md) | 💡 **快速指南** → [快速开始-国内AI模型.md](./快速开始-国内AI模型.md)

### 🌍 国际用户配置

- **语音转文字**：AssemblyAI（需VPN，每月免费5小时）- [获取免费密钥](https://www.assemblyai.com/)
- **智能分析**：OpenAI GPT-4（需代理）

### 前置要求
- Node.js 16+ 和 npm

### 安装和运行

#### 方式一：仅前端（使用模拟数据）

```bash
# 1. 安装依赖
npm install

# 2. 启动前端开发服务器
npm run dev

# 3. 打开浏览器访问
# http://localhost:5173
```

#### 方式二：前后端完整运行（真实AI分析）

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
# 复制 .env 文件并配置你的 OpenAI API 密钥
# 编辑 .env 文件：
# OPENAI_API_KEY=your_actual_api_key_here
# USE_MOCK_ANALYSIS=false  # 设为false启用真实AI分析

# 3. 同时启动前端和后端
npm run dev:all

# 或分别启动：
# 终端1: npm run dev          (前端: http://localhost:5173)
# 终端2: npm run dev:server   (后端: http://localhost:3001)
```

> **提示**: 如果你还没有OpenAI API密钥，可以保持 `USE_MOCK_ANALYSIS=true` 使用模拟数据进行测试。

访问后，您可以：
1. 点击 **"快速测试"** 按钮自动填充示例数据
2. 或手动填写学生信息和视频链接
3. 点击 **"生成学习报告"** 查看分析结果
4. 点击 **"下载长图报告"** 导出报告

### ⚠️ 遇到问题？

#### 快速诊断
```bash
./diagnose-issue.sh
```

#### "服务器无响应"（超时 3-5 分钟）
**最可能原因：** 视频 URL 无法访问、下载慢或文件太大

**立即解决：**
1. **先测试模拟模式** - 关闭"使用真实AI"开关，验证系统正常
2. **查看后端日志** - 运行 `npm run dev:server` 观察详细输出
3. **测试视频URL** - `curl -I "你的视频URL"` 确认可访问
4. **使用小视频** - 推荐 <20MB，3-5分钟的视频

**详细帮助：**
- 📘 [IMMEDIATE_HELP.md](./IMMEDIATE_HELP.md) - 紧急问题解决（优先查看！）
- 📕 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 完整故障排除
- 📗 [USAGE_GUIDE.md](./USAGE_GUIDE.md) - 详细使用指南

## 📖 详细使用说明

查看 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 获取完整的测试指南和功能说明。

## 🎨 界面预览

### 1. 表单页面
- 填写学生基本信息（姓名、年级、级别）
- 输入两个视频链接（较早的视频 vs 较新的视频）
- 实时URL验证和预览功能

### 2. 加载页面
- 可爱的猴子吉祥物跳动动画
- 实时进度条显示
- 4步分析流程展示

### 3. 报告页面
- **关键学习数据**: 举手次数、回答长度、完整句子率、阅读准确率
- **四大维度进步分析**: 流利度、自信度、语言应用、句型复杂度
- **待提升点分析**: 发音准确性、语法细节、语调与节奏
- 一键PDF导出功能

## 🛠️ 技术栈

### 前端技术
- **React 18** - 前端框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **shadcn/ui** - 高质量UI组件库（基于Radix UI）
- **Tailwind CSS** - 实用优先的CSS框架
- **html2canvas** - 长图生成
- **Lucide React** - 美观的图标库
- **React Router** - 路由管理
- **TanStack Query** - 数据获取和状态管理
- **Axios** - HTTP客户端

### 后端技术
- **Node.js + Express** - 后端服务器
- **TypeScript** - 类型安全
- **阿里云智能语音服务** - 语音转文字服务（强制使用，120分钟/月免费）
- **OpenAI GPT-4 API** - AI 内容分析和报告生成（支持多种模型）
- **通义千问 API** - 国内AI模型（可选，100万tokens/月免费）
- **DeepSeek API** - 国内AI模型（可选，性价比高）
- **智谱GLM-4 API** - 国内AI模型（可选，质量优秀）
- **Axios** - HTTP 客户端（下载视频文件）
- **form-data** - 文件上传处理
- **https-proxy-agent** - 代理支持
- **tsx** - TypeScript 执行器
- **CORS** - 跨域资源共享
- **dotenv** - 环境变量管理

## 📦 项目结构

```
.
├── src/                          # 前端源码
│   ├── components/               # React组件
│   │   ├── ui/                   # shadcn/ui基础组件
│   │   ├── VideoAnalysisForm.tsx # 表单组件
│   │   ├── LoadingState.tsx      # 加载动画组件
│   │   └── ReportDisplay.tsx     # 报告展示组件
│   ├── pages/                    # 页面组件
│   │   ├── Index.tsx             # 主页
│   │   └── NotFound.tsx          # 404页面
│   ├── services/                 # API服务
│   │   └── api.ts                # 视频分析API客户端
│   ├── hooks/                    # 自定义Hooks
│   ├── lib/                      # 工具函数
│   ├── assets/                   # 静态资源（Logo、吉祥物图片）
│   └── App.tsx                   # 应用入口
│
├── server/                       # 后端源码
│   ├── services/                 # 业务逻辑层
│   │   ├── videoAnalysisService.ts  # 视频分析服务（智能降级）
│   │   ├── assemblyAIService.ts  # AssemblyAI 转录服务
│   │   └── whisperService.ts     # Whisper 转录服务
│   ├── routes/                   # API路由
│   │   └── analysis.ts           # 分析相关路由
│   ├── types/                    # 类型定义
│   │   └── index.ts              # 共享类型
│   └── index.ts                  # 服务器入口
│
├── .env                          # 环境变量配置
├── .env.example                  # 环境变量示例
├── package.json                  # 项目依赖
└── README.md                     # 项目文档
```

## 🎯 功能特性

### ✅ 已实现功能
- [x] 完整的三阶段用户流程（表单 → 加载 → 报告）
- [x] 表单验证和错误提示
- [x] 实时URL验证和预览
- [x] **真实 AI 视频分析**（阿里云语音 + 多种AI模型）
- [x] **语音转录服务**（阿里云智能语音，120分钟/月免费）
- [x] **多AI模型支持**（GPT-4、通义千问、DeepSeek、GLM-4）
- [x] **成本优化**（阿里云免费额度，大幅降低运营成本）
- [x] **使用量追踪**（API 端点监控免费额度）
- [x] **智能内容分析**（支持多种AI模型）
- [x] **后端API服务**（Express + TypeScript）
- [x] **前后端分离架构**
- [x] **双模式支持**（真实 AI 分析 / 模拟数据测试）
- [x] 模拟数据模式（用于开发测试）
- [x] 丰富的数据可视化展示
- [x] 长图报告一键导出
- [x] Toast消息提示
- [x] 响应式设计（支持移动端、平板、桌面）
- [x] 品牌化设计（51Talk黄蓝配色方案）
- [x] 快速测试数据填充功能
- [x] 错误处理和用户反馈
- [x] 代理支持（便于国内访问 OpenAI API）

### 🔜 未来规划
- [ ] 视频文件上传功能（替代URL输入）
- [ ] 实时进度显示（转录进度、分析进度）
- [ ] 视频播放器预览
- [ ] GPT-4 Vision 集成（分析表情和肢体语言）
- [ ] 转录结果缓存（节省成本）
- [ ] 历史报告查看和管理
- [ ] 用户认证和授权
- [ ] 多语言支持（中英文切换）
- [ ] 数据图表（趋势线、对比图）
- [ ] 数据库集成（MongoDB/PostgreSQL）
- [ ] 恢复智能降级策略（阿里云 → AssemblyAI → Whisper）

## 🧪 测试

### 运行测试
```bash
npm run dev
```

然后按照 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 中的测试清单进行功能测试。

### 快速测试
1. 启动应用后，点击表单右上角的 **"快速测试"** 按钮
2. 点击 **"生成学习报告"**
3. 等待加载完成查看报告
4. 测试PDF导出功能

## 📝 开发命令

```bash
# 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# 启动后端API服务器
npm run dev:server

# 同时启动前后端（推荐）
npm run dev:all

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 🔧 配置说明

### 环境变量配置

编辑 `.env` 文件：

```bash
# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key_here  # 必填（GPT-4 分析）

# 阿里云语音服务配置（国内用户推荐，免费 2 小时/月）
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_NLS_APP_KEY=your_app_key

# 服务器配置
PORT=3001                                 # 后端端口
FRONTEND_URL=http://localhost:5173        # 前端URL（用于CORS）

# 分析模式
USE_MOCK_ANALYSIS=true                    # true=模拟数据, false=真实AI分析

# 代理配置（可选，国内用户推荐）
# HTTPS_PROXY=http://127.0.0.1:4780       # HTTP(S) 代理地址
# HTTP_PROXY=http://127.0.0.1:4780
# ALL_PROXY=socks5h://127.0.0.1:4781      # 可选：SOCKS5 代理

# 前端API URL
VITE_API_URL=http://localhost:3001        # 后端API地址
```

### 如何获取阿里云语音服务密钥（国内用户推荐）

1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 注册并完成实名认证
3. 进入 [智能语音交互控制台](https://nls-portal.console.aliyun.com/)
4. 开通录音文件识别服务
5. 创建项目并获取 AppKey
6. 创建 AccessKey（ID 和 Secret）
7. **免费额度：2 小时/月**（120 分钟）
8. 每月节省约 **$0.72** 转录成本

> **提示**: 阿里云提供免费转录服务，国内用户无需VPN即可使用，速度快、稳定性高！

详细配置步骤请参考：[阿里云5分钟快速配置指南](./docs/getting-started/ALIYUN_QUICKSTART.md)

### 如何获取OpenAI API密钥

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的API密钥（以 `sk-` 开头）
5. 复制密钥并粘贴到 `.env` 文件或在 Web 表单中输入

> **注意**: OpenAI API是付费服务，请确保账户有足够余额。使用 `USE_MOCK_ANALYSIS=true` 可以在不消耗API额度的情况下测试系统。

## 🎙️ 使用真实 AI 分析

本系统支持两种分析模式：

### 模式 1：模拟数据（免费测试）
- 使用预设的示例数据
- 无需 API Key
- 适合演示和测试 UI

### 模式 2：真实 AI 分析（推荐）
使用 OpenAI Whisper + GPT-4 进行真实分析：

#### 工作流程
1. **语音转录** - 使用阿里云智能语音服务（免费120分钟/月）
2. **并行处理** - 两个视频同时转录，节省时间
3. **内容分析** - AI模型分析转录文本，提取学习特征（支持多种模型）
4. **对比报告** - AI模型对比两个视频，生成进步报告

#### 使用步骤
1. 准备两个包含英语对话的视频（公开 URL）
2. 在表单中**启用"使用真实 AI 分析"开关**
3. **输入 OpenAI API Key**（以 `sk-` 开头）
4. 填写学生信息和视频链接
5. 提交表单，等待 30-60 秒

#### 成本估算（优化后）
- **阿里云语音**: 免费（前 120 分钟/月），超出后 ¥0.25/分钟
- **AI分析模型**: 
  - 通义千问：免费（100万tokens/月），超出后 ¥0.008/1K tokens
  - DeepSeek：¥0.01/次分析
  - GPT-4 Turbo：~$0.10 - $0.30 / 次分析
- **总计**: 约 ¥0.01 - $0.30 / 次（取决于使用的AI模型）
- **节省**: 每月约 **$0.72+**（假设每天 10 个 5 分钟视频，使用免费额度）

#### 注意事项
- 视频必须包含音频内容
- 视频 URL 必须可公开访问（无需登录）
- 推荐视频长度：3-10 分钟
- 支持格式：MP4, MP3, WAV, M4A 等
- 国内用户建议配置代理（设置 `HTTPS_PROXY` 环境变量）

详细测试指南请参考：[test-ai-analysis.md](./test-ai-analysis.md)

## 📊 API 端点

### 分析视频
```
POST /api/analysis/analyze
```

提交视频分析请求，系统会自动使用最优的转录服务。

### 健康检查
```
GET /api/analysis/health
```

检查服务器状态。

### 查询使用量
```
GET /api/analysis/quota
```

查询阿里云语音服务免费额度使用情况：

**响应示例：**
```json
{
  "aliyun": {
  "available": true,
    "freeMinutesLimit": 120,
    "totalMinutesUsed": 25,
    "remainingMinutes": 95,
    "usagePercentage": 21,
    "resetDate": "2025-12-01T00:00:00.000Z"
  }
}
```

**详细文档：** [阿里云集成指南](./docs/technical/ALIYUN_INTEGRATION.md)

## 🚨 故障排除

### 问题1: 无法连接到服务器
- 确保后端服务器正在运行（`npm run dev:server`）
- 检查端口3001是否被占用
- 验证 `.env` 中的 `VITE_API_URL` 配置正确

### 问题2: AI API错误
- 验证 API Key 是否正确（根据使用的模型检查对应的环境变量）
- 检查账户余额（如果是付费服务）
- 如需测试，设置 `USE_MOCK_ANALYSIS=true`

### 问题3: 长图生成失败
- 确保报告页面完全加载
- 检查浏览器控制台错误信息
- 尝试刷新页面后重新生成
- 确保浏览器支持 html2canvas 功能

## 🎨 设计系统

### 品牌色彩
- **主色（Primary）**: #FDD100（51Talk黄色）
- **副色（Secondary）**: #00B4E6（51Talk蓝色）
- **成功色（Success）**: 绿色（用于进步趋势）
- **警告色（Destructive）**: 红色（用于需改进项）

### 组件库
使用 shadcn/ui 提供的30+个高质量组件，包括：
- Button, Card, Input, Select
- Alert, Badge, Progress
- Toast, Dialog, Dropdown
- 等等...

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交问题和拉取请求！

---

## 原始项目信息

**Lovable Project URL**: https://lovable.dev/projects/cc81f235-0532-434b-9cb6-baa44f839cc4

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cc81f235-0532-434b-9cb6-baa44f839cc4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
