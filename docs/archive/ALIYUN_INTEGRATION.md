# 阿里云语音服务集成文档 🇨🇳

## 🎯 概述

本项目已成功集成**阿里云智能语音服务**作为**国内首选**的视频转录方案，无需VPN即可使用，完美解决 AssemblyAI 在国内无法访问的问题。

## 🌟 核心优势

### 1. **国内网络优化**
- ✅ 阿里云国内服务器，访问速度快
- ✅ **无需VPN**，直接访问
- ✅ 稳定性高，延迟低

### 2. **免费额度充足**
- ✅ **每月免费 2 小时**（120分钟）转录服务
- ✅ 超出免费额度后仅需 **¥0.25/分钟**（约 $0.035/分钟）
- ✅ 相比 OpenAI Whisper ($0.006/分钟) 稍贵，但免费额度更实惠

### 3. **功能完善**
- ✅ 支持**英语识别**
- ✅ 支持**说话人分离**（区分老师和学生）
- ✅ 支持直接传 URL，无需下载视频
- ✅ 提供词级别时间戳

### 4. **智能降级策略**
```
阿里云（首选）→ AssemblyAI（备选）→ Whisper（保底）
    ↓                ↓                  ↓
国内免费2h       国际免费5h          付费$0.006/分钟
```

## 🚀 快速开始

### 步骤 1: 注册阿里云账号

1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 注册并完成实名认证
3. 进入 [智能语音交互控制台](https://nls-portal.console.aliyun.com/)

### 步骤 2: 开通语音服务

1. 在控制台点击**立即开通**
2. 选择**录音文件识别服务**（File Transcription）
3. 确认开通（有2小时免费额度）

### 步骤 3: 创建项目和获取密钥

#### 3.1 创建 AppKey

1. 进入控制台 → **项目管理**
2. 点击**创建项目**
3. 填写项目名称：`51talk-video-analysis`
4. 创建成功后，复制 **AppKey**（类似：`nls-xxxxx`）

#### 3.2 创建 AccessKey

1. 点击右上角头像 → **AccessKey 管理**
2. 创建 AccessKey（会生成 AccessKey ID 和 AccessKey Secret）
3. **重要**：AccessKey Secret 只显示一次，请妥善保管！

### 步骤 4: 配置环境变量

在项目根目录的 `.env` 文件中添加：

```bash
# 阿里云语音服务配置（国内首选，免费2小时/月）
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_NLS_APP_KEY=your_app_key

# 示例（请替换为实际值）:
# ALIYUN_ACCESS_KEY_ID=LTAI5txxxxxxxxxxxxxxxx
# ALIYUN_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
# ALIYUN_NLS_APP_KEY=nls-xxxxxxxxxxxxx
```

### 步骤 5: 安装依赖并启动

```bash
# 安装依赖（如果是新包）
npm install uuid
npm install @types/uuid --save-dev

# 启动服务
npm run dev:all
```

## 📡 API 使用

### 自动使用阿里云

系统会自动检测并使用阿里云服务，无需修改任何代码：

```bash
# 发起视频分析请求
POST /api/analysis/analyze
```

**系统会自动：**
1. ✅ 优先使用阿里云转录（如果已配置）
2. ✅ 如果阿里云不可用，降级到 AssemblyAI
3. ✅ 如果 AssemblyAI 也不可用，最终使用 Whisper
4. ✅ 自动追踪使用量，透明化成本

### 查询使用量

```bash
curl http://localhost:3001/api/analysis/quota
```

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
  },
  "assemblyai": {
    "available": true,
    "remainingMinutes": 255
  }
}
```

## 🔧 技术细节

### 转录流程

```typescript
// aliyunTranscriptionService.ts 核心流程

1. 提交任务（submitTask）
   ├─ 构造API参数
   ├─ 生成签名（HMAC-SHA1）
   └─ 提交到阿里云

2. 轮询状态（pollTaskCompletion）
   ├─ 每5秒查询一次
   ├─ 更新进度（0-100%）
   └─ 等待完成或超时（5分钟）

