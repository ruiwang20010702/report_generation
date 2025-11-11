# 🇨🇳 通义千问配置指南（国内 GPT 替代方案）

## 📋 简介

通义千问是阿里云推出的大语言模型，完全兼容 OpenAI API 格式，非常适合作为国内 GPT 的替代方案。

### ✨ 优势

- ✅ **无需 VPN**：国内直接访问，速度快
- ✅ **完全兼容**：支持 OpenAI SDK，代码无需修改
- ✅ **免费额度大**：100万 tokens/月（约 25 万字）
- ✅ **价格便宜**：超出后仅 ¥0.008/1K tokens
- ✅ **您已有账号**：可直接使用现有阿里云账号

---

## 🔧 配置步骤

### 第一步：获取 API Key

1. **登录阿里云控制台**
   ```
   https://dashscope.console.aliyun.com/
   ```

2. **开通服务**
   - 进入 [模型服务灵积](https://dashscope.console.aliyun.com/)
   - 点击「立即开通」（免费）

3. **获取 API Key**
   - 点击右上角头像 → API-KEY 管理
   - 点击「创建新的 API-KEY」
   - **复制 API Key**（只显示一次，请妥善保存）

---

### 第二步：配置环境变量

在项目根目录的 `.env` 文件中添加：

```bash
# 通义千问配置（国内 GPT 替代方案）
QWEN_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
USE_QWEN=true

# OpenAI 配置（保留作为备用）
OPENAI_API_KEY=your_openai_key_here
```

---

### 第三步：测试配置

运行测试脚本验证配置：

```bash
node test-qwen.js
```

如果看到以下输出，说明配置成功：

```
✅ 通义千问 API Key: sk-xxxxx...
✅ 连接测试成功！
✅ 响应速度: 1.2秒
```

---

## 💰 费用说明

### 免费额度

- **通义千问-Plus**：100万 tokens/月
- **通义千问-Turbo**：200万 tokens/月（速度更快，但能力稍弱）

### 计费规则（超出免费额度后）

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| qwen-plus | ¥0.004/1K tokens | ¥0.012/1K tokens |
| qwen-turbo | ¥0.002/1K tokens | ¥0.006/1K tokens |
| qwen-max | ¥0.040/1K tokens | ¥0.120/1K tokens |

### 对比 OpenAI

- OpenAI GPT-4: $30/1M tokens（约 ¥216/百万 tokens）
- 通义千问 Plus: ¥8/百万 tokens
- **节省成本：96%** 🎉

---

## 🔄 降级策略

您的项目将自动使用智能降级策略：

```
1️⃣ 优先使用通义千问（国内快速，免费额度大）
    ↓
2️⃣ 降级到 OpenAI（国际服务，需要 VPN）
```

---

## 📊 模型选择建议

### qwen-plus（推荐）⭐
- 适用场景：教学分析、学生报告生成
- 性能：与 GPT-3.5-Turbo 相当
- 速度：快
- 成本：低

### qwen-turbo（高并发）
- 适用场景：需要快速响应的场景
- 性能：稍弱于 qwen-plus
- 速度：非常快
- 成本：最低

### qwen-max（高质量）
- 适用场景：需要最高质量分析
- 性能：接近 GPT-4
- 速度：较慢
- 成本：较高

---

## 🛠️ API 兼容说明

通义千问完全兼容 OpenAI API 格式，只需：

```typescript
const openai = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 使用方式完全相同
const response = await openai.chat.completions.create({
  model: "qwen-plus",  // 替换模型名即可
  messages: [...]
});
```

---

## 🔐 安全提醒

1. ⚠️ **不要在代码中硬编码 API Key**
2. ⚠️ **不要将 `.env` 文件提交到 Git**
3. ⚠️ **定期更换 API Key**
4. ⚠️ **为 API Key 设置使用限额**

---

## 📞 技术支持

- 官方文档：https://help.aliyun.com/zh/dashscope/
- API 文档：https://help.aliyun.com/zh/dashscope/developer-reference/api-details
- 控制台：https://dashscope.console.aliyun.com/

---

## ✅ 配置完成后

运行以下命令启动服务：

```bash
npm run dev:all
```

系统将自动使用通义千问作为主力模型，享受国内高速访问和免费额度！🚀

