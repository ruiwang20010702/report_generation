# AssemblyAI 集成文档

## 🎯 概述

本项目已成功集成 **AssemblyAI** 作为免费的视频转录服务，实现智能降级策略，优化成本和性能。

## 📊 核心优势

### 1. **成本节省**
- ✅ **每月免费 5 小时**（300 分钟）转录服务
- ✅ 相比 OpenAI Whisper 每月节省约 **$1.80**（按每天 10 个 5 分钟视频计算）
- ✅ 超出免费额度后自动降级到 Whisper，无需手动干预

### 2. **性能提升**
- ✅ **直接传 URL**，无需下载视频到本地
- ✅ 节省下载时间和磁盘空间
- ✅ 支持并行转录多个视频

### 3. **智能降级**
- ✅ 优先使用 AssemblyAI（免费）
- ✅ 额度用完自动切换到 Whisper（付费）
- ✅ 透明化使用量追踪

## 🚀 快速开始

### 1. 获取 API Key

1. 访问 [AssemblyAI 官网](https://www.assemblyai.com/)
2. 注册免费账户
3. 在 Dashboard 获取 API Key

### 2. 配置环境变量

在项目根目录的 `.env` 文件中添加：

```bash
# AssemblyAI API配置（免费5小时/月，支持URL直接转录）
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

### 3. 启动服务

```bash
npm install
npm run dev
```

## 📡 API 使用

### 分析视频（自动使用 AssemblyAI）

```bash
POST /api/analysis/analyze
```

**请求体：**
```json
{
  "studentName": "张三",
  "grade": "三年级",
  "level": "Level 3",
  "unit": "Unit 5",
  "video1": "https://example.com/video1.mp4",
  "video2": "https://example.com/video2.mp4",
  "apiKey": "your_openai_api_key"
}
```

**响应：**
系统会自动：
1. 优先使用 AssemblyAI 转录（免费）
2. 如果不可用或超额，降级到 Whisper
3. 使用 GPT-4 分析转录文本
4. 返回完整的学习分析报告

### 查询使用量

```bash
GET /api/analysis/quota
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
  "period": {
    "startDate": "2025-11-01T00:00:00.000Z",
    "resetFrequency": "monthly"
  },
  "costSavings": {
    "estimatedSavings": "$0.27",
    "description": "Compared to OpenAI Whisper ($0.006/minute)"
  }
}
```

## 🔧 技术架构

### 智能降级策略

```
用户请求视频分析
    ↓
检查 AssemblyAI 是否可用
    ↓
可用 → 使用 AssemblyAI（免费）
    ↓
不可用/超额 → 降级到 Whisper（付费）
    ↓
转录完成 → GPT-4 分析
    ↓
返回分析结果
```

### 代码示例

**videoAnalysisService.ts**

```typescript
// 智能转录方法（自动选择服务）
private async transcribeVideoSmart(
  videoUrl: string,
  videoLabel: string = 'video'
): Promise<TranscriptionResult> {
  try {
    // 策略1：优先使用 AssemblyAI
    if (assemblyAIService.isAvailable()) {
      console.log(`🎯 [${videoLabel}] 使用 AssemblyAI（免费服务）`);
      const result = await assemblyAIService.transcribeFromURL(videoUrl);
      console.log(`✅ [${videoLabel}] AssemblyAI 转录成功！`);
      return result;
    }
    
    // 策略2：降级到 Whisper
    console.log(`🎙️ [${videoLabel}] 使用 OpenAI Whisper（付费服务）`);
    throw new Error('FALLBACK_TO_WHISPER');
  } catch (error) {
    // 处理降级
    if (error.message === 'FALLBACK_TO_WHISPER') {
      throw error;
    }
    throw error;
  }
}
```

### 并行处理

系统支持同时转录多个视频：

```typescript
const [transcription1, transcription2] = await Promise.all([
  this.transcribeVideoSmart(video1Url, 'Video 1'),
  this.transcribeVideoSmart(video2Url, 'Video 2')
]);
```

## 📈 性能对比

### 转录速度对比

| 服务 | 5分钟视频 | 下载时间 | 总耗时 |
|------|----------|---------|--------|
| **AssemblyAI** | ~30-60秒 | ❌ 无需下载 | **~30-60秒** |
| OpenAI Whisper | ~20-40秒 | ✅ 需要下载 (10-30秒) | ~30-70秒 |

### 成本对比

假设每天处理 **10 个视频**，每个 **5 分钟**：

| 方案 | 月使用量 | AssemblyAI 免费 | Whisper 成本 | 实际成本 | 节省 |
|------|---------|----------------|-------------|---------|------|
| **仅 Whisper** | 1500 分钟 | ❌ | $9.00 | $9.00 | $0 |
| **AssemblyAI + Whisper** | 1500 分钟 | ✅ 前 300 分钟 | $7.20 | $7.20 | **$1.80** 💰 |

## 🔍 监控和调试

### 查看转录日志

系统会自动打印详细日志：

```
🎯 [Video 1] 使用 AssemblyAI（免费服务）
💰 当前剩余免费额度: 255 分钟
✅ [Video 1] AssemblyAI 转录成功！
💰 更新后剩余额度: 250 分钟
```

### 追踪使用量

```bash
# 查询当前使用量
curl http://localhost:3001/api/analysis/quota
```

## 🛠️ 故障排查

### AssemblyAI 不可用

**症状：** 系统自动降级到 Whisper

**可能原因：**
1. 未配置 `ASSEMBLYAI_API_KEY`
2. API Key 无效
3. 免费额度已用完

**解决方案：**
```bash
# 检查环境变量
echo $ASSEMBLYAI_API_KEY

