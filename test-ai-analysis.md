# 测试真实 AI 分析功能

## 前提条件

1. **获取 OpenAI API Key**
   - 访问：https://platform.openai.com/api-keys
   - 创建新的 API Key（以 `sk-` 开头）
   - 确保账户有余额（至少 $5）

2. **准备测试视频**
   - 需要两个包含英语对话的视频链接
   - 视频必须可直接下载（公开的 URL）
   - 支持的格式：MP4, MP3, WAV, M4A 等

## 测试步骤

### 方法 1：通过 Web 界面测试（推荐）

1. **启动服务器**
   ```bash
   npm run dev:all
   ```

2. **打开浏览器**
   - 访问：http://localhost:8080

3. **填写表单**
   - 学生姓名：任意（例如"小明"）
   - 年级：选择任意年级
   - 级别：选择任意级别
   - 单元：可选
   - **视频链接**：填入两个真实的视频 URL（必须包含音频）
   - **启用"使用真实 AI 分析"开关**
   - **输入您的 OpenAI API Key**

4. **提交并等待**
   - 点击"生成学习报告"
   - 等待约 30-60 秒（取决于视频长度）
   - 查看后端终端输出进度

5. **查看结果**
   - 如果成功，将显示基于真实分析的学习报告
   - 如果失败，查看浏览器控制台和后端日志

### 方法 2：使用 cURL 测试

```bash
curl -X POST http://localhost:3001/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "video1": "你的视频1链接",
    "video2": "你的视频2链接",
    "studentName": "测试学生",
    "grade": "小学三年级",
    "level": "Level 3",
    "unit": "Unit 5",
    "useMockData": false,
    "apiKey": "sk-你的OpenAI API Key"
  }'
```

## 预期输出

### 后端控制台输出

```
🚀 Starting real AI video analysis for: 测试学生
📹 Video 1: [URL]
📹 Video 2: [URL]

=== 分析第一个视频（较早课堂）===
🎙️ Transcribing Video 1 (Earlier)...
⬇️ Downloading audio from: [URL]
✅ Download complete, size: XXXXX bytes
✅ Transcription complete for Video 1 (Earlier): [转录文本前100字]...
🤖 Analyzing Video 1 (Earlier) content with GPT-4...
✅ Analysis complete for Video 1 (Earlier)

=== 分析第二个视频（较新课堂）===
🎙️ Transcribing Video 2 (Later)...
⬇️ Downloading audio from: [URL]
✅ Download complete, size: XXXXX bytes
✅ Transcription complete for Video 2 (Later): [转录文本前100字]...
🤖 Analyzing Video 2 (Later) content with GPT-4...
✅ Analysis complete for Video 2 (Later)

=== 生成对比报告 ===
✅ Analysis complete for: 测试学生
```

### 成功的响应

返回 JSON 格式的学习报告，包含：
- `learningData`: 学习数据对比
- `progressDimensions`: 进步维度分析
- `improvementAreas`: 待改进领域

## 常见问题

### 1. 错误：Failed to download audio

**原因**：视频链接不可访问或需要认证

**解决方案**：
- 使用公开可访问的视频链接
- 或使用支持直接下载的视频托管服务

### 2. 错误：API Key 无效

**原因**：API Key 格式错误或已过期

**解决方案**：
- 检查 API Key 是否以 `sk-` 开头
- 从 OpenAI 平台重新生成 API Key
- 确保账户有余额

### 3. 错误：Timeout

**原因**：视频太大或 OpenAI API 响应慢

**解决方案**：
- 使用较短的视频（< 5 分钟）
- 检查网络连接
- 如果在国内，可能需要配置代理

### 4. 错误：Whisper API 不支持的文件格式

**原因**：视频格式不受支持

**解决方案**：
- 使用常见格式：MP4, MP3, WAV, M4A
- 确保视频包含音频轨道

## 测试视频推荐

### 免费测试音频源

1. **录制自己的英语对话**
   - 使用手机录音
   - 上传到云存储（如 Google Drive、Dropbox）
   - 获取公开共享链接

2. **使用示例音频**
   - Mozilla Common Voice: https://commonvoice.mozilla.org/
   - 下载免费的英语语音样本

3. **YouTube 视频转音频**
   - 使用在线工具下载 YouTube 音频
   - 上传到可公开访问的服务器

## 成本估算

基于 OpenAI 定价（2024年）：
- **Whisper API**: ~$0.006 / 分钟
- **GPT-4 Turbo**: ~$0.01 / 1K tokens（输入），~$0.03 / 1K tokens（输出）

**预计每次分析成本**：
- 2个 5分钟视频：Whisper ~$0.06
- GPT-4 分析：~$0.10 - $0.30
- **总计**：约 $0.15 - $0.40 / 次

## 下一步优化

如果测试成功，可以考虑：
1. 添加视频上传功能（而不是只支持 URL）
2. 支持更多视频格式
3. 添加进度条显示转录和分析进度
4. 缓存转录结果以节省成本
5. 添加关键帧截图分析（使用 GPT-4 Vision）

