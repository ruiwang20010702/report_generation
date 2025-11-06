# AssemblyAI 快速开始指南 🚀

## 🎯 为什么要配置 AssemblyAI？

- ✅ **每月免费 5 小时**（300 分钟）转录服务
- ✅ **节省成本** - 每月约节省 $1.80
- ✅ **更快速度** - 直接传 URL，无需下载视频
- ✅ **零风险** - 自动降级到 Whisper，不影响现有功能

## 📝 5 分钟配置教程

### 步骤 1: 注册 AssemblyAI 账户（2 分钟）

1. 访问 https://www.assemblyai.com/
2. 点击右上角 **"Sign Up"** 或 **"Get Started for Free"**
3. 使用 Google/GitHub 账号或邮箱注册
4. 验证邮箱（如果需要）

### 步骤 2: 获取 API Key（1 分钟）

1. 登录后，进入 Dashboard
2. 左侧菜单找到 **"API Keys"** 或 **"Settings"**
3. 找到 **"API Key"** 部分
4. 点击 **"Copy"** 复制你的 API Key（格式类似：`abc123def456...`）

### 步骤 3: 配置到项目（2 分钟）

打开项目根目录的 `.env` 文件，添加：

```bash
# AssemblyAI API配置（免费5小时/月，支持URL直接转录）
ASSEMBLYAI_API_KEY=你复制的API_Key
```

**示例：**
```bash
ASSEMBLYAI_API_KEY=abc123def456ghi789jkl012mno345pqr678
```

### 步骤 4: 重启服务器

```bash
# 如果服务器正在运行，先停止（Ctrl+C）
# 然后重新启动
npm run dev:server
```

你应该看到：
```
✅ AssemblyAI service initialized
```

## 🎉 完成！开始使用

现在当你提交视频分析请求时，系统会：

1. ✅ **优先使用 AssemblyAI**（免费）
2. 🔄 如果不可用或超额，**自动降级到 Whisper**
3. 📊 自动追踪使用量

## 📊 监控使用量

### 方法 1: 查看日志

运行服务器时，日志会显示：

```
🎯 [Video 1] 使用 AssemblyAI（免费服务）
💰 当前剩余免费额度: 255 分钟
✅ [Video 1] AssemblyAI 转录成功！
💰 更新后剩余额度: 250 分钟
```

### 方法 2: API 查询

```bash
curl http://localhost:3001/api/analysis/quota
```

**响应示例：**
```json
{
  "service": "AssemblyAI",
  "available": true,
  "quota": {
    "totalMinutes": 300,
    "usedMinutes": 45,
    "remainingMinutes": 255,
    "usagePercentage": 15
  },
  "costSavings": {
    "estimatedSavings": "$0.27",
    "description": "Compared to OpenAI Whisper ($0.006/minute)"
  }
}
```

## 🧪 测试集成

### 1. 使用测试视频

```bash
curl -X POST http://localhost:3001/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studentName": "测试学生",
    "grade": "三年级",
    "level": "Level 3",
    "unit": "Unit 5",
    "video1": "你的视频URL1",
    "video2": "你的视频URL2",
    "apiKey": "你的OpenAI_API_Key",
    "useMockData": false
  }'
```

### 2. 检查日志

你应该看到：

```
🎯 [Video 1] 使用 AssemblyAI（免费服务）
💰 当前剩余免费额度: 300 分钟
✅ [Video 1] AssemblyAI 转录成功！
```

如果看到这个，说明配置成功！🎉

## ❓ 常见问题

### Q1: 如果不配置 AssemblyAI 会怎样？

A: 系统会自动使用 Whisper（付费），功能完全正常，只是成本稍高。

### Q2: 免费额度用完了怎么办？

A: 系统会自动切换到 Whisper，无需任何操作。日志会显示：

```
ℹ️  [Video 1] AssemblyAI 不可用（免费额度已用完），使用 Whisper
```

### Q3: 免费额度何时重置？

A: 每月重置一次，重置日期为你注册的日期。

### Q4: 可以升级到付费计划吗？

A: 可以！访问 https://www.assemblyai.com/pricing 查看付费选项。但对于大多数用例，免费额度已经足够。

### Q5: AssemblyAI 支持中文吗？

A: 支持！可以在代码中修改语言配置：

```typescript
assemblyAIService.transcribeFromURL(videoUrl, {
  language: 'zh' // 中文
})
```

### Q6: 转录质量如何？

A: AssemblyAI 和 Whisper 质量相当，都使用先进的语音识别技术。

## 🔧 故障排查

### 问题 1: 看到 "AssemblyAI API key not found"

**解决方案：**
1. 检查 `.env` 文件中是否有 `ASSEMBLYAI_API_KEY`
2. 确保没有拼写错误
3. 重启服务器

### 问题 2: 转录失败，自动降级到 Whisper

**可能原因：**
- API Key 无效
- 网络连接问题
- 视频 URL 不可访问

**解决方案：**
1. 验证 API Key 是否正确
2. 测试视频 URL: `curl -I "你的视频URL"`
3. 检查网络连接

### 问题 3: 使用量统计不准确

**说明：**
当前使用量统计存储在内存中，重启服务器会重置。未来会持久化到数据库。

## 📚 更多资源

- [完整集成文档](./docs/ASSEMBLYAI_INTEGRATION.md)
- [AssemblyAI 官方文档](https://www.assemblyai.com/docs)
- [性能优化指南](./PERFORMANCE_OPTIMIZATION.md)

## 💡 最佳实践

### 1. 定期检查使用量

```bash
# 添加到你的监控脚本
curl http://localhost:3001/api/analysis/quota | jq '.quota.remainingMinutes'
```

### 2. 合理分配额度

- 优先用于生产环境
- 开发测试使用 Mock 数据
- 重要分析使用 AssemblyAI
- 批量任务使用 Whisper

### 3. 监控成本节省

系统会自动追踪节省的成本，可以定期查看：

```bash
curl http://localhost:3001/api/analysis/quota | jq '.costSavings'
```

---

## 🎊 恭喜！

你已经成功配置了 AssemblyAI 免费转录服务！

现在每次视频分析都会：
- ✅ 优先使用免费服务
- ✅ 自动追踪使用量
- ✅ 节省运营成本
- ✅ 保持高质量转录

**开始使用吧！** 🚀

---

**需要帮助？** 查看 [完整文档](./docs/ASSEMBLYAI_INTEGRATION.md) 或提交 Issue。

