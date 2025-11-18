# 📊 数据库文档

> **2025-11-17 整理更新** - 已移除重复文件，统一数据库架构

## 🚀 快速开始

### 新项目部署（推荐）

只需一个文件：`schema.sql`

```bash
# 使用完整的生产级架构
psql $DATABASE_URL -f database/schema.sql
```

**或者在 Zeabur/阿里云 Web Console 中：**
1. 打开 PostgreSQL Web Console
2. 复制并执行 `schema.sql` 的全部内容
3. 验证表创建成功

```sql
-- 验证表创建
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**预期结果：3 个表**
- `users` - 用户表（6字段）
- `otps` - 验证码表（6字段）
- `reports` - 报告表（16字段）

完成！🎉

---

## 📁 目录结构（已整理）

```
database/
├── schema.sql                  # ✅ 唯一生产脚本（推荐使用）
├── optimize_indexes.sql        # 🔧 性能优化工具
├── setup.sh                    # 🤖 自动化部署脚本
├── verify.sh                   # ✅ 数据库验证脚本
├── README.md                   # 📖 本文档（完整指南）
├── QUICK_REFERENCE.md          # 📌 快速参考（字段速查）
├── ALIYUN_RDS_GUIDE.md         # ☁️ 阿里云部署指南
├── FIELD_NAMING_CHANGES.md     # 📝 命名规范说明
│
└── archive/                    # 📦 历史文件归档
    ├── init.sql                # 旧的简化版初始化脚本
    ├── migrate_*.sql           # 历史迁移脚本（已完成）
    ├── schema.sql              # 旧版本架构
    ├── add_*.sql               # 增量迁移脚本
    ├── create_*.sql            # 单表创建脚本
    └── aliyun/                 # 阿里云历史配置
```

### ⚠️ 重要变更

**已移除重复内容：**
- ❌ `init.sql` - 已归档（功能合并到 `schema.sql`）
- ❌ `migrate_field_names.sql` - 已归档（历史迁移，已完成）
- ❌ `migrate_student_id_required.sql` - 已归档（历史迁移，已完成）

**现在只需关注：**
- ✅ `schema.sql` - 完整的数据库架构（唯一真相源）
- ✅ `optimize_indexes.sql` - 性能优化（按需使用）

---

## 📋 核心文件说明

### ✅ `schema.sql` - 唯一生产脚本

**完整的 PostgreSQL 17 数据库架构**，包含：

#### 功能清单
- ✅ 创建数据库扩展（uuid-ossp、pgcrypto）
- ✅ 创建 3 个表：`users`、`otps`、`reports`
- ✅ 完整表结构（reports 表包含 16 个字段）
- ✅ 12 个优化索引（包括 GIN 索引）
- ✅ 完整的字段注释（便于维护）
- ✅ 自动更新 `updated_at` 的触发器
- ✅ 适用于所有环境（Zeabur、阿里云 RDS、自建）

#### 表结构概览
```sql
users (6 字段)
├── id, email, passwd_hash
├── created_at, updated_at, last_login
└── 索引：uniq_users_email, idx_users_created_at

otps (7 字段)
├── id, email, code
├── created_at, expires_at, used
├── used_at
└── 索引：3 个

reports (16 字段) ⭐ 核心表
├── 基础：id, user_id, user_email
├── 学生：student_id(必填), student_name
├── 文件：file_name, file_url, video_url
├── 内容：transcript, analysis, analysis_data
├── 成本：audio_dur, cost_detail, total_cost
├── 时间：created_at, updated_at
└── 索引：8 个（含 GIN）
```

#### 适用场景
- ✅ **新项目部署**（推荐！）
- ✅ 生产环境
- ✅ 开发/测试环境
- ✅ 所有云平台（Zeabur、阿里云、AWS、Azure...）

---

### 🔧 `optimize_indexes.sql` - 性能优化工具

**独立的数据库优化工具**，包含：
- 📊 创建额外的性能索引
- 📈 启用慢查询日志
- 🔍 索引使用情况分析
- 💾 表大小和膨胀监控
- 🧹 VACUUM 清理维护
- 📉 创建监控视图（慢查询、未使用索引等）

**何时使用**：
- 📊 数据量增长到 10,000+ 条记录
- 🐌 查询性能下降
- 🔍 需要性能分析和监控
- 🧹 定期维护（建议每周）

**使用方法**：
```bash
# 一键优化
psql $DATABASE_URL -f database/optimize_indexes.sql

