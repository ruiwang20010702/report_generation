# 📊 阿里云 RDS PostgreSQL 数据库初始化指南

## 🔧 数据库连接信息

```
Host: report-generation-project-pub.rwlb.rds.aliyuncs.com
Port: 5432
Database: postgres
User: report_write
Password: tJQeRmma-lixM%NR-V
Connection String: postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres
```

## 🚀 快速开始

### 方法 1：使用 psql 命令行（推荐）

```bash
# 连接到数据库
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres"

# 然后执行初始化脚本
cd /Users/ruiwang/Desktop/test
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" -f database/complete_setup.sql
```

### 方法 2：使用图形化工具

**DBeaver / pgAdmin / DataGrip：**
- **Host**: report-generation-project-pub.rwlb.rds.aliyuncs.com
- **Port**: 5432
- **Database**: postgres
- **Username**: report_write
- **Password**: tJQeRmma-lixM%NR-V

### 方法 3：阿里云 RDS 控制台

1. 登录阿里云控制台
2. 进入 **RDS 管理控制台**
3. 找到你的实例
4. 点击 **"数据管理"** → **"SQL 窗口"**
5. 复制 `database/complete_setup.sql` 的内容并执行

## 🔐 安全注意事项

### 1. 密码中的特殊字符

密码包含特殊字符 `%`，在连接字符串中需要转义为 `%25`：

```
# 原始密码：tJQeRmma-lixM%NR-V
# 连接字符串中的密码：tJQeRmma-lixM%25NR-V
```

### 2. 网络访问配置

确保阿里云 RDS 实例的安全组配置允许你的 IP 地址访问：

1. 登录阿里云 RDS 控制台
2. 进入实例详情页
3. 点击 **"数据安全性"**
4. 配置 **白名单** 或 **安全组**
5. 添加你的 IP 地址

### 3. SSL 连接（推荐）

阿里云 RDS 支持 SSL 加密连接：

```bash
# 使用 SSL 连接
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres?sslmode=require"
```

## 🎯 执行步骤

### 步骤 1：验证连接

```bash
# 测试连接
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" -c "SELECT version();"
```

### 步骤 2：执行初始化脚本

```bash
cd /Users/ruiwang/Desktop/test

# 执行完整初始化
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" -f database/complete_setup.sql
```

### 步骤 3：验证结果

```bash
# 验证表创建成功
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;"
```

## 📋 更新应用配置

初始化完成后，更新你的应用环境变量：

```bash
# 新的数据库连接字符串
DATABASE_URL=postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres

# 或者分开配置
DB_HOST=report-generation-project-pub.rwlb.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=report_write
DB_PASSWORD=tJQeRmma-lixM%NR-V
```

## 🔍 故障排除

### 连接被拒绝

**错误信息：** `connection refused`

**解决方案：**
1. 检查安全组白名单配置
2. 确认实例状态为 **运行中**
3. 检查网络连通性

### 认证失败

**错误信息：** `authentication failed`

**解决方案：**
1. 确认用户名和密码正确
2. 检查密码中的特殊字符转义
3. 重置密码：阿里云控制台 → 账号管理 → 重置密码

### 权限不足

**错误信息：** `permission denied`

**解决方案：**
1. 确认使用的是 `report_write` 用户
2. 检查用户权限：阿里云控制台 → 账号管理
3. 联系管理员提升权限

## 📊 性能优化建议

### 1. 连接池配置

阿里云 RDS 支持连接池，建议配置：

```bash
# 最大连接数（根据实例规格调整）
max_connections = 100

# 连接超时
connect_timeout = 30
```

### 2. 监控和告警

在阿里云控制台设置：
- **性能监控**：CPU、内存、连接数
- **慢查询日志**：识别性能瓶颈
- **告警规则**：异常连接、资源使用

### 3. 备份策略

阿里云 RDS 提供自动备份：
- **自动备份**：每日备份，保留7-30天
- **手动备份**：随时创建快照
- **跨地域备份**：灾难恢复

## 🚀 高级配置

### 读写分离（如适用）

如果实例支持读写分离：

```bash
# 主库（读写）
DATABASE_URL=postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres

# 只读库（查询）
READONLY_DATABASE_URL=postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres?target_session_attrs=read-only
```

### SSL 证书配置

下载阿里云 RDS SSL 证书：

```bash
# 下载证书
wget https://rds-download.oss-cn-beijing.aliyuncs.com/ApsaraDB-CA-Chain.zip

# 解压后使用
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres?sslmode=require&sslrootcert=rds-combined-ca-bundle.pem"
```

## ✅ 完成确认

初始化完成后，执行以下命令确认：

```bash
# 查看所有表
psql "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" -c "
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
ORDER BY table_name;"

# 预期结果：
# - otps (7 columns)
# - reports (14 columns)  
# - users (5 columns)
```

## 📞 技术支持

- **阿里云技术支持**：登录阿里云控制台 → 工单系统
- **RDS 文档**：https://help.aliyun.com/document_detail/26124.html
- **连接问题排查**：https://help.aliyun.com/document_detail/26125.html

祝你使用顺利！🎉

