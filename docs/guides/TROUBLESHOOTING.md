# 🔧 故障排除指南

## ❓ 问题：服务器无响应（3分钟后超时）

### 症状
- 提交表单后，显示"正在分析视频..."
- 等待 3 分钟后，页面跳回初始界面
- 显示"服务器无响应"错误

### 可能原因

#### 1. **视频 URL 问题**（最常见）
- ✗ 视频 URL 无法访问
- ✗ 视频需要认证/登录
- ✗ 视频太大（>50MB）
- ✗ 视频下载速度很慢

#### 2. **网络问题**
- ✗ 网络连接不稳定
- ✗ 无法访问 OpenAI API（国内用户）
- ✗ 防火墙阻止

#### 3. **API 问题**
- ✗ OpenAI API Key 无效
- ✗ API 配额用完
- ✗ API 响应慢

---

## ✅ 解决方案

### 方案 1：使用模拟数据测试（推荐先试）

**这样可以快速验证系统是否正常工作**

1. 访问 http://localhost:8080
2. 点击"快速测试"按钮（会自动填充示例数据）
3. **确保"使用真实 AI 分析"开关是关闭的** ⚠️
4. 点击"生成学习报告"
5. 应该在 1-2 秒内看到结果

**如果模拟模式工作正常** → 问题在真实 AI 分析部分  
**如果模拟模式也失败** → 前后端配置有问题

---

### 方案 2：检查视频 URL

#### 测试视频是否可访问

在终端运行：
```bash
# 测试视频1
curl -I "你的视频1的URL"

# 测试视频2  
curl -I "你的视频2的URL"
```

**期望结果：** 看到 `HTTP/2 200` 或 `HTTP/1.1 200`

**如果看到 404、403、需要认证等** → 视频 URL 无效

#### 检查视频大小

```bash
# 下载视频并查看大小（会在5秒后停止）
timeout 5 curl "你的视频URL" -o /tmp/test_video.mp4
ls -lh /tmp/test_video.mp4
rm /tmp/test_video.mp4
```

**建议：使用 < 20MB 的视频**

#### 使用测试视频

如果您的视频有问题，可以使用这些公开测试视频：

```
视频1: https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4
视频2: https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_2mb.mp4
```

⚠️ 注意：这些是示例视频，不包含英语对话，AI 分析结果可能不准确，但可以测试系统功能。

---

### 方案 3：查看服务器日志

**这是最重要的诊断步骤！**

1. **停止当前服务**（如果在运行）
   - 按 `Ctrl+C` 停止 `npm run dev:all`

2. **在终端1启动后端**（会显示详细日志）
```bash
cd /Users/ruiwang/Desktop/test
npm run dev:server
```

3. **在终端2启动前端**
```bash
cd /Users/ruiwang/Desktop/test
npm run dev
```

4. **提交分析请求**

5. **观察终端1的日志输出**

#### 日志会显示：

```
📝 Received analysis request:
   Student: 测试学生
   Video 1: https://example.com/video1.mp4...
   Video 2: https://example.com/video2.mp4...
🤖 Using REAL AI analysis mode
   API Key provided: sk-proj-ab...
⬇️ Downloading audio from: https://example.com/video1.mp4
   📥 Download progress: 25% (5.2MB)
   📥 Download progress: 50% (10.4MB)
   ... (如果卡在这里 → 下载问题)
✅ Download complete in 2.34s, size: 15.2MB
🎙️ Transcribing video1...
   ... (如果卡在这里 → Whisper API 问题)
✅ Transcription complete
🤖 Analyzing video1 content with GPT-4...
   ... (如果卡在这里 → GPT API 问题)
```

#### 根据日志定位问题：

| 卡在哪里 | 原因 | 解决方案 |
|---------|------|---------|
| 下载进度 0% | URL 无效 | 检查视频 URL |
| 下载进度卡住 | 下载慢/网络问题 | 使用更小的视频 |
| Transcribing... | Whisper API 慢/失败 | 检查 API Key，等待更长时间 |
| Analyzing... | GPT API 慢/失败 | 检查 API Key 和配额 |
| 无任何日志 | 请求未到达后端 | 检查前端配置 |

---

### 方案 4：增加超时时间（如果视频很大）

如果您的视频确实很大（>50MB），可以增加超时：