# 查看优化效果
psql $DATABASE_URL -c "SELECT * FROM slow_queries;"
```

---

### 📚 文档文件

#### 📌 `QUICK_REFERENCE.md` - 快速参考

字段和索引速查表，包含：
- 所有表的字段列表
- 所有索引列表
- 常用 SQL 示例
- 代码示例（后端/SQL）

**适合**：快速查找字段名、编写 SQL、代码开发

#### ☁️ `ALIYUN_RDS_GUIDE.md` - 阿里云部署指南

完整的阿里云 RDS PostgreSQL 部署教程

#### 📝 `FIELD_NAMING_CHANGES.md` - 命名规范说明

字段命名变更历史和迁移指南：
- ❌ `password_hash` → ✅ `passwd_hash`
- ❌ `audio_duration` → ✅ `audio_dur`
- ❌ `cost_breakdown` → ✅ `cost_detail`

---

### 🤖 自动化脚本

#### `setup.sh` - 自动部署

```bash
# 一键部署数据库
export DATABASE_URL="your_database_url"
./database/setup.sh
```

#### `verify.sh` - 结构验证

```bash
# 验证数据库结构
./database/verify.sh
```

## 🎯 部署步骤（统一使用 schema.sql）

### 方法 1：Web Console（Zeabur / 阿里云 RDS）⭐ 推荐

**适合所有环境，无需安装工具**

1. **打开数据库 Web Console**
   - Zeabur: Dashboard → PostgreSQL → Web Console
   - 阿里云: RDS 控制台 → DMS 数据管理

2. **复制并执行 schema.sql**
   ```sql
   -- 1. 打开 database/schema.sql 文件
   -- 2. 复制全部内容
   -- 3. 粘贴到 Web Console
   -- 4. 点击"执行"按钮
   ```

3. **验证部署**
   ```sql
   -- 检查表是否创建成功（应显示 3 个表）
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   
   -- 检查触发器（应显示 2 个触发器）
   SELECT trigger_name, event_object_table 
   FROM information_schema.triggers;
   ```

4. **配置应用程序**
   ```bash
   # .env 文件
   DATABASE_URL="postgresql://username:password@host:port/dbname"
   ```

完成！🎉

---

### 方法 2：psql 命令行

**适合本地开发和自动化部署**

```bash
# 一键初始化
psql $DATABASE_URL -f database/schema.sql

# 或使用完整连接字符串
psql "postgresql://user:password@host:port/database" -f database/schema.sql

# 验证部署
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

---

### 方法 3：自动化脚本（推荐生产环境）

```bash
# 1. 设置环境变量
export DATABASE_URL="your_database_url"

# 2. 执行部署脚本
cd /path/to/project
./database/setup.sh

# 3. 验证数据库结构
./database/verify.sh
```

脚本功能：
- ✅ 自动检测数据库连接
- ✅ 执行 schema.sql
- ✅ 验证表结构
- ✅ 错误处理和回滚

## ✅ 验证数据库结构

### 1. 检查表是否存在

```sql
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**预期结果：**
```
table_name | column_count
-----------+-------------
otps       | 7
reports    | 14
users      | 6
```

### 2. 检查索引

```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

### 3. 测试连接

```bash
# 使用验证脚本
./database/verify.sh

# 或者手动测试
psql $DATABASE_URL -c "SELECT version();"
```

## 📊 完整表结构（schema.sql）

### users（用户表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 用户唯一标识符 |
| email | TEXT | NOT NULL, UNIQUE | 用户邮箱 |
| passwd_hash | TEXT | - | 密码哈希值 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间（自动更新） |
| last_login | TIMESTAMP | - | 最后登录时间 |

