# 🚀 数据库快速参考

## 📋 字段名速查表

### users 表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | UUID | 主键 |
| `email` | TEXT | 邮箱（唯一） |
| `passwd_hash` | TEXT | 密码哈希值 ⚠️ |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |
| `last_login` | TIMESTAMP | 最后登录时间 |

### otps 表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | UUID | 主键 |
| `email` | TEXT | 邮箱 |
| `code` | TEXT | 验证码 |
| `created_at` | TIMESTAMP | 创建时间 |
| `expires_at` | TIMESTAMP | 过期时间 |
| `used` | BOOLEAN | 是否已使用 |

### reports 表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 用户ID（外键） |
| `user_email` | TEXT | 用户邮箱 |
| `student_id` | TEXT | 学生ID（必填） |
| `student_name` | TEXT | 学生姓名 |
| `file_name` | TEXT | 文件名 |
| `file_url` | TEXT | 文件URL |
| `video_url` | TEXT | 视频URL |
| `audio_dur` | INTEGER | 音频时长（秒）⚠️ |
| `transcript` | TEXT | 转录文本 |
| `analysis` | JSONB | 分析结果 |
| `analysis_data` | JSONB | 完整分析数据 |
| `cost_detail` | JSONB | 成本详情 ⚠️ |
| `total_cost` | DECIMAL(10,4) | 总成本 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

⚠️ 标记的字段已从旧命名更改

## 🔍 索引速查表

### 唯一索引（uniq_*）

```sql
uniq_users_email          -- users(email)
```

### 非唯一索引（idx_*）

```sql
-- users 表
idx_users_created_at      -- users(created_at)

-- otps 表
idx_otps_email            -- otps(email)
idx_otps_code             -- otps(code)
idx_otps_expires_at       -- otps(expires_at)

-- reports 表
idx_reports_user_id       -- reports(user_id)
idx_reports_user_email    -- reports(user_email)
idx_reports_student_id    -- reports(student_id)
idx_reports_student_name  -- reports(student_name)
idx_reports_file_name     -- reports(file_name)
idx_reports_created_at    -- reports(created_at)
idx_reports_total_cost    -- reports(total_cost)
idx_reports_cost_detail   -- reports USING GIN(cost_detail)
```

## 📝 常用 SQL 示例

### 查询用户

```sql
-- 通过邮箱查询
SELECT id, email, passwd_hash, last_login 
FROM users 
WHERE email = 'user@example.com';

-- 最近登录的用户
SELECT email, last_login 
FROM users 
WHERE last_login IS NOT NULL
ORDER BY last_login DESC 
LIMIT 10;
```

### 查询报告

```sql
-- 查询用户的所有报告
SELECT id, student_name, audio_dur, total_cost, created_at
FROM reports 
WHERE user_id = '...'
ORDER BY created_at DESC;

-- 查询成本详情
SELECT 
  student_name,
  audio_dur,
  cost_detail->>'transcription' AS transcription_cost,
  cost_detail->>'analysis' AS analysis_cost,
  total_cost
FROM reports 
WHERE user_id = '...'
ORDER BY created_at DESC;

-- 统计总成本
SELECT 
  COUNT(*) AS report_count,
  SUM(total_cost) AS total_cost,
  AVG(total_cost) AS avg_cost,
  SUM(audio_dur) AS total_duration_seconds
FROM reports 
WHERE user_id = '...';
```

### 验证码操作

```sql
-- 创建验证码
INSERT INTO otps (email, code, expires_at)
VALUES (
  'user@example.com',
  '123456',
  NOW() + INTERVAL '10 minutes'
);

-- 验证码校验
SELECT id, code, expires_at, used
FROM otps 
WHERE email = 'user@example.com'
  AND code = '123456'
  AND expires_at > NOW()
  AND used = FALSE
ORDER BY created_at DESC
LIMIT 1;

-- 标记验证码已使用
UPDATE otps 
SET used = TRUE 
WHERE id = '...';
```

## 🔄 迁移命令

### 新项目

```bash
# 方案 1：使用 schema.sql（生产环境推荐）
psql $DATABASE_URL -f database/schema.sql

# 方案 2：使用 init.sql（快速开发）
psql $DATABASE_URL -f database/init.sql
```

### 旧项目迁移

```bash
# 1. 备份数据库（重要！）
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 执行迁移
psql $DATABASE_URL -f database/migrate_field_names.sql

# 3. 验证迁移
psql $DATABASE_URL -c "\d users"
psql $DATABASE_URL -c "\d reports"
```

## 📖 文档索引

| 需求 | 查看文档 |
|------|---------|
| 完整使用指南 | [README.md](README.md) |
| 字段变更说明 | [FIELD_NAMING_CHANGES.md](FIELD_NAMING_CHANGES.md) |
| 阿里云 RDS 部署 | [ALIYUN_RDS_GUIDE.md](ALIYUN_RDS_GUIDE.md) |
| 归档文件说明 | [archive/README_ARCHIVE.md](archive/README_ARCHIVE.md) |

## ⚠️ 重要提醒

### 字段名变更

如果你的代码使用了以下旧字段名，**必须修改**：

| ❌ 旧字段名 | ✅ 新字段名 |
|-----------|-----------|
| `password_hash` | `passwd_hash` |
| `audio_duration` | `audio_dur` |
| `cost_breakdown` | `cost_detail` |

### 代码示例

```python
# ❌ 旧代码
user = {
    "password_hash": hashed_password,
}
report = {
    "audio_duration": 120,
    "cost_breakdown": {...}
}

# ✅ 新代码
user = {
    "passwd_hash": hashed_password,
}
report = {
    "audio_dur": 120,
    "cost_detail": {...}
}
```

---

**最后更新**：2025-11-17  
**版本**：v2.0 - 符合命名规范