# 查询剩余额度
curl http://localhost:3001/api/analysis/quota

# 如果额度用完，等待下月重置或使用 Whisper
```

### 转录失败

**症状：** 两个服务都失败

**可能原因：**
1. 视频 URL 不可访问
2. 视频格式不支持
3. 网络连接问题

**解决方案：**
```bash
# 测试视频 URL
curl -I https://your-video-url.mp4

# 确保视频格式支持（mp4, mp3, wav 等）
# 检查网络连接
```

## 🎓 最佳实践

### 1. 合理分配额度

```typescript
// 优先给重要任务使用 AssemblyAI
if (assemblyAIService.getStats().remainingMinutes < 30) {
  console.warn('⚠️  AssemblyAI 额度不足，建议等待下月重置');
}
```

### 2. 监控使用量

```typescript
// 定期查询使用量
const stats = assemblyAIService.getStats();
console.log(`使用率: ${stats.totalMinutesUsed}/${stats.freeMinutesLimit} 分钟`);
```

### 3. 优雅降级

系统已自动实现，无需手动处理：
- ✅ AssemblyAI 可用 → 自动使用
- ✅ AssemblyAI 不可用 → 自动降级到 Whisper
- ✅ 两者都不可用 → 返回明确错误信息

## 📚 参考资源

- [AssemblyAI 官方文档](https://www.assemblyai.com/docs)
- [AssemblyAI API 参考](https://www.assemblyai.com/docs/api-reference)
- [OpenAI Whisper 定价](https://openai.com/pricing)

## 🔗 相关文档

- [性能优化指南](../PERFORMANCE_OPTIMIZATION.md)
- [并行处理文档](./PARALLEL_PROCESSING.md)
- [超时分析文档](./TIMEOUT_ANALYSIS.md)

## 💡 未来改进

### 短期计划
- [ ] 将使用量统计持久化到数据库
- [ ] 添加使用量告警（如剩余 < 10%）
- [ ] 支持更多转录服务（Deepgram, Gladia）

### 长期计划
- [ ] 实现智能路由（根据视频长度选择服务）
- [ ] 添加转录结果缓存（避免重复转录）
- [ ] 支持批量转录任务队列

## ❓ FAQ

### Q: AssemblyAI 支持中文吗？
A: 支持！AssemblyAI 支持多种语言，包括中文。可以在配置中指定：
```typescript
language: 'zh' // 中文
```

### Q: 如何手动指定使用 Whisper？
A: 可以临时移除 `ASSEMBLYAI_API_KEY` 环境变量，系统会自动降级。

### Q: 免费额度何时重置？
A: AssemblyAI 免费额度每月重置一次，具体日期为注册日期。

### Q: 可以升级到付费计划吗？
A: 可以！访问 [AssemblyAI 定价页面](https://www.assemblyai.com/pricing) 查看付费选项。

---

**更新日期：** 2025-11-06  
**版本：** 1.0.0  
**维护者：** Development Team

