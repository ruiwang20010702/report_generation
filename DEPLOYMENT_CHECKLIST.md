# Zeabur 部署清单

快速检查清单，确保部署顺利。

## 📋 部署前检查

### 代码准备
- [ ] 代码已提交到 GitHub
- [ ] `.gitignore` 包含 `.env` 和敏感文件
- [ ] `package.json` 包含 `express-rate-limit` 依赖
- [ ] 确认 `Dockerfile` 存在
- [ ] 确认 `zeabur.yaml` 存在

### 密钥准备
- [ ] 获取智谱 GLM API Key
- [ ] 获取阿里云 Access Key ID 和 Secret
- [ ] 生成 JWT Secret（32位随机字符串）
- [ ] （可选）获取邮件服务配置

---

## 🚀 部署步骤（5步完成）

### 步骤 1：创建 Zeabur 项目
- [ ] 访问 https://zeabur.com
- [ ] 登录/注册账号
- [ ] 创建新项目，选择 Asia 区域
- [ ] 项目名称：`english-learning-assistant`

### 步骤 2：部署数据库
- [ ] 点击 "Add Service" → "PostgreSQL"
- [ ] 选择版本 15
- [ ] 等待数据库启动（状态变为 Running）
- [ ] 在数据库控制台执行 SQL（创建表）
- [ ] 验证表已创建（查询 `\dt`）

### 步骤 3：连接 GitHub
- [ ] 点击 "Add Service" → "Git"
- [ ] 选择你的仓库
- [ ] 分支选择 `main`
- [ ] Zeabur 开始自动构建

### 步骤 4：配置环境变量
在应用服务的 Variables 页面添加：

```bash
NODE_ENV=production
USE_MOCK_ANALYSIS=false
GLM_API_KEY=【你的智谱GLM密钥】
ALIYUN_ACCESS_KEY_ID=【你的阿里云ID】
ALIYUN_ACCESS_KEY_SECRET=【你的阿里云Secret】
TINGWU_LANGUAGE=en
JWT_SECRET=【生成的32位随机字符串】
```

- [ ] 所有必填变量已添加
- [ ] 保存环境变量
- [ ] 等待应用重启

### 步骤 5：验证部署
- [ ] 访问 `/api/analysis/health` 返回 200 OK
- [ ] 查看日志，确认"数据库连接成功"
- [ ] 访问前端页面，能正常加载
- [ ] 测试限流（3次请求，第3次被拒绝）

---

## ✅ 部署后验证

### 功能测试
- [ ] 用户注册/登录
- [ ] 发送验证码
- [ ] 提交视频分析请求
- [ ] 查看分析报告
- [ ] 导出报告

### 性能测试
- [ ] 首页加载时间 < 3秒
- [ ] API 响应时间 < 500ms
- [ ] 视频分析完成时间 < 3分钟

### 安全测试
- [ ] 限流生效（快速请求被拒绝）
- [ ] JWT 认证生效
- [ ] 数据库连接使用 SSL

---

## 💰 成本监控设置

- [ ] 在 Zeabur 设置预算上限：$30/月
- [ ] 启用邮件通知
- [ ] 每周检查一次使用量

---

## 📈 可选优化

### 立即可做
- [ ] 配置自定义域名
- [ ] 启用 Zeabur CDN
- [ ] 添加错误监控（Sentry）

### 未来计划
- [ ] 实现用户付费系统（VIP 无限流）
- [ ] 添加任务队列（处理更多并发）
- [ ] 迁移到阿里云（如成本过高）

---

## 🐛 问题快速修复

### 应用无法启动
```bash
# 查看构建日志
Zeabur 控制台 → Build Logs

# 常见问题
1. package.json 错误 → 检查依赖
2. 环境变量缺失 → 补充必填变量
3. 数据库未连接 → 检查 DATABASE_URL
```

### 成本超预算
```bash
# 立即行动
1. 增加限流（改为 15分钟/1次）
2. 减少实例数（改为 maxReplicas: 1）
3. 禁用自动扩容
```

### 限流太严格
```bash
# 方案A：放宽限流
max: 3  # 改为3次

# 方案B：用户分级
免费用户：严格限流
付费用户：宽松限流
```

---

## 📞 获取帮助

- **Zeabur 文档**：https://zeabur.com/docs
- **Zeabur Discord**：https://discord.gg/zeabur
- **项目文档**：`./ZEABUR_DEPLOYMENT.md`

---

**预计部署时间**：30-45 分钟

**建议安排**：
- 白天部署（方便调试）
- 准备好所有密钥
- 预留1小时测试时间
