# 环境变量配置指南

## 快速开始

系统现在使用 **环境变量** 来管理 API Key，无需在前端表单中输入。

### 1. 配置 API Keys

编辑项目根目录的 `.env` 文件：

```bash
# OpenAI API配置（必需 - 用于真实AI分析）
OPENAI_API_KEY=sk-proj-你的OpenAI密钥

# AssemblyAI API配置（必需 - 用于视频转录）
ASSEMBLYAI_API_KEY=你的AssemblyAI密钥

# 分析模式（可选）
USE_MOCK_ANALYSIS=false  # false=真实分析, true=模拟数据
```

### 2. 获取 API Keys

#### OpenAI API Key
1. 访问：https://platform.openai.com/api-keys
2. 创建新的 API Key
3. 复制到 `.env` 文件的 `OPENAI_API_KEY`

#### AssemblyAI API Key
1. 访问：https://www.assemblyai.com/
2. 注册账号（免费提供 5 小时/月）
3. 在 Dashboard 获取 API Key
4. 复制到 `.env` 文件的 `ASSEMBLYAI_API_KEY`

### 3. 前端使用

前端表单现在只有一个简单的开关：

- **关闭**（默认）：使用模拟数据，快速测试界面和流程
- **打开**：使用真实 AI 分析，调用后端配置的 API Keys

**不再需要在前端输入 API Key！** 🎉

## 优势

✅ **更安全**：API Key 存储在服务器，不会暴露给浏览器  
✅ **更方便**：配置一次，永久使用  
✅ **更简洁**：前端只需一个开关按钮  
✅ **团队友好**：多人使用同一个 API Key，统一管理

## 故障排除

### 问题：打开"真实 AI 分析"后报错

**解决方案**：
1. 检查 `.env` 文件是否存在于项目根目录
2. 确认 API Keys 已正确配置
3. 重启后端服务：`npm run server`
4. 查看后端日志，确认是否正确加载了环境变量

### 问题：想临时使用模拟数据测试

**解决方案**：
在前端表单中，关闭"使用真实 AI 分析"开关即可。

### 问题：需要更换 API Key

**解决方案**：
1. 编辑 `.env` 文件
2. 更新对应的 API Key
3. 重启后端服务

## 环境变量完整列表

```bash
# ============ API Keys ============
OPENAI_API_KEY=sk-...          # OpenAI GPT-4 密钥
ASSEMBLYAI_API_KEY=...         # AssemblyAI 转录密钥

# ============ 服务器配置 ============
PORT=3001                       # 后端端口
FRONTEND_URL=http://localhost:8080  # 前端URL（CORS配置）

# ============ 分析模式 ============
USE_MOCK_ANALYSIS=false        # true=模拟数据, false=真实API

# ============ 前端配置 ============
VITE_API_URL=http://localhost:3001  # 后端API地址

# ============ 数据统计（可选）============
VITE_BAIDU_ANALYTICS_ID=xxx    # 百度统计站点ID（在 hm.js? 后面的字符串）

# ============ 代理配置（可选）============
# 如果在不支持的地区，需要配置代理
# HTTPS_PROXY=http://127.0.0.1:4780
# HTTP_PROXY=http://127.0.0.1:4780
# ALL_PROXY=socks5h://127.0.0.1:4781
```

## 安全提示

⚠️ **重要**：`.env` 文件已在 `.gitignore` 中，不会被提交到 Git  
⚠️ **警告**：永远不要将 `.env` 文件提交到公共代码仓库  
⚠️ **建议**：定期更换 API Keys，监控使用量