**索引：**
- `uniq_users_email` - 邮箱唯一索引
- `idx_users_created_at` - 创建时间索引

---

### otps（验证码表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | OTP 唯一标识符 |
| email | TEXT | NOT NULL | 接收验证码的邮箱 |
| code | TEXT | NOT NULL | 验证码 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| expires_at | TIMESTAMP | NOT NULL | 过期时间 |
| used | BOOLEAN | DEFAULT FALSE | 是否已使用 |
| used_at | TIMESTAMP | - | 使用时间 |

**索引：**
- `idx_otps_email` - 邮箱索引
- `idx_otps_created_at` - 创建时间索引
- `idx_otps_expires_at` - 过期时间索引

---

### reports（报告表）⭐ 核心表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 报告唯一标识符 |
| user_id | UUID | FOREIGN KEY → users(id) | 用户ID |
| user_email | TEXT | - | 用户邮箱 |
| student_id | TEXT | **NOT NULL** | 学生ID（必填） |
| student_name | TEXT | - | 学生姓名 |
| file_name | TEXT | - | 上传文件名 |
| file_url | TEXT | - | 文件存储URL |
| video_url | TEXT | - | 视频URL |
| audio_dur | INTEGER | - | 音频时长（秒） |
| transcript | TEXT | - | 转录文本 |
| analysis | JSONB | - | 分析数据（旧字段） |
| analysis_data | JSONB | - | 完整报告分析数据 |
| cost_detail | JSONB | - | API调用成本明细 |
| total_cost | DECIMAL(10,4) | - | 总成本（美元） |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间（自动更新） |

**索引：**
- `idx_reports_user_id` - 用户ID索引
- `idx_reports_user_email` - 用户邮箱索引
- `idx_reports_student_id` - 学生ID索引
- `idx_reports_student_name` - 学生姓名索引
- `idx_reports_file_name` - 文件名索引
- `idx_reports_created_at` - 创建时间索引
- `idx_reports_total_cost` - 总成本索引
- `idx_reports_cost_detail` - 成本明细 GIN 索引（JSON查询优化）

**外键关系：**
```sql
reports.user_id → users.id (ON DELETE CASCADE)
```

---

### 🔧 触发器

#### 自动更新 updated_at

```sql
-- users 表触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- reports 表触发器
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

每次更新记录时，`updated_at` 字段会自动更新为当前时间。

## 📐 命名规范说明

本数据库架构遵循以下命名规范：

### ✅ 已遵循的规范

1. **非唯一索引**：使用 `idx_` 前缀
   - `idx_users_created_at`
   - `idx_reports_user_id`

2. **唯一索引**：使用 `uniq_` 前缀
   - `uniq_users_email`（邮箱唯一索引）

3. **表名和字段名**：
   - ✅ 小写字母 + 下划线分隔
   - ✅ 不使用数据库保留字
   - ✅ 字段名不超过 12 个字符（建议）

### 📝 字段命名变更

为符合 12 字符限制，部分字段已重命名：

| 旧字段名 | 新字段名 | 说明 |
|---------|---------|------|
| `password_hash` | `passwd_hash` | 密码哈希值（13→11字符） |
| `audio_duration` | `audio_dur` | 音频时长（14→9字符） |
| `cost_breakdown` | `cost_detail` | 成本明细（14→11字符） |

**⚠️ 重要提醒**：如果你的应用代码使用了旧字段名，请查看 [FIELD_NAMING_CHANGES.md](FIELD_NAMING_CHANGES.md) 获取完整的迁移指南。

## 🔧 常见问题

### 1. "表已存在"错误

这是正常的，脚本使用 `CREATE TABLE IF NOT EXISTS`，可以安全地重复执行。

### 2. 连接被拒绝

检查：
- ✅ 数据库服务是否运行
- ✅ 连接字符串是否正确
- ✅ 网络是否可达
- ✅ 安全组/防火墙配置

### 3. 权限不足

确保数据库用户具有以下权限：
- CREATE TABLE
- CREATE INDEX
- SELECT, INSERT, UPDATE, DELETE

### 4. 字段不存在

如果遇到字段不存在的错误：
1. 删除现有表：`DROP TABLE users, otps, reports CASCADE;`
2. 重新执行 `init.sql`

## 🧪 开发环境测试

### 本地 PostgreSQL 测试

```bash
# 使用 Docker 启动本地数据库
docker run -d \
  --name test-postgres \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=testdb \
  -p 5432:5432 \
  postgres:17-alpine

