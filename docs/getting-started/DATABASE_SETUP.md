# 数据库设置快速指南

## ✅ 已完成的工作

1. ✅ 安装 PostgreSQL 客户端库 (`pg` 和 `@types/pg`)
2. ✅ 创建数据库连接配置 (`server/config/database.ts`)
3. ✅ 创建用户表 SQL 脚本 (`database/create_users_table.sql`)
4. ✅ 创建 OTP 表 SQL 脚本 (`database/create_otps_table.sql`)
5. ✅ 修改认证服务使用数据库 (`server/services/authService.ts`)
6. ✅ 更新服务器启动代码以测试数据库连接
7. ✅ 更新环境变量示例文件 (`env.aliyun.example`)

## 🚀 下一步操作

### 1. 在阿里云 RDS PostgreSQL 中创建表

连接到你的数据库，执行以下 SQL 脚本（按顺序）：

```sql
-- 1. 创建用户表
\i database/create_users_table.sql

-- 2. 创建 OTP 表
\i database/create_otps_table.sql

-- 3. 创建报告表（如果还没有）
\i database/create_reports_table.sql
```

或者使用 psql 命令行：

```bash
psql -h your-database-host -U your-user -d your-database -f database/create_users_table.sql
psql -h your-database-host -U your-user -d your-database -f database/create_otps_table.sql
psql -h your-database-host -U your-user -d your-database -f database/create_reports_table.sql
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件（或复制 `env.aliyun.example`）：

```bash
cp env.aliyun.example .env
```

然后编辑 `.env` 文件，填写数据库连接信息：

```env
# 数据库配置
DB_HOST=your-database-host.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# 其他配置...
```

### 3. 测试连接

启动服务器：

```bash
npm run dev
```

如果配置正确，你会看到：

```
✅ 数据库连接成功: 2024-01-01 12:00:00+00
```

如果连接失败，检查：
- 数据库连接信息是否正确
- 数据库是否允许远程连接
- 防火墙规则是否允许访问
- SSL 配置是否正确

### 4. 测试认证功能

1. **发送验证码**：
   ```bash
   curl -X POST http://localhost:3001/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. **验证验证码**（使用控制台输出的验证码）：
   ```bash
   curl -X POST http://localhost:3001/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "otp": "123456"}'
   ```

3. **获取当前用户**（使用返回的 token）：
   ```bash
   curl -X GET http://localhost:3001/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

## 📊 数据库表结构

### users 表
- `id` (UUID): 用户唯一标识符
- `email` (TEXT): 用户邮箱（唯一）
- `created_at` (TIMESTAMP): 创建时间
- `updated_at` (TIMESTAMP): 更新时间

### otps 表
- `id` (UUID): 验证码唯一标识符
- `email` (TEXT): 用户邮箱
- `code` (TEXT): 验证码（6位数字）
- `expires_at` (TIMESTAMP): 过期时间
- `created_at` (TIMESTAMP): 创建时间
- `used` (BOOLEAN): 是否已使用
- `used_at` (TIMESTAMP): 使用时间

## 🔧 维护任务

### 清理过期验证码

可以定期执行（建议每天一次）：

```sql
DELETE FROM otps WHERE expires_at < NOW() - INTERVAL '1 day';
```

或者使用清理函数：

```sql
SELECT cleanup_expired_otps();
```

### 查看数据库统计

```sql
-- 查看用户数量
SELECT COUNT(*) FROM users;

-- 查看未使用的验证码数量
SELECT COUNT(*) FROM otps WHERE used = FALSE AND expires_at > NOW();

-- 查看最近的验证码
SELECT email, created_at, expires_at, used 
FROM otps 
ORDER BY created_at DESC 
LIMIT 10;
```

## ⚠️ 注意事项

1. **生产环境**：
   - 必须启用 SSL 连接（`DB_SSL=true`）
   - 使用强密码的 JWT_SECRET
   - 定期清理过期验证码
   - 监控数据库连接池状态

2. **安全建议**：
   - 不要在代码中硬编码数据库密码
   - 使用环境变量管理敏感信息
   - 定期更新数据库密码
   - 限制数据库访问 IP

3. **性能优化**：
   - 根据实际负载调整连接池大小
   - 定期分析慢查询
   - 监控数据库性能指标

## 🐛 故障排除

### 问题：数据库连接失败

**解决方案**：
1. 检查环境变量是否正确设置
2. 确认数据库服务是否运行
3. 检查网络连接和防火墙规则
4. 验证数据库用户权限

### 问题：表不存在错误

**解决方案**：
1. 确认已执行所有 SQL 脚本
2. 检查数据库名称是否正确
3. 验证用户是否有创建表的权限

### 问题：连接池耗尽

**解决方案**：
1. 增加 `DB_POOL_MAX` 值
2. 检查是否有连接泄漏
3. 优化查询性能，减少连接持有时间

## 📚 相关文档

- [数据库设置详细文档](../database/README.md)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [pg 库文档](https://node-postgres.com/)
- [阿里云 RDS PostgreSQL 文档](https://help.aliyun.com/product/26090.html)

