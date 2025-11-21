# 🇨🇳 阿里云语音服务迁移指南

## 📋 更新概述

本次更新为项目添加了**阿里云智能语音服务**支持，专门为**中国大陆用户**优化，解决 AssemblyAI 在国内无法访问的问题。

### 🎯 核心改进

| 项目 | 更新前 | 更新后 |
|------|--------|--------|
| **转录服务** | AssemblyAI → Whisper | 阿里云 → AssemblyAI → Whisper |
| **国内访问** | ❌ 需要VPN | ✅ 无需VPN |
| **免费额度** | 5小时/月 | **7小时/月**（阿里云2h + AssemblyAI5h） |
| **月成本节省** | $1.80 | **$2.52** |
| **网络速度** | 慢（国际网络） | ⚡ 快（国内服务器） |

## 🆕 新增文件

### 核心服务
```
server/services/
├── aliyunTranscriptionService.ts  ✨ 新增：阿里云转录服务（500行）
└── videoAnalysisService.ts        📝 更新：添加阿里云优先级
```

### 配置文件
```
env.aliyun.example                 ✨ 新增：阿里云配置示例
```

### 文档
```
docs/
├── technical/
│   └── ALIYUN_INTEGRATION.md      ✨ 新增：阿里云集成详细文档（315行）
└── getting-started/
    └── ALIYUN_QUICKSTART.md       ✨ 新增：5分钟快速开始指南
```

### 依赖更新
```json
// package.json 新增依赖
{
  "dependencies": {
    "uuid": "^11.0.3"           // 用于生成唯一请求ID
  },
  "devDependencies": {
    "@types/uuid": "^10.0.0"    // TypeScript类型定义
  }
}
```

## 🔄 智能降级策略

### 更新前（2层降级）
```
AssemblyAI（免费5h）
    ↓ 不可用/超额
Whisper（付费 $0.006/分钟）
```

### 更新后（3层降级）✨
```
🇨🇳 阿里云（国内免费2h，优先）
    ↓ 不可用/超额
🌍 AssemblyAI（国际免费5h，备用）
    ↓ 不可用/超额
💰 Whisper（付费 $0.006/分钟，保底）
```

## 📦 安装步骤

### 1. 更新依赖

```bash
# 安装新依赖
npm install uuid
npm install --save-dev @types/uuid
```

### 2. 配置阿里云（可选，推荐国内用户）

#### 方案 A：使用阿里云（国内用户推荐）

```bash
# 复制配置示例
cp env.aliyun.example .env

# 编辑 .env 文件，添加阿里云配置
nano .env
```

在 `.env` 中添加：

```bash
# 阿里云配置（必需）
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_NLS_APP_KEY=your_app_key

# OpenAI 配置（必需）
OPENAI_API_KEY=sk-your-openai-key
```

**获取阿里云密钥：** 查看 [5分钟快速配置指南](./docs/getting-started/ALIYUN_QUICKSTART.md)

#### 方案 B：继续使用 AssemblyAI（国际用户）

如果您在国外或有稳定VPN，可以继续使用 AssemblyAI：

```bash
# 保持现有配置
ASSEMBLYAI_API_KEY=your_assemblyai_key
OPENAI_API_KEY=sk-your-openai-key
```

#### 方案 C：三层保障（推荐）

同时配置所有服务，享受最大灵活性：

```bash
# 阿里云（国内优先）
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_NLS_APP_KEY=your_app_key

# AssemblyAI（国际备用）
ASSEMBLYAI_API_KEY=your_assemblyai_key

# OpenAI（必需）
OPENAI_API_KEY=sk-your-openai-key
```

### 3. 启动服务

```bash
# 启动前后端
npm run dev:all

# 或分别启动
npm run dev         # 前端
npm run dev:server  # 后端
```

## ✅ 验证安装

### 检查启动日志

#### 配置了阿里云
```
✅ 阿里云语音服务已初始化
💰 当前剩余免费额度: 120 分钟
```

