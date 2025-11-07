# OpenAI API Key 配置指南

## 概述

本系统支持两种使用方式：
1. **模拟数据模式**：免费测试，使用预设的示例报告
2. **真实 AI 分析**：使用 OpenAI GPT-4 Vision 进行实际视频分析

## 方式一：在前端界面中输入（推荐）

这是最简单、最安全的方式：

1. 启动应用后，在主页表单中找到 **"使用真实 AI 分析"** 开关
2. 打开开关后，会出现 API Key 输入框
3. 输入您的 OpenAI API Key（以 `sk-` 开头）
4. 提交表单即可进行分析

**优点**：
- ✅ API Key 仅在浏览器内存中临时保存
- ✅ 不会被存储到文件或服务器
- ✅ 关闭页面后自动清除

## 方式二：配置服务器环境变量

如果您想在服务器端配置 API Key（可选）：

1. 在项目根目录创建 `.env` 文件
2. 添加以下内容：

```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

3. 重启服务器即可生效

**注意**：
- ⚠️ 不要将 `.env` 文件提交到 Git
- ⚠️ `.env` 已经添加到 `.gitignore` 中

## 获取 OpenAI API Key

1. 访问 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 登录您的账户
3. 点击 "Create new secret key"
4. 复制生成的 API Key（格式：`sk-proj-...`）

## 费用说明

使用 OpenAI API 会产生费用，主要取决于：
- **视频长度**：视频越长，转录费用越高
- **使用的模型**：GPT-4 Vision 用于视频分析
- **分析复杂度**：生成的报告详细程度

**预估费用**（仅供参考）：
- 5-10分钟视频：约 $0.10-0.30 USD
- 建议为账户充值 $5-10 USD 用于测试

## 安全建议

1. **不要分享 API Key**：API Key 是您的私密凭证
2. **定期轮换**：建议每个月更换一次 API Key
3. **设置使用限额**：在 OpenAI 控制台设置月度消费上限
4. **监控使用情况**：定期检查 [Usage Dashboard](https://platform.openai.com/usage)

## 测试系统

### 测试模拟数据（免费）

```bash
curl -X POST http://localhost:3001/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studentName": "测试学生",
    "grade": "小学三年级",
    "level": "Level 3",
    "unit": "Unit 5",
    "video1": "任意URL",
    "video2": "任意URL",
    "useMockData": true
  }'
```

### 测试真实 AI（需要 API Key 和真实视频）

```bash
curl -X POST http://localhost:3001/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studentName": "测试学生",
    "grade": "小学三年级",
    "level": "Level 3",
    "unit": "Unit 5",
    "video1": "https://你的视频链接1.mp4",
    "video2": "https://你的视频链接2.mp4",
    "apiKey": "sk-your-api-key",
    "useMockData": false
  }'
```

## 常见问题

### Q: API Key 无效

**错误**：`Invalid API key`

**解决方案**：
- 检查 API Key 是否完整复制（以 `sk-` 开头）
- 确认 API Key 未过期
- 在 OpenAI 控制台验证 API Key 状态

### Q: 视频无法访问

**错误**：`无法访问视频URL`

**解决方案**：
- 确保视频 URL 可以公开访问
- 测试 URL 是否在浏览器中可以播放
- 检查视频格式是否为 mp4/webm 等常见格式

### Q: 分析超时

**错误**：`Request timeout`

**解决方案**：
- 视频可能过长，建议使用 5-10 分钟的视频
- 检查网络连接
- 稍后重试

## 支持

如有问题，请查看：
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 详细的故障排除指南
- [README.md](./README.md) - 完整的项目文档

