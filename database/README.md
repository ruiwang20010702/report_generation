# 数据库迁移指南

## 📋 概述

本目录包含所有数据库初始化和迁移脚本。请按照以下顺序执行脚本以确保数据库结构正确。

## 🚀 快速开始

### 新数据库初始化

如果你是第一次设置数据库，请执行以下步骤：

1. **在 Zeabur PostgreSQL Web Console 中执行初始化脚本**
   ```bash
   # 执行主初始化脚本（创建所有基础表）
   psql -f database/init.sql
   ```

2. **执行迁移脚本（按顺序）**
   ```bash
   # 添加学生ID字段
   psql -f database/add_student_id.sql
   
   # 更新报告表结构
   psql -f database/update_reports_table.sql
   
   # 添加成本追踪
   psql -f database/add_cost_tracking.sql
   
   # 优化索引
   psql -f database/optimize_indexes.sql
   ```

### 在 Zeabur Web Console 中执行

如果无法使用 `psql` 命令行，可以在 Zeabur 的 PostgreSQL Web Console 中直接复制粘贴 SQL 脚本内容执行。

## 📁 脚本说明

### 基础表创建

| 文件 | 说明 | 何时使用 |
|------|------|----------|
| `init.sql` | **主初始化脚本**，创建 users、otps、reports 三个核心表 | 新数据库首次初始化 |
| `create_users_table.sql` | 单独创建 users 表 | 仅需要用户表时 |
| `create_otps_table.sql` | 单独创建 otps 表 | 仅需要验证码表时 |
| `create_reports_table.sql` | 单独创建 reports 表 | 仅需要报告表时 |

### 迁移脚本（Migration）

| 文件 | 说明 | 依赖 |
|------|------|------|
| `add_student_id.sql` | 为 reports 表添加 student_id 字段 | 需要先有 reports 表 |
| `update_reports_table.sql` | 添加 student_name 和 analysis_data 字段 | 需要先有 reports 表 |
| `add_cost_tracking.sql` | 添加 cost_breakdown 字段用于成本追踪 | 需要先有 reports 表 |
| `add_password_to_users.sql` | 为 users 表添加 password 字段 | 需要先有 users 表 |

### 优化脚本

| 文件 | 说明 | 何时使用 |
|------|------|----------|
| `optimize_indexes.sql` | 优化数据库索引，提升查询性能 | 数据量较大时或性能优化时 |

## ✅ 验证数据库结构

执行以下 SQL 验证表结构是否正确：

```sql
-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 查看 reports 表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'reports' 
ORDER BY ordinal_position;

-- 查看 reports 表的索引
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'reports';
```

### 预期的 reports 表结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID（外键） |
| video_url | TEXT | 视频URL |
| transcript | TEXT | 转录文本 |
| analysis | JSONB | 分析结果 |
| student_id | TEXT | 学生ID |
| student_name | TEXT | 学生姓名 |
| analysis_data | JSONB | 完整分析数据 |
| cost_breakdown | JSONB | 成本详情 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 预期的索引

- `idx_reports_user_id` - 用户ID索引
- `idx_reports_created_at` - 创建时间索引
- `idx_reports_student_id` - 学生ID索引
- `idx_reports_student_name` - 学生姓名索引
- `idx_reports_cost_breakdown` - 成本数据索引（GIN）

## 🔧 常见问题

### 1. 测试失败："table 'analysis_reports' does not exist"

**原因**：你的数据库使用的是 `reports` 表名，而不是 `analysis_reports`。

**解决方案**：
- 数据库表名是 `reports`（正确）
- 测试文件已更新为使用 `reports` 表名
- 确保执行了所有迁移脚本

### 2. 字段不存在错误

**原因**：未执行迁移脚本。

**解决方案**：按顺序执行所有迁移脚本：
```bash
psql -f database/add_student_id.sql
psql -f database/update_reports_table.sql
psql -f database/add_cost_tracking.sql
```

### 3. 索引不存在

**原因**：未执行索引优化脚本。

**解决方案**：
```bash
psql -f database/optimize_indexes.sql
```

## 🔄 迁移清单

在新环境部署时，请按照以下清单执行：

- [ ] 1. 执行 `init.sql` 创建基础表
- [ ] 2. 验证三个表（users、otps、reports）已创建
- [ ] 3. 执行 `add_student_id.sql` 添加学生ID
- [ ] 4. 执行 `update_reports_table.sql` 添加学生姓名和分析数据
- [ ] 5. 执行 `add_cost_tracking.sql` 添加成本追踪
- [ ] 6. 执行 `optimize_indexes.sql` 优化索引
- [ ] 7. 验证所有字段和索引都已创建
- [ ] 8. 运行测试：`npm test`

## 📝 数据库连接配置

确保你的 `.env` 文件包含正确的数据库连接信息：

```env
# Zeabur 模式（推荐）
DATABASE_URL=postgresql://username:password@host:port/database
DB_SSL=false

# 或者传统模式
DB_HOST=your-host
DB_PORT=5432
DB_NAME=your-database
DB_USER=your-username
DB_PASSWORD=your-password
```

## 🧪 运行数据库测试

执行集成测试验证数据库配置：

```bash
# 运行所有测试
npm test

# 只运行数据库测试
npm test -- tests/integration/database.test.ts
```

## 📊 成本追踪查询

查看成本统计：

```sql
-- 总成本统计
SELECT 
  COUNT(*) as report_count,
  SUM((cost_breakdown->'total'->>'cost')::numeric) as total_cost_cny
FROM reports
WHERE cost_breakdown IS NOT NULL;

-- 按日期统计
SELECT 
  DATE(created_at) as date,
  COUNT(*) as report_count,
  SUM((cost_breakdown->'total'->>'cost')::numeric) as daily_cost
FROM reports
WHERE cost_breakdown IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## 🛟 需要帮助？

如果遇到问题：

1. 检查所有迁移脚本是否都已执行
2. 验证数据库表结构是否正确
3. 确认环境变量配置正确
4. 查看测试输出的错误信息
5. 参考 `tests/README.md` 了解测试配置