# 初始化数据库
export DATABASE_URL="postgresql://postgres:testpass@localhost:5432/testdb"
psql $DATABASE_URL -f database/init.sql

# 验证
./database/verify.sh
```

### 运行集成测试

```bash
# 确保数据库已初始化
npm test -- tests/integration/database.test.ts
```

## 📈 性能优化建议

### 1. 定期执行索引优化

```bash
psql $DATABASE_URL -f database/optimize_indexes.sql
```

### 2. 监控查询性能

```sql
-- 查看慢查询
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 3. 定期清理过期数据

```sql
-- 清理过期的验证码（7天前）
DELETE FROM otps 
WHERE created_at < NOW() - INTERVAL '7 days';

-- 清理旧的测试报告（可选）
DELETE FROM reports 
WHERE created_at < NOW() - INTERVAL '30 days' 
  AND student_id LIKE 'test_%';
```

## 📦 归档文件说明

### `archive/` 目录

包含历史文件和已完成的迁移脚本：

| 文件 | 说明 | 状态 |
|------|------|------|
| `init.sql` | 旧的简化版初始化脚本 | ⚠️ 已过时，被 schema.sql 取代 |
| `migrate_field_names.sql` | 字段名迁移脚本 | ✅ 历史迁移，已完成 |
| `migrate_student_id_required.sql` | student_id 必填迁移 | ✅ 历史迁移，已完成 |
| `add_*.sql` | 增量迁移脚本 | ✅ 已合并到 schema.sql |
| `create_*.sql` | 单表创建脚本 | ✅ 已合并到 schema.sql |
| `aliyun/` | 阿里云 RDS 历史配置 | 📦 历史参考 |
| `schema.sql`（旧版） | 旧版本架构 | ⚠️ 已被根目录 schema.sql 取代 |

**⚠️ 重要提示：**
- 这些文件保留用于**历史参考和版本追溯**
- **不应在新部署中使用**
- 如需迁移旧数据库，请参考 `FIELD_NAMING_CHANGES.md`

## 🔒 安全建议

1. **不要提交敏感信息**：`.gitignore` 应包含 `.env` 文件
2. **使用强密码**：数据库密码至少 16 字符
3. **启用 SSL**：生产环境必须使用加密连接
4. **定期备份**：使用 `pg_dump` 或云平台自动备份
5. **最小权限原则**：应用程序用户不需要 SUPERUSER 权限

## 🆘 需要帮助？

- 📖 参考项目根目录的 `QUICKSTART_ZEABUR.md`
- 🐛 遇到问题请检查 `tests/README.md`
- 💬 查看项目 Issues 或提交新问题

---

## 📝 更新日志

### v3.0 (2025-11-17) - 数据库文件整理

**重大变更：**
- ✅ 统一使用 `schema.sql` 作为唯一数据库架构
- ✅ 移除重复文件（init.sql、migrate_*.sql）至 archive/
- ✅ 简化部署流程，只需关注 2 个文件：
  - `schema.sql` - 数据库架构
  - `optimize_indexes.sql` - 性能优化
- ✅ 更新文档，移除过时说明

**归档文件：**
- `init.sql` → `archive/init.sql`
- `migrate_field_names.sql` → `archive/migrate_field_names.sql`
- `migrate_student_id_required.sql` → `archive/migrate_student_id_required.sql`

---

**当前版本**：v3.0（统一架构版，2025-11-17）  
**上次更新**：2025-11-17  
**维护状态**：✅ 活跃维护中
