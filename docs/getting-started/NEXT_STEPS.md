# 数据库设置 - 下一步操作指南

## 🎯 当前状态

✅ 已完成：
- ✅ 安装 PostgreSQL 客户端库
- ✅ 创建数据库连接配置
- ✅ 创建数据库表 SQL 脚本
- ✅ 修改认证服务使用数据库
- ✅ 更新服务器启动代码
- ✅ 创建测试和设置脚本

## 🚀 下一步操作

### 步骤 1: 检查环境变量配置

首先检查环境变量是否已配置：

```bash
npm run check:env
```

如果缺少必需的环境变量，脚本会提示你需要配置哪些变量。

### 步骤 2: 配置环境变量

如果 `.env` 文件不存在，请创建它：

```bash
cp env.aliyun.example .env
```

然后编辑 `.env` 文件，填写以下必需的环境变量：

```env
# ========================================
# 数据库配置（必需）
# ========================================
DB_HOST=your-database-host.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# ========================================
# JWT 配置（必需）
# ========================================
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# ========================================
# SSL 配置（生产环境推荐）
# ========================================
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

**重要提示：**
- `DB_HOST`: 你的阿里云 RDS PostgreSQL 主机地址
- `DB_NAME`: 你的数据库名称
- `DB_USER`: 你的数据库用户名
- `DB_PASSWORD`: 你的数据库密码
- `JWT_SECRET`: 用于生成和验证 JWT token 的密钥（请使用强密码）

### 步骤 3: 在数据库中创建表

有两种方式创建表：

#### 方式 1: 使用自动化脚本（推荐）

```bash
npm run setup:db
```

脚本会：
1. 检查环境变量配置
2. 测试数据库连接
3. 自动执行 SQL 脚本创建表
4. 验证表是否创建成功

#### 方式 2: 手动执行 SQL 脚本

如果你更喜欢手动操作，可以使用 `psql` 命令：

```bash
# 设置环境变量（如果还没有）
export PGPASSWORD=your_database_password

# 执行 SQL 脚本
psql -h your-database-host -U your-database-user -d your-database-name -f database/create_users_table.sql
psql -h your-database-host -U your-database-user -d your-database-name -f database/create_otps_table.sql
psql -h your-database-host -U your-database-user -d your-database-name -f database/create_reports_table.sql
```

或者使用数据库管理工具（如 pgAdmin、DBeaver）直接执行 SQL 脚本。

### 步骤 4: 测试数据库连接

创建表后，测试数据库连接：

```bash
npm run test:db
```

如果一切正常，你会看到：

```
✅ 数据库连接成功: 2024-01-01 12:00:00+00
✅ users 表存在
   └─ 用户数量: 0
✅ otps 表存在
   └─ 验证码统计: 总计 0, 有效 0, 已使用 0, 已过期 0
✅ 数据库测试完成！
```

### 步骤 5: 启动服务器

如果数据库连接测试通过，启动服务器：

```bash
npm run dev
```

服务器启动时，会自动测试数据库连接。如果配置正确，你会看到：

```
✅ 数据库连接成功: 2024-01-01 12:00:00+00
```

### 步骤 6: 测试认证功能

服务器启动后，测试认证功能：

#### 1. 发送验证码

```bash
curl -X POST http://localhost:3001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

如果成功，服务器控制台会输出验证码（开发环境）。

#### 2. 验证验证码

使用控制台输出的验证码：

```bash
curl -X POST http://localhost:3001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "otp": "123456"}'
```

如果成功，会返回 JWT token。

#### 3. 获取当前用户

使用返回的 token：

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `npm run check:env` | 检查环境变量配置 |
| `npm run setup:db` | 自动设置数据库表 |
| `npm run test:db` | 测试数据库连接 |
| `npm run dev` | 启动开发服务器 |

## 🐛 故障排除

### 问题 1: 环境变量检查失败

**症状：** `npm run check:env` 显示缺少必需的环境变量

**解决方案：**
1. 确认 `.env` 文件存在
2. 检查 `.env` 文件中的变量名是否正确
3. 确认变量值已填写（不能为空）

### 问题 2: 数据库连接失败

**症状：** `npm run test:db` 显示连接失败

**解决方案：**
1. 检查数据库服务是否运行
2. 验证数据库连接信息是否正确
3. 检查网络连接是否正常
4. 确认防火墙规则允许访问
5. 如果使用 SSL，检查 SSL 配置是否正确

### 问题 3: 表创建失败

**症状：** `npm run setup:db` 显示表创建失败

**解决方案：**
1. 确认数据库用户有创建表的权限
2. 检查表是否已存在（脚本使用 `CREATE TABLE IF NOT EXISTS`）
3. 查看错误信息，可能是 SQL 语法问题

### 问题 4: 表不存在

**症状：** `npm run test:db` 显示表不存在

**解决方案：**
1. 重新运行 `npm run setup:db`
2. 或手动执行 SQL 脚本

## 📚 相关文档

- [数据库设置详细文档](../../database/README.md)
- [快速开始指南](./DATABASE_SETUP.md)
- [环境变量配置指南](./ENVIRONMENT_SETUP.md)

## 💡 提示

1. **开发环境**：可以使用本地 PostgreSQL 数据库进行测试
2. **生产环境**：必须启用 SSL 连接（`DB_SSL=true`）
3. **安全性**：不要在代码中硬编码数据库密码，使用环境变量
4. **定期清理**：建议定期清理过期的验证码（可以设置定时任务）

## ✅ 完成检查清单

- [ ] 环境变量已配置（`npm run check:env` 通过）
- [ ] 数据库表已创建（`npm run setup:db` 成功）
- [ ] 数据库连接测试通过（`npm run test:db` 成功）
- [ ] 服务器启动成功（`npm run dev` 无错误）
- [ ] 认证功能测试通过（发送验证码、验证验证码、获取用户信息）

完成以上所有步骤后，数据库设置就完成了！🎉

