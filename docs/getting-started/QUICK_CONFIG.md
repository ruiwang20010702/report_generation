# 快速配置指南

## 🎯 当前状态

根据环境变量检查，您需要配置以下数据库连接信息：

- ✅ `.env` 文件已存在
- ❌ 缺少数据库连接信息（DB_HOST, DB_NAME, DB_USER, DB_PASSWORD）
- ❌ 缺少 JWT 密钥（JWT_SECRET）

## 🚀 配置选项

### 选项 1: 使用交互式配置工具（推荐）

运行以下命令，按提示填写数据库连接信息：

```bash
npm run setup:env
```

这个工具会：
- 读取现有的 `.env` 文件
- 提示您输入每个必需的配置项
- 自动生成 JWT 密钥（如果未设置）
- 保存配置到 `.env` 文件

### 选项 2: 手动编辑 .env 文件

直接编辑 `.env` 文件，添加以下配置：

```env
# ========================================
# 数据库配置（PostgreSQL）
# ========================================
DB_HOST=your-database-host.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# SSL 配置（生产环境推荐启用）
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# ========================================
# JWT 配置
# ========================================
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

**重要提示：**
- `DB_HOST`: 您的阿里云 RDS PostgreSQL 主机地址（如：`xxx.rds.aliyuncs.com`）
- `DB_NAME`: 数据库名称
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `JWT_SECRET`: 用于生成和验证 JWT token 的密钥（建议使用强密码，至少 32 个字符）

### 选项 3: 使用本地 PostgreSQL 进行测试

如果您想先在本地测试，可以使用本地 PostgreSQL：

```env
# 本地数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=english_learning
DB_USER=postgres
DB_PASSWORD=your_local_password

# 本地开发不需要 SSL
DB_SSL=false

# JWT 配置
JWT_SECRET=dev-secret-key-change-in-production
```

## 📋 配置步骤

### 步骤 1: 配置环境变量

选择上述任一选项配置环境变量。

### 步骤 2: 检查配置

运行以下命令检查配置是否正确：

```bash
npm run check:env
```

如果所有必需的环境变量都已配置，您会看到：

```
✅ 所有必需的环境变量已配置！
```

### 步骤 3: 在数据库中创建表

配置好环境变量后，在数据库中创建表：

```bash
npm run setup:db
```

或者手动执行 SQL 脚本（如果您有数据库访问权限）：

```bash
# 设置环境变量（如果还没有）
export PGPASSWORD=your_database_password

# 执行 SQL 脚本
psql -h your-database-host -U your-database-user -d your-database-name -f database/create_users_table.sql
psql -h your-database-host -U your-database-user -d your-database-name -f database/create_otps_table.sql
psql -h your-database-host -U your-database-user -d your-database-name -f database/create_reports_table.sql
```

### 步骤 4: 测试数据库连接

创建表后，测试数据库连接：

```bash
npm run test:db
```

如果一切正常，您会看到：

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

服务器启动时，会自动测试数据库连接。如果配置正确，您会看到：

```
✅ 数据库连接成功: 2024-01-01 12:00:00+00
```

## 🔍 获取数据库连接信息

### 阿里云 RDS PostgreSQL

1. 登录阿里云控制台：https://ecs.console.aliyun.com/
2. 进入 RDS 管理页面
3. 选择您的 PostgreSQL 实例
4. 在"基本信息"中查看：
   - **连接地址** → `DB_HOST`
   - **端口** → `DB_PORT`（通常是 5432）
   - **数据库名称** → `DB_NAME`
   - **账号名称** → `DB_USER`
   - **密码** → `DB_PASSWORD`（如果忘记了，可以重置）

### 本地 PostgreSQL

如果您使用本地 PostgreSQL：

1. 确保 PostgreSQL 已安装并运行
2. 创建数据库：
   ```bash
   createdb english_learning
   ```
3. 配置信息：
   - `DB_HOST=localhost`
   - `DB_PORT=5432`（默认端口）
   - `DB_NAME=english_learning`
   - `DB_USER=postgres`（或您的用户名）
   - `DB_PASSWORD=your_password`

## 🐛 常见问题

### 问题 1: 数据库连接失败

**症状：** `npm run test:db` 显示连接失败

**解决方案：**
1. 检查数据库连接信息是否正确
2. 确认数据库服务是否运行
3. 检查网络连接是否正常
4. 确认防火墙规则允许访问
5. 如果使用 SSL，检查 SSL 配置是否正确

### 问题 2: 表创建失败

**症状：** `npm run setup:db` 显示表创建失败

**解决方案：**
1. 确认数据库用户有创建表的权限
2. 检查表是否已存在（脚本使用 `CREATE TABLE IF NOT EXISTS`）
3. 查看错误信息，可能是 SQL 语法问题

### 问题 3: 环境变量未生效

**症状：** 配置了环境变量，但脚本仍然显示未设置

**解决方案：**
1. 确认 `.env` 文件在项目根目录
2. 检查变量名是否正确（区分大小写）
3. 确认变量值已填写（不能为空）
4. 重新运行检查脚本：`npm run check:env`

## ✅ 完成检查清单

- [ ] 环境变量已配置（`npm run check:env` 通过）
- [ ] 数据库表已创建（`npm run setup:db` 成功）
- [ ] 数据库连接测试通过（`npm run test:db` 成功）
- [ ] 服务器启动成功（`npm run dev` 无错误）

完成以上所有步骤后，数据库设置就完成了！🎉

## 📚 相关文档

- [下一步操作指南](./NEXT_STEPS.md)
- [数据库设置详细文档](../../database/README.md)
- [环境变量配置指南](./ENVIRONMENT_SETUP.md)

