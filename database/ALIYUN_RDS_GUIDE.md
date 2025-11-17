# 阿里云 RDS PostgreSQL 生产部署指南

## 📋 前置准备

### 1. 创建 RDS 实例

1. 登录[阿里云 RDS 控制台](https://rdsnext.console.aliyun.com/)
2. 创建 PostgreSQL 实例
   - **版本**：PostgreSQL 14 或更高
   - **规格**：根据业务需求选择（推荐至少 2核4G）
   - **存储**：20GB 起步（可自动扩容）
   - **网络**：VPC 网络（更安全）

### 2. 配置白名单

1. 进入 RDS 实例详情
2. 点击 **数据安全性** → **白名单设置**
3. 添加以下 IP：
   - 开发机器 IP
   - 生产服务器 IP
   - 或临时开放 `0.0.0.0/0`（仅测试用，**生产环境禁止**）

### 3. 创建数据库账号

1. 点击 **账号管理** → **创建账号**
2. 配置：
   ```
   账号名：report_admin
   密码：[强密码，至少16字符]
   账号类型：高权限账号
   授权数据库：postgres（或新建数据库）
   ```

## 🚀 快速部署步骤

### 步骤 1：获取连接信息

在 RDS 控制台获取：
```
内网地址：rm-xxxxx.pg.rds.aliyuncs.com
外网地址：rm-xxxxx.pg.rds.aliyuncs.com（需手动开启）
端口：5432
数据库：postgres
```

### 步骤 2：连接数据库

#### 方式 1：阿里云 DMS（推荐）

1. 在 RDS 控制台点击 **登录数据库**
2. 自动跳转到 DMS
3. 使用账号密码登录

#### 方式 2：psql 命令行

```bash
# 基本连接
psql -h rm-xxxxx.pg.rds.aliyuncs.com \
     -p 5432 \
     -U report_admin \
     -d postgres

# 或使用连接字符串
psql "postgresql://report_admin:password@rm-xxxxx.pg.rds.aliyuncs.com:5432/postgres"
```

#### 方式 3：pgAdmin / DBeaver

```
主机：rm-xxxxx.pg.rds.aliyuncs.com
端口：5432
数据库：postgres
用户：report_admin
密码：你的密码
SSL模式：prefer
```

### 步骤 3：执行初始化脚本

1. **下载脚本**
   ```bash
   cd /path/to/your/project
   cat database/schema.sql
   ```

2. **在 DMS 中执行**
   - 复制 `database/schema.sql` 的全部内容
   - 粘贴到 SQL 窗口
   - 点击 **执行**

3. **或使用 psql 命令行**
   ```bash
   psql "postgresql://report_admin:password@rm-xxxxx.pg.rds.aliyuncs.com:5432/postgres" \
        -f database/schema.sql
   ```

### 步骤 4：验证部署

```sql
-- 1. 检查表是否创建成功
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 预期结果：
-- otps     | 6
-- reports  | 14
-- users    | 6

-- 2. 检查索引
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- 预期：13 个索引

-- 3. 检查触发器
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 预期：
-- update_users_updated_at   | users
-- update_reports_updated_at | reports

-- 4. 检查扩展
SELECT * FROM pg_extension;

-- 预期包含：
-- uuid-ossp
-- pgcrypto
```

## 🔧 配置应用程序

### 1. 设置环境变量

```bash
# .env 文件
DATABASE_URL="postgresql://report_admin:your_password@rm-xxxxx.pg.rds.aliyuncs.com:5432/postgres"

# 或分开配置
DB_HOST="rm-xxxxx.pg.rds.aliyuncs.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="report_admin"
DB_PASSWORD="your_password"
```

### 2. 测试连接

```bash
# Node.js
npm install pg
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => console.log('✅ 连接成功！'))
  .catch(err => console.error('❌ 连接失败：', err))
  .finally(() => client.end());
"

# Python
pip install psycopg2-binary
python3 -c "
import psycopg2
import os
conn = psycopg2.connect(os.environ['DATABASE_URL'])
print('✅ 连接成功！')
conn.close()
"
```

### 3. 运行应用程序

```bash
# 启动应用
npm start

# 或
python app.py
```

## 🔒 安全加固

### 1. 修改默认密码

```sql
-- 修改数据库用户密码
ALTER USER report_admin WITH PASSWORD 'new_strong_password_here';
```

### 2. 配置 SSL 连接

```bash
# .env
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### 3. 限制白名单

- 删除 `0.0.0.0/0`
- 只添加必要的 IP 地址
- 定期审查白名单

### 4. 启用审计日志

在 RDS 控制台：
1. 点击 **日志管理**
2. 开启 **SQL审计**
3. 配置保留时长

### 5. 配置备份策略

1. 点击 **备份恢复**
2. 设置自动备份：
   - 备份时间：凌晨 2-3 点
   - 保留天数：7 天
   - 启用日志备份

## 📊 性能优化

### 1. 监控慢查询

```sql
-- 启用 pg_stat_statements 扩展
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 查看慢查询
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 2. 优化索引

```bash
# 执行索引优化脚本
psql $DATABASE_URL -f database/optimize_indexes.sql
```

### 3. 配置连接池

```javascript
// Node.js - pg Pool
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲超时
  connectionTimeoutMillis: 2000, // 连接超时
});
```

### 4. 监控资源使用

在 RDS 控制台查看：
- CPU 使用率
- 内存使用率
- IOPS
- 连接数

## 🔄 数据库维护

### 1. 定期清理过期数据

```sql
-- 清理 7 天前的 OTP 验证码
DELETE FROM otps 
WHERE created_at < NOW() - INTERVAL '7 days';

-- 清理 90 天前的旧报告（根据需求调整）
DELETE FROM reports 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### 2. 分析表统计信息

```sql
-- 更新表统计信息（提升查询性能）
ANALYZE users;
ANALYZE otps;
ANALYZE reports;

-- 或更新所有表
ANALYZE;
```

### 3. 重建索引（可选）

```sql
-- 仅在索引膨胀严重时执行
REINDEX TABLE reports;
```

## 📈 扩容指南

### 1. 升级实例规格

1. 进入 RDS 控制台
2. 点击 **变更配置**
3. 选择新规格
4. 确认变更（可能需要重启）

### 2. 扩展存储空间

1. 点击 **变更配置**
2. 增加存储空间
3. 或启用 **自动扩容**

### 3. 读写分离

当 QPS > 10000 时考虑：
1. 创建只读实例
2. 配置读写分离地址
3. 应用程序分离读写连接

## 🆘 故障排查

### 1. 无法连接

```bash
# 检查网络连通性
ping rm-xxxxx.pg.rds.aliyuncs.com

# 检查端口
telnet rm-xxxxx.pg.rds.aliyuncs.com 5432

# 检查白名单
# 在 RDS 控制台查看当前 IP 是否在白名单中
```

### 2. 权限不足

```sql
-- 检查当前用户权限
\du

-- 授予必要权限
GRANT ALL PRIVILEGES ON DATABASE postgres TO report_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO report_admin;
```

### 3. 查询慢

```sql
-- 检查是否缺少索引
EXPLAIN ANALYZE 
SELECT * FROM reports WHERE user_id = 'xxx';

-- 如果看到 Seq Scan，考虑添加索引
CREATE INDEX idx_reports_xxx ON reports(column_name);
```

## 📞 技术支持

- [阿里云 RDS 文档](https://help.aliyun.com/product/26090.html)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [项目 Issues](../../issues)

---

**最后更新**：2025-11-17  
**适用版本**：PostgreSQL 14+  
**RDS 规格**：基础版/高可用版

