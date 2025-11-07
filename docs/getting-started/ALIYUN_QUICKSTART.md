# 🇨🇳 阿里云语音服务快速开始

## 🎯 为什么选择阿里云？

如果您在**中国大陆**使用本系统，强烈推荐使用阿里云语音服务：

- ✅ **无需VPN**：国内服务器，直接访问
- ✅ **免费额度**：每月2小时（120分钟）
- ✅ **速度快**：低延迟，稳定性高
- ✅ **功能完善**：支持英语识别和说话人分离

## ⚡ 5分钟快速配置

### 步骤 1: 注册阿里云账号 (2分钟)

1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 点击右上角**免费注册**
3. 完成手机号验证和实名认证

### 步骤 2: 开通智能语音服务 (1分钟)

1. 进入 [智能语音交互控制台](https://nls-portal.console.aliyun.com/)
2. 点击**立即开通**
3. 选择**录音文件识别服务**
4. 确认开通（**免费，无需付费**）

### 步骤 3: 创建项目和获取密钥 (2分钟)

#### 3.1 创建 AppKey

```bash
控制台 → 项目管理 → 创建项目
  ├─ 项目名称: 51talk-video-analysis
  └─ 创建成功后复制 AppKey (格式：nls-xxxxx)
```

**示例 AppKey：** `nls-xxxxxxxxxxxxxx`

#### 3.2 创建 AccessKey

```bash
右上角头像 → AccessKey 管理 → 创建 AccessKey
  ├─ AccessKey ID: LTAI5txxxxxxxxxxxxxxxx
  └─ AccessKey Secret: xxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **重要**：AccessKey Secret 只显示一次，请立即保存！

### 步骤 4: 配置环境变量 (1分钟)

在项目根目录创建或编辑 `.env` 文件：

```bash
# 复制示例文件
cp env.aliyun.example .env

# 或手动创建 .env 文件，添加以下内容：
```

```bash
# 阿里云配置
ALIYUN_ACCESS_KEY_ID=LTAI5txxxxxxxxxxxxxxxx
ALIYUN_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
ALIYUN_NLS_APP_KEY=nls-xxxxxxxxxxxxx

# OpenAI 配置（用于 GPT-4 分析）
OPENAI_API_KEY=sk-your-openai-api-key

# 其他配置
USE_MOCK_ANALYSIS=false
VITE_API_URL=http://localhost:3001
```

### 步骤 5: 安装依赖并启动 (1分钟)

```bash
# 安装依赖
npm install

# 启动服务
npm run dev:all
```

## ✅ 验证配置

### 查看启动日志

如果配置成功，您会看到：

```
✅ 阿里云语音服务已初始化
💰 当前剩余免费额度: 120 分钟
```

### 测试转录

1. 打开浏览器访问 http://localhost:8080
2. 点击"快速测试"按钮
3. 关闭"使用模拟数据"开关
4. 点击"开始分析"

查看后端日志，应该显示：

```
🇨🇳 [Video 1] 使用阿里云语音服务（国内免费服务）
💰 当前剩余免费额度: 120 分钟
✅ 阿里云转录任务已提交，TaskId: xxx
⏳ 转录进行中... (35%)
✅ 转录任务完成！
✅ [Video 1] 阿里云转录成功！
💰 更新后剩余额度: 115 分钟
```

## 🎉 完成！

恭喜！您已经成功配置阿里云语音服务。现在可以：

- ✅ 无需VPN使用视频分析功能
- ✅ 每月免费使用120分钟
- ✅ 享受国内优化的快速转录

## 📊 使用量查询

### API 查询

```bash
curl http://localhost:3001/api/analysis/quota
```

### 阿里云控制台查询

访问 [用量统计页面](https://nls-portal.console.aliyun.com/statistics) 查看详细用量。

## 💰 成本说明

### 免费额度

- ✅ **每月2小时**（120分钟）完全免费
- ✅ 每月1号自动重置

### 超出免费额度后

- 💵 **¥0.25/分钟**（约 $0.035/分钟）
- 💵 比 OpenAI Whisper ($0.006/分钟) 贵5倍，但有免费额度

### 降级策略

如果阿里云额度用完，系统会**自动降级**到：

```
阿里云（额度用完）→ AssemblyAI（如果配置）→ Whisper（保底）
```

## 🛠️ 常见问题

### Q1: 提示"阿里云语音服务未配置"

**原因**：环境变量未正确加载

**解决方案**：
```bash
# 检查 .env 文件是否存在
ls -la .env

# 检查环境变量
cat .env | grep ALIYUN

# 重启服务
npm run dev:all
```

### Q2: 提示"签名验证失败"

**原因**：AccessKey 错误或时间不同步

**解决方案**：
```bash
# 1. 重新检查 AccessKey
# 登录阿里云控制台确认

# 2. 同步系统时间
sudo ntpdate time.apple.com  # macOS
```

### Q3: 免费额度何时重置？

**答案**：每月1号 00:00 自动重置

### Q4: 可以同时使用多个转录服务吗？

**答案**：可以！系统支持智能降级：

1. 优先使用阿里云（国内快）
2. 降级到 AssemblyAI（国际服务）
3. 最终降级到 Whisper（付费保底）

配置多个服务，系统会自动选择最优方案。

### Q5: 支持中文转录吗？

**答案**：支持！修改配置即可：

```typescript
// aliyunTranscriptionService.ts
language: 'zh' // 改为中文
```

## 📚 延伸阅读

- 📖 [阿里云集成详细文档](../technical/ALIYUN_INTEGRATION.md)
- 🔧 [故障排查指南](../guides/TROUBLESHOOTING.md)
- 💡 [成本优化建议](../technical/PERFORMANCE_GUIDE.md)

## 🎓 学习资源

### 阿里云官方文档

- [智能语音交互产品介绍](https://help.aliyun.com/product/30413.html)
- [录音文件识别 API](https://help.aliyun.com/document_detail/90727.html)
- [新手入门指南](https://help.aliyun.com/document_detail/72138.html)

### 控制台链接

- [智能语音交互控制台](https://nls-portal.console.aliyun.com/)
- [项目管理](https://nls-portal.console.aliyun.com/applist)
- [用量统计](https://nls-portal.console.aliyun.com/statistics)
- [AccessKey 管理](https://ram.console.aliyun.com/manage/ak)

## 💡 小贴士

### 1. 节省额度

```typescript
// 只在必要时启用说话人分离
speakerLabels: false  // 关闭说话人分离可稍微加快速度
```

### 2. 监控使用量

```bash
# 定期查询剩余额度
curl http://localhost:3001/api/analysis/quota
```

### 3. 批量分析

如果需要分析大量视频，建议：

1. 使用免费额度分析前120分钟
2. 额度用完后改用 Whisper（更便宜）
3. 或等待下月1号额度重置

## 🆘 需要帮助？

### 技术支持

1. 查看 [故障排查文档](../guides/TROUBLESHOOTING.md)
2. 检查后端日志：`npm run dev:server`
3. 查看浏览器控制台错误

### 阿里云客服

- 💬 [在线客服](https://www.aliyun.com/service)
- 📞 客服电话：95187
- 📧 工单系统：控制台右上角"工单"

---

**祝使用愉快！** 🎉

如有问题，欢迎查看详细文档或提交 Issue。

