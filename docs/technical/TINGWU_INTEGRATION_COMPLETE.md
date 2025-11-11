# ✅ 通义听悟集成完成

## 🎉 已完成的工作

### 1. ✅ 安装SDK
- 已安装 `@alicloud/tingwu20220930`
- 依赖 `@alicloud/openapi-client` 已自动安装

### 2. ✅ 创建服务类
- 文件：`server/services/tingwuTranscriptionService.ts`
- 实现了完整的通义听悟API集成
- 支持直接传URL（FileUrl参数）
- 支持说话人分离
- 支持进度回调

### 3. ✅ 集成到视频分析服务
- 文件：`server/services/videoAnalysisService.ts`
- 优先级：**通义听悟 > AssemblyAI**
- 自动降级机制：如果通义听悟不可用，自动降级到AssemblyAI

### 4. ✅ 功能特性

#### 通义听悟服务特性
- ✅ **价格优势**：¥0.01/分钟（比NLS便宜25倍）
- ✅ **免费额度**：每天2小时（比NLS多50倍）
- ✅ **支持直接传URL**：无需下载文件
- ✅ **支持说话人分离**：自动识别老师和学生
- ✅ **支持多种格式**：mp3, wav, m4a, mp4, wmv, mov, mkv等
- ✅ **国内访问**：速度快，无需VPN

#### 使用量统计
- 每天自动重置免费额度（2小时/天）
- 实时追踪使用量
- 自动检查剩余额度

---

## 📋 配置要求

### 必需的环境变量

```bash
# 通义听悟（必需）
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret

# 注意：通义听悟不需要 AppKey，只需要 AccessKey
```

### 可选的环境变量

```bash
# 代理配置（如果需要）
ALIYUN_PROXY_URL=http://proxy.example.com:8080
ALIYUN_ALLOW_PROXY=true

# TLS证书验证（调试时可选）
ALIYUN_REJECT_UNAUTHORIZED=false
```

---

## 🚀 使用方法

### 自动使用（推荐）

服务已自动集成到 `VideoAnalysisService`，无需修改代码。系统会：

1. **优先使用通义听悟**（如果已配置且额度充足）
2. **自动降级到AssemblyAI**（如果通义听悟不可用）

### 手动使用

```typescript
import { tingwuTranscriptionService } from './server/services/tingwuTranscriptionService.js';

// 检查服务是否可用
if (tingwuTranscriptionService.isAvailable()) {
  // 转写视频
  const result = await tingwuTranscriptionService.transcribeFromURL(videoUrl, {
    language: 'en',
    speakerLabels: true,
    onProgress: (progress) => {
      console.log(`进度: ${progress.progress}%`);
    }
  });
  
  console.log('转写结果:', result.text);
  console.log('说话人:', result.utterances);
}
```

---

## 🔍 API接口说明

### CreateFileTrans（创建转写任务）

**参数**：
- `fileUrl`: 视频文件URL（支持直接传URL）
- `language`: 语言代码（'en-US' 或 'zh-CN'）
- `enableSpeakerDiarization`: 是否启用说话人分离
- `maxSpeakers`: 最大说话人数量（默认2）

**返回**：
- `taskId`: 任务ID，用于后续查询

### GetFileTrans（查询转写任务）

**参数**：
- `taskId`: 任务ID

**返回**：
- `status`: 任务状态（'RUNNING', 'SUCCESS', 'FAILED'）
- `transcriptionResult`: 转写结果

---

## 📊 使用量统计

### 查看使用量

```typescript
const stats = tingwuTranscriptionService.getStats();
console.log('剩余额度:', stats.remainingMinutes, '分钟/天');
console.log('已使用:', stats.totalMinutesUsed, '分钟');
console.log('使用率:', stats.usagePercentage, '%');
```

### 免费额度说明

- **每天免费额度**：2小时（120分钟）
- **重置时间**：每天0点自动重置
- **超出部分**：¥0.01/分钟

---

## 🧪 测试

### 测试服务可用性

```typescript
// 检查服务是否可用
if (tingwuTranscriptionService.isAvailable()) {
  console.log('✅ 通义听悟服务可用');
} else {
  console.log('❌ 通义听悟服务不可用');
  console.log('请检查：');
  console.log('1. ALIYUN_ACCESS_KEY_ID 是否配置');
  console.log('2. ALIYUN_ACCESS_KEY_SECRET 是否配置');
  console.log('3. 免费额度是否充足');
}
```

### 测试转写功能

```typescript
try {
  const result = await tingwuTranscriptionService.transcribeFromURL(
    'https://example.com/video.mp4',
    {
      language: 'en',
      speakerLabels: true,
      onProgress: (progress) => {
        console.log(`进度: ${progress.progress}%`);
      }
    }
  );
  
  console.log('✅ 转写成功');
  console.log('文本:', result.text);
  console.log('时长:', result.duration, '秒');
} catch (error) {
  console.error('❌ 转写失败:', error.message);
}
```

---

## 🔄 迁移说明

### 从NLS迁移到通义听悟

**优势**：
- ✅ 价格便宜25倍（¥0.01/分钟 vs ¥0.25/分钟）
- ✅ 免费额度多50倍（每天2小时 vs 每月2小时）
- ✅ 功能兼容（支持直接传URL）
- ✅ 无需修改代码逻辑

**配置变更**：
- ❌ 不再需要 `ALIYUN_NLS_APP_KEY`
- ✅ 只需要 `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`

---

## ⚠️ 注意事项

1. **API端点**：默认使用上海区域（`tingwu.cn-shanghai.aliyuncs.com`）
2. **免费额度**：每天重置，不是每月重置
3. **网络连接**：建议直连，不要使用VPN代理
4. **文件大小**：支持最大6GB的文件
5. **支持格式**：mp3, wav, m4a, mp4, wmv, mov, mkv等

---

## 📚 参考文档

- [通义听悟API文档](https://help.aliyun.com/zh/tingwu/api-tingwu-2022-09-30-overview)
- [离线音视频文件转写文档](https://help.aliyun.com/zh/tingwu/offline-transcribe-of-audio-and-video-files)
- [通义听悟计费说明](https://help.aliyun.com/zh/tingwu/pricing-and-billing-rules)
- [迁移分析文档](./TINGWU_MIGRATION_ANALYSIS.md)
- [API文档总结](./TINGWU_API_DOCUMENTATION.md)

---

## 🐛 故障排除

### 问题1：服务不可用

**可能原因**：
- 环境变量未配置
- AccessKey配置错误
- 免费额度已用完

**解决方法**：
1. 检查环境变量是否正确配置
2. 检查AccessKey是否有效
3. 等待第二天额度重置

### 问题2：转写任务失败

**可能原因**：
- 视频URL不可访问
- 文件格式不支持
- 文件过大（>6GB）

**解决方法**：
1. 检查视频URL是否可公开访问
2. 确认文件格式是否支持
3. 检查文件大小是否超过限制

### 问题3：网络连接问题

**可能原因**：
- VPN代理干扰
- 网络不稳定
- TLS握手失败

**解决方法**：
1. 关闭VPN或配置NO_PROXY排除阿里云域名
2. 检查网络连接
3. 设置 `ALIYUN_ALLOW_PROXY=true` 如果必须使用代理

---

## ✅ 下一步

1. **配置环境变量**：设置 `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`
2. **测试服务**：运行一次视频分析，验证通义听悟是否正常工作
3. **监控使用量**：定期检查使用量统计，确保在免费额度内
4. **优化配置**：根据实际使用情况调整配置

---

**完成时间**：2025-01-XX
**状态**：✅ 已完成并集成