编辑 `src/services/api.ts`：
```typescript
timeout: 600000, // 改为10分钟
```

编辑 `server/services/whisperService.ts`：
```typescript
timeout: 300000, // 改为5分钟
```

⚠️ 但是：**建议使用较小的视频，而不是增加超时**

---

### 方案 5：配置代理（国内用户）

如果您在中国大陆，可能无法直接访问 OpenAI API：

编辑 `.env`：
```bash
# 添加代理配置
HTTPS_PROXY=http://your-proxy-address:port
HTTP_PROXY=http://your-proxy-address:port
```

重启服务器。

---

## 🧪 测试步骤（按顺序）

### 步骤 1：测试模拟模式
```bash
# 访问 http://localhost:8080
# 点击"快速测试"
# 关闭"使用真实AI分析"
# 点击"生成学习报告"
```
✅ 通过 → 继续步骤2  
❌ 失败 → 检查前后端是否都在运行

### 步骤 2：测试真实AI（小视频）
```bash
# 使用测试视频 URL：
视频1: https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4
视频2: https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_2mb.mp4

# 启用"使用真实AI分析"
# 输入 API Key
# 提交并查看后端日志
```
✅ 通过 → 问题在您的视频 URL  
❌ 失败 → 查看日志，检查 API Key

### 步骤 3：测试您的视频
```bash
# 先用 curl 测试 URL
curl -I "你的视频URL"

# 确认可以访问后
# 在表单中使用
# 查看后端日志
```

---

## 📊 常见错误信息

### "服务器无响应"
**原因：** 请求超时（前端5分钟，后端3分钟）  
**解决：** 
- 查看后端日志
- 使用更小的视频
- 检查网络连接

### "使用真实AI分析需要提供 OpenAI API Key"
**原因：** 启用了真实AI但未输入 API Key  
**解决：** 
- 在表单中输入 API Key
- 或者关闭"使用真实AI分析"开关

### "Failed to download audio"
**原因：** 视频下载失败  
**解决：**
- 检查视频 URL 是否有效
- 使用 `curl -I <url>` 测试
- 确保视频是公开访问的

### "Failed to transcribe video"
**原因：** Whisper API 失败  
**解决：**
- 检查 API Key 是否正确
- 检查 API 配额
- 确保网络可以访问 OpenAI

### "OpenAI API error"
**原因：** GPT-4 API 调用失败  
**解决：**
- 检查 API Key 权限
- 查看 https://platform.openai.com/usage
- 配置代理（如果在国内）

---

## 🚀 快速诊断命令

运行诊断脚本：
```bash
./diagnose-issue.sh
```

查看后端日志（推荐）：
```bash
# 终端1
npm run dev:server

# 终端2  
npm run dev

# 然后提交请求，观察终端1的输出
```

测试视频 URL：
```bash
curl -I "你的视频URL"
```

测试 OpenAI 连接：
```bash
curl -H "Authorization: Bearer sk-your-api-key" \
  https://api.openai.com/v1/models
```

---

## 💡 最佳实践

1. **视频要求**
   - ✅ 大小：< 20MB
   - ✅ 时长：3-5 分钟
   - ✅ 格式：MP4, MP3, WAV, M4A
   - ✅ 访问：公开可访问的 URL
   - ✅ 内容：包含清晰的英语对话

2. **测试流程**
   - ✅ 先用模拟模式测试 UI
   - ✅ 再用测试视频测试真实AI
   - ✅ 最后用实际视频测试
   - ✅ 始终查看后端日志

3. **成本控制**
   - ✅ 开发时使用模拟模式
   - ✅ 测试时使用短视频
   - ✅ 生产时使用真实 AI

---

## 📞 还是不行？

如果以上方法都无法解决问题：

1. **收集信息**
   - 截图错误信息
   - 复制后端完整日志
   - 复制浏览器控制台日志
   - 记录视频 URL（如果可以分享）

2. **提供详细信息**
   - 操作系统
   - Node.js 版本：`node -v`
   - 网络环境（国内/国外）
   - 是否使用代理

3. **尝试最小化复现**
   ```bash
   # 使用最简单的配置
   # 使用测试视频
   # 启用详细日志
   # 记录完整步骤
   ```

---

**记住：查看后端日志是诊断问题的最有效方法！** 🔍