#### 未配置阿里云
```
⚠️  阿里云语音服务未配置（将使用 AssemblyAI/Whisper 备用）
```

### 测试转录

1. 访问 http://localhost:8080
2. 点击"快速测试"
3. 关闭"使用模拟数据"
4. 点击"开始分析"

**查看后端日志：**

#### 使用阿里云（国内）
```
🇨🇳 [Video 1] 使用阿里云语音服务（国内免费服务）
💰 当前剩余免费额度: 120 分钟
✅ 阿里云转录任务已提交，TaskId: xxx
⏳ 转录进行中... (35%)
✅ 转录任务完成！
```

#### 降级到 AssemblyAI
```
ℹ️  [Video 1] 阿里云语音服务不可用（免费额度已用完）
🌍 [Video 1] 使用 AssemblyAI（国际免费服务，可能需要VPN）
```

#### 最终降级到 Whisper
```
ℹ️  [Video 1] AssemblyAI 不可用（未配置 API Key）
🎙️ [Video 1] 使用 OpenAI Whisper（付费服务，$0.006/分钟）
```

## 📊 成本对比

### 场景：每天 10 个视频 × 5 分钟

| 配置方案 | 月使用量 | 免费部分 | 付费部分 | 月成本 | 年节省 |
|---------|---------|---------|---------|--------|--------|
| **仅 Whisper** | 1500分钟 | 0分钟 | 1500分钟 | $9.00 | - |
| **AssemblyAI + Whisper** | 1500分钟 | 300分钟 | 1200分钟 | $7.20 | $21.60 |
| **阿里云 + Whisper** | 1500分钟 | 120分钟 | 1380分钟 | $8.28 | $8.64 |
| **🌟 阿里云 + AssemblyAI + Whisper** | 1500分钟 | 420分钟 | 1080分钟 | **$6.48** | **$30.24** ✨ |

### 💡 最佳实践

**推荐配置：阿里云 + AssemblyAI + Whisper**

- ✅ 前 120 分钟：**阿里云**（免费，国内快）
- ✅ 121-420 分钟：**AssemblyAI**（免费，需VPN）
- ✅ 超出 420 分钟：**Whisper**（付费，保底）

## 🔍 功能对比

### AssemblyAI vs 阿里云

| 功能 | AssemblyAI | 阿里云 |
|------|-----------|--------|
| **免费额度** | 5小时/月 | 2小时/月 |
| **国内访问** | ❌ 需要VPN | ✅ 直接访问 |
| **转录速度** | 30-60秒 | 30-60秒 |
| **说话人分离** | ✅ 支持 | ✅ 支持 |
| **英语识别** | ✅ 优秀 | ✅ 优秀 |
| **超额价格** | $0.03/分钟 | ¥0.25/分钟（~$0.035） |
| **API稳定性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## 📚 迁移常见问题

### Q1: 必须配置阿里云吗？

**答案**：不是必须的。

- ✅ 如果您在**国内**：强烈推荐配置（无需VPN，速度快）
- ✅ 如果您在**国外**：可以继续使用 AssemblyAI
- ✅ 如果都不配置：系统会自动使用 Whisper（付费但稳定）

### Q2: 已有 AssemblyAI，还需要阿里云吗？

**答案**：取决于网络环境。

- 🇨🇳 **国内无VPN**：推荐配置阿里云（AssemblyAI 无法访问）
- 🇨🇳 **国内有VPN**：可选配置阿里云（节省VPN流量）
- 🌍 **国外**：无需配置阿里云（AssemblyAI 更快）

### Q3: 配置多个服务会不会冲突？

**答案**：不会。系统会智能选择最优服务。

```typescript
// 自动选择逻辑
if (阿里云可用) {
  使用阿里云;
} else if (AssemblyAI可用) {
  使用 AssemblyAI;
} else {
  使用 Whisper;
}
```

### Q4: 如何查看当前使用的是哪个服务？

**答案**：查看后端日志。

