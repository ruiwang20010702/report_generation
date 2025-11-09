# 邮件服务配置指南

## 问题说明

如果您的邮箱收不到验证码，可能是因为邮件服务尚未配置。系统目前支持通过 SMTP 服务器发送邮件。

## 配置步骤

### 1. 选择邮件服务提供商（推荐使用密码验证方式）

**最简单的方式（推荐）：** 直接使用邮箱账号和密码/授权码，无需配置 DNS 记录

- **Gmail** ⭐ 推荐用于开发测试（需要应用专用密码）
- **QQ 邮箱** ⭐ 推荐国内用户（需要授权码）
- **163 邮箱**（需要授权码）
- **企业邮箱** (如阿里云企业邮箱、腾讯企业邮箱等)

**专业邮件服务（可选）：**
- **阿里云邮件推送** - 需要配置 DNS 记录，适合生产环境
- **SendGrid** - 专业邮件服务

### 2. 配置环境变量

在项目根目录的 `.env` 文件中添加以下配置：

```env
# 邮件服务配置
SMTP_HOST=smtp.gmail.com          # SMTP 服务器地址
SMTP_PORT=587                     # SMTP 端口 (通常为 587 或 465)
SMTP_USER=your-email@gmail.com    # 发送邮件的邮箱账号
SMTP_PASS=your-app-password       # 邮箱密码或应用专用密码
SMTP_FROM=your-email@gmail.com    # 发件人邮箱（可选，默认使用 SMTP_USER）
```

### 3. 常见邮件服务配置示例

#### Gmail 配置

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**重要提示：** Gmail 需要使用"应用专用密码"，而不是普通密码。

获取应用专用密码步骤：
1. 登录 Google 账号
2. 进入"安全性"设置
3. 启用"两步验证"（如果尚未启用）
4. 生成"应用专用密码"
5. 使用生成的 16 位密码作为 `SMTP_PASS`

#### QQ 邮箱配置

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-email@qq.com
SMTP_PASS=your-authorization-code
```

**重要提示：** QQ 邮箱需要使用"授权码"，而不是 QQ 密码。

获取授权码步骤：
1. 登录 QQ 邮箱网页版
2. 进入"设置" > "账户"
3. 找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
4. 开启"POP3/SMTP服务"或"IMAP/SMTP服务"
5. 点击"生成授权码"
6. 使用生成的授权码作为 `SMTP_PASS`

#### 163 邮箱配置

```env
SMTP_HOST=smtp.163.com
SMTP_PORT=25
SMTP_USER=your-email@163.com
SMTP_PASS=your-authorization-code
```

**重要提示：** 163 邮箱也需要使用授权码。

#### 企业邮箱配置

**阿里云企业邮箱：**
```env
SMTP_HOST=smtp.mxhichina.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

**腾讯企业邮箱：**
```env
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

#### 企业邮箱配置

**阿里云企业邮箱：**
```env
SMTP_HOST=smtp.mxhichina.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