3. 解析结果（parseTranscriptionResult）
   ├─ 提取完整文本
   ├─ 解析词级别信息
   ├─ 构建说话人分组
   └─ 更新使用量统计
```

### 签名算法

阿里云使用 **HMAC-SHA1** 签名算法：

```typescript
// 1. 排序参数
const sortedParams = Object.keys(params).sort();

// 2. 构造待签名字符串
const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`;

// 3. 计算签名
const signature = crypto
  .createHmac('sha1', accessKeySecret + '&')
  .update(stringToSign)
  .digest('base64');
```

### 说话人分离

```typescript
// 启用说话人分离
const params = {
  Task: JSON.stringify({
    language: 'en-US',
    auto_split: true,        // 自动分句
    max_num_speaker: 2,      // 最多2个说话人（老师+学生）
  })
};
```

## 📊 成本对比

### 场景：每天 10 个视频 × 5 分钟 = 50 分钟/天

| 方案 | 月使用量 | 免费额度 | 付费部分 | 月成本 | 年成本 |
|------|---------|---------|---------|--------|--------|
| **仅 Whisper** | 1500分钟 | ❌ 无 | 1500分钟 × $0.006 | **$9.00** | $108.00 |
| **仅阿里云** | 1500分钟 | ✅ 前120分钟 | 1380分钟 × ¥0.25 | **¥345** (~$48) | ~$576 |
| **阿里云 + Whisper** | 1500分钟 | ✅ 前120分钟 | 1380分钟 × $0.006 | **$8.28** | $99.36 |
| **阿里云 + AssemblyAI + Whisper** | 1500分钟 | ✅ 前420分钟 | 1080分钟 × $0.006 | **$6.48** | $77.76 |

### 💡 最佳策略

**推荐：阿里云 + AssemblyAI + Whisper 三层降级**

- ✅ 每月前 120 分钟：使用**阿里云**（免费）
- ✅ 121-420 分钟：使用 **AssemblyAI**（免费，需VPN）
- ✅ 超出 420 分钟：使用 **Whisper**（付费）
- ✅ **每月可节省 $2.52**，年节省 **$30.24** 💰

## 🧪 测试验证

### 测试脚本

```bash
# 测试阿里云转录（需要视频URL）
curl -X POST http://localhost:3001/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studentName": "张三",
    "grade": "三年级",
    "level": "Level 3",
    "unit": "Unit 5",
    "video1": "https://example.com/video1.mp4",
    "video2": "https://example.com/video2.mp4",
    "apiKey": "sk-your-openai-key"
  }'    
```

### 查看日志

启动服务后查看控制台：

```
✅ 阿里云语音服务已初始化
💰 当前剩余免费额度: 120 分钟

🇨🇳 [Video 1] 使用阿里云语音服务（国内免费服务）
💰 当前剩余免费额度: 120 分钟
✅ 阿里云转录任务已提交，TaskId: xxx
⏳ 转录进行中... (35%)
✅ 转录任务完成！
✅ [Video 1] 阿里云转录成功！
💰 更新后剩余额度: 115 分钟
```

## 🛠️ 故障排查

### 问题 1: "阿里云语音服务未配置"

**症状：** 日志显示 `⚠️  阿里云语音服务未配置（将使用 Whisper 备用）`

**原因：** 环境变量未正确配置

**解决方案：**
```bash
# 检查环境变量
echo $ALIYUN_ACCESS_KEY_ID
echo $ALIYUN_ACCESS_KEY_SECRET
echo $ALIYUN_NLS_APP_KEY

# 确保 .env 文件存在并正确配置
cat .env | grep ALIYUN
```

### 问题 2: "签名验证失败"

**症状：** 请求返回 `SignatureDoesNotMatch` 错误

**原因：**
1. AccessKey Secret 错误
2. 系统时间不同步
3. 参数编码问题

**解决方案：**
```bash
# 1. 验证 AccessKey
# 登录阿里云控制台重新检查

# 2. 同步系统时间
sudo ntpdate time.apple.com  # macOS
sudo ntpdate ntp.ubuntu.com  # Linux

# 3. 检查代码中的签名逻辑
```