```bash
# 阿里云
🇨🇳 [Video 1] 使用阿里云语音服务

# AssemblyAI
🌍 [Video 1] 使用 AssemblyAI

# Whisper
🎙️ [Video 1] 使用 OpenAI Whisper
```

### Q5: 阿里云免费额度用完后怎么办？

**答案**：系统自动降级。

1. **等待下月重置**（每月1号 00:00）
2. **自动使用 AssemblyAI**（如果配置）
3. **最终使用 Whisper**（付费保底）

### Q6: 如何强制使用某个服务？

**答案**：修改环境变量。

```bash
# 强制使用 Whisper（移除其他配置）
# 只保留 OPENAI_API_KEY

# 强制使用阿里云（移除 AssemblyAI）
ALIYUN_ACCESS_KEY_ID=...
# ASSEMBLYAI_API_KEY=（注释掉）
```

## 🛠️ 故障排查

### 问题：提示"阿里云语音服务未配置"

**解决方案：**
```bash
# 1. 检查环境变量
cat .env | grep ALIYUN

# 2. 确保3个必需变量都配置
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_NLS_APP_KEY=xxx

# 3. 重启服务
npm run dev:all
```

### 问题：转录失败，提示"签名错误"

**解决方案：**
```bash
# 1. 重新检查 AccessKey
# 登录阿里云控制台确认

# 2. 同步系统时间
sudo ntpdate time.apple.com  # macOS
sudo ntpdate ntp.ubuntu.com  # Linux

# 3. 确保没有多余空格
# 检查 .env 文件，确保 KEY=VALUE 格式正确
```

### 问题：自动降级到 Whisper，但想用阿里云

**解决方案：**
```bash
# 查询剩余额度
curl http://localhost:3001/api/analysis/quota

# 如果额度为0，等待下月重置或充值
```

## 📖 相关文档

### 快速开始
- 🚀 [5分钟快速配置](./docs/getting-started/ALIYUN_QUICKSTART.md)
- 📘 [环境变量配置](./docs/getting-started/ENVIRONMENT_SETUP.md)

### 技术文档
- 📗 [阿里云集成详细文档](./docs/technical/ALIYUN_INTEGRATION.md)
- 🔧 [AssemblyAI 集成文档](./docs/technical/ASSEMBLYAI_INTEGRATION.md)
- 💰 [性能和成本优化](./docs/technical/PERFORMANCE_GUIDE.md)

### 故障排查
- 🛠️ [完整故障排除指南](./docs/guides/TROUBLESHOOTING.md)
- 🆘 [紧急问题解决](./IMMEDIATE_HELP.md)

## 🎉 总结

### ✅ 已实现

- ✅ 阿里云智能语音服务集成
- ✅ 三层智能降级策略
- ✅ 国内网络优化
- ✅ 完整文档和示例
- ✅ 向后兼容（无需修改现有配置）

### 🎯 使用建议

| 用户类型 | 推荐配置 | 原因 |
|---------|---------|------|
| **国内用户（无VPN）** | 阿里云 + Whisper | 无需VPN，速度快 |
| **国内用户（有VPN）** | 阿里云 + AssemblyAI + Whisper | 三层保障，成本最优 |
| **国际用户** | AssemblyAI + Whisper | AssemblyAI 更快 |
| **测试用户** | 仅 Whisper | 配置简单 |

### 💰 成本节省

**每月使用 1500 分钟的情况下：**

- 更新前：$7.20/月（AssemblyAI + Whisper）
- 更新后：**$6.48/月**（阿里云 + AssemblyAI + Whisper）
- **年节省：$8.64** 💰

---

**需要帮助？**

1. 查看 [5分钟快速配置指南](./docs/getting-started/ALIYUN_QUICKSTART.md)
2. 阅读 [完整集成文档](./docs/technical/ALIYUN_INTEGRATION.md)
3. 查看 [故障排查指南](./docs/guides/TROUBLESHOOTING.md)

祝使用愉快！🎉