**腾讯企业邮箱：**
```env
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

---

### 4. 阿里云邮件推送（高级配置，需要 DNS 设置）

> ⚠️ **注意**：此方式需要配置 DNS 记录，相对复杂。如果您只是想快速开始，建议使用上面的 Gmail 或 QQ 邮箱配置。

阿里云邮件推送是专业的邮件发送服务，适合生产环境使用，具有高送达率和详细的发送统计。

**快速配置（使用 SMTP 密码验证）：**

1. **开通邮件推送服务**
   - 登录 [阿里云控制台](https://www.aliyun.com/)
   - 进入"邮件推送"产品页面
   - 选择"立即购买"购买资源包（预付费）或"立即开通"开通按量付费（后付费）

2. **选择发信区域**
   - 阿里云邮件推送提供华东、新加坡、美国和德国四个区域
   - 不同区域的域名和发信地址互不相通
   - 根据您的需求选择合适的区域（国内用户推荐华东区域）

3. **创建发信域名并验证**
   - 在邮件推送控制台的"发信域名"页面，点击"新建域名"
   - 输入您要使用的域名（建议使用二级域名，如 `mail.yourdomain.com`）
   - 按照控制台提示添加 DNS 记录完成验证（需要添加 TXT 和 MX 记录）
   - 详细 DNS 配置步骤请参考控制台的"配置"页面

4. **创建发信地址并设置 SMTP 密码**
   - 在"发信地址"页面，点击"新建发信地址"
   - 选择已通过验证的发信域名
   - 设置发信地址（例如：`noreply@mail.yourdomain.com`）
   - **重要**：为发信地址设置 SMTP 密码（用于 SMTP 方式发送）

5. **配置环境变量**

根据您选择的区域，使用对应的 SMTP 服务器地址：

**华东区域（推荐国内用户）：**
```env
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=your-sender-address@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=your-sender-address@yourdomain.com
```

**其他区域：**
- 新加坡: `SMTP_HOST=smtpdm-ap-southeast-1.aliyun.com`
- 美国: `SMTP_HOST=smtpdm-us-west-1.aliyun.com`
- 德国: `SMTP_HOST=smtpdm-eu-central-1.aliyun.com`

**重要提示：**
- `SMTP_USER` 必须是您在控制台创建的发信地址
- `SMTP_PASS` 是您在控制台为发信地址设置的 SMTP 密码（不是 AccessKey）
- 端口 465 使用 SSL 加密连接

**优势：**
- ✅ 高送达率，专业的邮件发送服务
- ✅ 详细的发送统计和报表
- ✅ 支持批量发送
- ✅ 国内用户访问速度快（华东区域）

### 5. 测试邮件配置

配置完成后，重启服务器，系统会在启动时自动测试邮件服务配置。

如果配置正确，您会看到：
```
✅ 邮件服务配置正确
```

如果配置有误，您会看到：
```
❌ 邮件服务配置错误: [错误信息]
```

### 6. 开发环境说明

**如果没有配置邮件服务：**

- 系统会在控制台打印验证码（仅用于开发测试）
- 您可以在服务器控制台查看验证码
- 生产环境必须配置邮件服务

**查看验证码：**

当您请求验证码时，服务器控制台会显示：
```
📧 验证码邮件（未配置邮件服务，仅打印到控制台）:
   收件人: user@example.com
   验证码: 123456
   有效期: 10分钟
```

### 7. 故障排查

#### 问题：仍然收不到邮件

1. **检查环境变量是否正确设置**
   - 确认 `.env` 文件中的配置正确
   - 确认服务器已重启以加载新配置

2. **检查邮箱账号和密码**
   - Gmail: 确认使用的是"应用专用密码"
   - QQ/163: 确认使用的是"授权码"而不是登录密码

3. **检查防火墙和网络**
   - 确认服务器可以访问 SMTP 服务器
   - 某些网络环境可能阻止 SMTP 连接

4. **查看服务器日志**
   - 检查是否有邮件发送错误信息
   - 查看控制台输出的详细错误

5. **测试 SMTP 连接**
   - 可以使用邮件客户端（如 Outlook、Thunderbird）测试相同配置
   - 如果邮件客户端可以发送，说明配置正确

#### 问题：邮件进入垃圾箱

- 检查发件人邮箱是否被标记为垃圾邮件
- 考虑使用专业的邮件服务（如 SendGrid、阿里云邮件推送）
- 配置 SPF、DKIM 等邮件认证记录

### 8. 生产环境建议

对于生产环境，建议使用专业的邮件服务：

- **阿里云邮件推送** - 国内用户友好，高送达率（推荐）
- **SendGrid** - 提供免费额度，可靠性高
- **AWS SES** - 适合 AWS 用户
- **Mailgun** - 开发者友好的邮件服务

这些服务通常提供：
- 更高的发送成功率
- 详细的发送统计
- 更好的邮件送达率
- API 接口支持

## 相关文件

- `server/services/emailService.ts` - 邮件服务实现
- `server/services/authService.ts` - 验证码发送逻辑

## 需要帮助？

如果遇到问题，请检查：
1. 服务器控制台的错误日志
2. 邮件服务提供商的文档
3. 网络连接和防火墙设置