### 问题 3: "转录任务超时"

**症状：** 等待超过5分钟，提示超时

**原因：**
1. 视频过长（>30分钟）
2. 视频格式不支持
3. 网络连接问题

**解决方案：**
```bash
# 1. 使用较短的视频（5-10分钟）
# 2. 确保视频格式为 MP4, MP3, WAV 等主流格式
# 3. 检查网络连接

# 测试网络连接
curl -I https://nls-filetrans.cn-shanghai.aliyuncs.com
```

### 问题 4: "免费额度已用完"

**症状：** 日志显示 `免费额度已用完`

**解决方案：**

**选项 1：等待下月重置**
```bash
# 查看重置日期
curl http://localhost:3001/api/analysis/quota
```

**选项 2：充值阿里云账户**
```bash
# 访问阿里云控制台充值
# 超出免费额度后按 ¥0.25/分钟 计费
```

**选项 3：使用其他服务**
```bash
# 系统会自动降级到 AssemblyAI 或 Whisper
# 无需手动干预
```

## 📚 参考资源

### 官方文档
- [阿里云智能语音交互](https://help.aliyun.com/product/30413.html)
- [录音文件识别 API](https://help.aliyun.com/document_detail/90727.html)
- [签名机制](https://help.aliyun.com/document_detail/90728.html)

### 控制台链接
- [智能语音交互控制台](https://nls-portal.console.aliyun.com/)
- [AccessKey 管理](https://ram.console.aliyun.com/manage/ak)
- [项目管理](https://nls-portal.console.aliyun.com/applist)

## 🎓 最佳实践

### 1. 环境变量管理

```bash
# .env.local（本地开发）
ALIYUN_ACCESS_KEY_ID=your_dev_key
ALIYUN_ACCESS_KEY_SECRET=your_dev_secret
ALIYUN_NLS_APP_KEY=your_dev_app_key

# .env.production（生产环境）
ALIYUN_ACCESS_KEY_ID=your_prod_key
ALIYUN_ACCESS_KEY_SECRET=your_prod_secret
ALIYUN_NLS_APP_KEY=your_prod_app_key
```

### 2. 错误处理

```typescript
try {
  const result = await aliyunTranscriptionService.transcribeFromURL(videoUrl);
} catch (error) {
  if (error.message.includes('quota')) {
    // 额度不足，降级到其他服务
    console.log('阿里云额度不足，使用 Whisper');
    result = await whisperService.transcribe(videoUrl);
  } else {
    // 其他错误
    throw error;
  }
}
```

### 3. 使用量监控

```typescript
// 定期检查使用量
setInterval(() => {
  const stats = aliyunTranscriptionService.getStats();
  
  if (stats.usagePercentage > 80) {
    console.warn('⚠️  阿里云额度即将用完:', stats.remainingMinutes);
  }
}, 3600000); // 每小时检查一次
```

## 🔮 未来改进

### 短期计划
- [ ] 将使用量持久化到数据库（Redis/MongoDB）
- [ ] 添加使用量告警通知（邮件/短信）
- [ ] 支持批量转录任务队列

### 长期计划
- [ ] 集成腾讯云语音识别（备选方案）
- [ ] 集成讯飞开放平台（备选方案）
- [ ] 实现智能路由（根据视频长度和网络状况选择服务）
- [ ] 添加转录结果缓存（避免重复转录）

## 💡 总结

通过集成阿里云语音服务，本项目成功解决了以下问题：

✅ **国内访问问题**：无需VPN，直接使用国内服务  
✅ **成本优化**：每月2小时免费额度  
✅ **智能降级**：阿里云 → AssemblyAI → Whisper 三层保障  
✅ **功能完善**：支持英语识别和说话人分离  

**推荐配置：**
- 国内用户：阿里云 + Whisper
- 国际用户：AssemblyAI + Whisper
- 最佳方案：阿里云 + AssemblyAI + Whisper（三层降级）

---

**更新日期：** 2025-11-07  
**版本：** 1.0.0  
**维护者：** Development Team

