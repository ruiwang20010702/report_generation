# 数据库字段命名规范变更说明

## 📅 变更日期

**2025-11-17**

## 🎯 变更原因

为符合数据库命名规范，进行以下调整：

### 命名规范要求

1. ✅ **非唯一索引**：`idx_字段名称[_字段名称]`
2. ✅ **唯一索引**：`uniq_字段名称[_字段名称]`
3. ✅ **库名、表名、字段名**：不使用 MySQL/PostgreSQL 保留字
4. ✅ **命名风格**：小写字母 + 下划线分隔
5. ✅ **长度限制**：不超过 12 个字符（建议）

## 📋 字段变更清单

### 重要提示

⚠️ **2025-11-17 新增约束变更**：
- `student_id` 字段从**可选**改为**必填**（添加 NOT NULL 约束）
- 所有新记录必须提供学生ID
- 迁移脚本：`database/migrate_student_id_required.sql`

### 1. users 表

#### 字段变更

| 旧字段名 | 新字段名 | 类型 | 说明 | 字符数变化 |
|---------|---------|------|------|-----------|
| `password_hash` | `passwd_hash` | TEXT | 密码哈希值 | 13 → 11 ✅ |

#### 索引变更

| 旧索引名 | 新索引名 | 类型 | 说明 |
|---------|---------|------|------|
| `idx_users_email` | `uniq_users_email` | UNIQUE | 邮箱唯一索引 |

**变更说明**：
- 将 `UNIQUE` 约束改为显式唯一索引
- 索引命名符合 `uniq_` 前缀规范

### 2. reports 表

#### 字段变更

| 旧字段名 | 新字段名 | 类型 | 说明 | 字符数变化 |
|---------|---------|------|------|-----------|
| `audio_duration` | `audio_dur` | INTEGER | 音频时长（秒） | 14 → 9 ✅ |
| `cost_breakdown` | `cost_detail` | JSONB | 成本明细 | 14 → 11 ✅ |

#### 索引变更

| 旧索引名 | 新索引名 | 类型 | 说明 |
|---------|---------|------|------|
| `idx_reports_cost_breakdown` | `idx_reports_cost_detail` | GIN | 成本明细 GIN 索引 |

### 3. otps 表

**无变更** ✅ - 所有字段已符合命名规范

## 🔄 迁移影响范围

### 1. 数据库层面

✅ **已完成更新的文件**：
- `database/schema.sql` - 生产版
- `database/init.sql` - 简化版
- `database/archive/schema.sql` - 归档版
- `database/README.md` - 文档

### 2. 应用代码层面（需要手动更新）

以下代码需要同步更新字段名：

#### 后端代码

**users 表相关**：
```python
# ❌ 旧代码
user = {
    "password_hash": hashed_password,
    ...
}

# ✅ 新代码
user = {
    "passwd_hash": hashed_password,
    ...
}
```

**reports 表相关**：
```python
# ❌ 旧代码
report = {
    "audio_duration": duration,
    "cost_breakdown": costs,
    ...
}

# ✅ 新代码
report = {
    "audio_dur": duration,
    "cost_detail": costs,
    ...
}
```

#### SQL 查询

**用户查询**：
```sql
-- ❌ 旧查询
SELECT email, password_hash FROM users WHERE email = ?;

-- ✅ 新查询
SELECT email, passwd_hash FROM users WHERE email = ?;
```

**报告查询**：
```sql
-- ❌ 旧查询
SELECT audio_duration, cost_breakdown FROM reports;

-- ✅ 新查询
SELECT audio_dur, cost_detail FROM reports;
```

**成本统计**：
```sql
-- ❌ 旧查询
SELECT cost_breakdown->>'transcription' AS transcription_cost FROM reports;

-- ✅ 新查询
SELECT cost_detail->>'transcription' AS transcription_cost FROM reports;
```

#### API 响应（JSON）

**用户响应**：
```json
// ❌ 旧响应
{
  "email": "user@example.com",
  "password_hash": "..."
}

// ✅ 新响应
{
  "email": "user@example.com",
  "passwd_hash": "..."
}
```

**报告响应**：
```json
// ❌ 旧响应
{
  "audio_duration": 120,
  "cost_breakdown": {
    "transcription": 0.01,
    "analysis": 0.02
  }
}

// ✅ 新响应
{
  "audio_dur": 120,
  "cost_detail": {
    "transcription": 0.01,
    "analysis": 0.02
  }
}
```

### 3. 前端代码层面（需要手动更新）

```javascript
// ❌ 旧代码
const { audio_duration, cost_breakdown } = report;
console.log(`时长：${audio_duration}秒`);
console.log(`成本：`, cost_breakdown);

// ✅ 新代码
const { audio_dur, cost_detail } = report;
console.log(`时长：${audio_dur}秒`);
console.log(`成本：`, cost_detail);
```

## 🔧 迁移步骤

### 方案 A：全新部署（推荐）

如果是新项目或可以重新建表：

```bash
# 1. 删除旧表（⚠️ 会丢失数据）
psql $DATABASE_URL -c "DROP TABLE IF EXISTS reports, otps, users CASCADE;"

# 2. 执行新的 schema.sql
psql $DATABASE_URL -f database/schema.sql

# 3. 验证
psql $DATABASE_URL -c "\d users"
psql $DATABASE_URL -c "\d reports"
```

### 方案 B：在线迁移（生产环境）

如果已有数据需要保留：

```sql
-- 1️⃣ users 表迁移
BEGIN;

-- 重命名字段
ALTER TABLE users RENAME COLUMN password_hash TO passwd_hash;

-- 删除旧索引，创建新唯一索引
DROP INDEX IF EXISTS idx_users_email;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users(email);

COMMIT;

-- 2️⃣ reports 表迁移
BEGIN;

-- 重命名字段
ALTER TABLE reports RENAME COLUMN audio_duration TO audio_dur;
ALTER TABLE reports RENAME COLUMN cost_breakdown TO cost_detail;

-- 删除旧索引，创建新索引
DROP INDEX IF EXISTS idx_reports_cost_breakdown;
CREATE INDEX IF NOT EXISTS idx_reports_cost_detail ON reports USING GIN(cost_detail);

COMMIT;

-- 3️⃣ 验证迁移
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reports' 
ORDER BY ordinal_position;
```

### 方案 C：双写过渡（零停机）

适用于高可用生产环境：

1. **阶段 1**：添加新字段（保留旧字段）
   ```sql
   ALTER TABLE users ADD COLUMN passwd_hash TEXT;
   ALTER TABLE reports ADD COLUMN audio_dur INTEGER;
   ALTER TABLE reports ADD COLUMN cost_detail JSONB;
   
   -- 数据迁移
   UPDATE users SET passwd_hash = password_hash;
   UPDATE reports SET audio_dur = audio_duration;
   UPDATE reports SET cost_detail = cost_breakdown;
   ```

2. **阶段 2**：应用代码同时写入新旧字段
   ```python
   user["password_hash"] = hashed_password  # 旧字段
   user["passwd_hash"] = hashed_password     # 新字段
   ```

3. **阶段 3**：切换读取到新字段
   ```python
   # 优先使用新字段
   password = user.get("passwd_hash") or user.get("password_hash")
   ```

4. **阶段 4**：停止写入旧字段

5. **阶段 5**：删除旧字段
   ```sql
   ALTER TABLE users DROP COLUMN password_hash;
   ALTER TABLE reports DROP COLUMN audio_duration;
   ALTER TABLE reports DROP COLUMN cost_breakdown;
   ```

## 🔒 student_id 必填约束迁移

### 背景

从 2025-11-17 开始，`student_id` 字段改为必填字段（添加 NOT NULL 约束）。

### 迁移步骤

#### 1️⃣ 检查现有数据

```sql
-- 查看是否有空的 student_id
SELECT COUNT(*) as null_count
FROM reports
WHERE student_id IS NULL;
```

如果有空值记录，需要先处理：

```sql
-- 选项1：删除没有 student_id 的记录
DELETE FROM reports WHERE student_id IS NULL;

-- 选项2：为空值设置默认值
UPDATE reports 
SET student_id = 'UNKNOWN_' || id::TEXT
WHERE student_id IS NULL;
```

#### 2️⃣ 执行迁移

```bash
# 备份数据库
pg_dump $DATABASE_URL > backup_before_student_id_required_$(date +%Y%m%d_%H%M%S).sql

# 执行迁移
psql $DATABASE_URL -f database/migrate_student_id_required.sql
```

#### 3️⃣ 验证迁移

```sql
-- 检查约束是否生效
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'reports' 
  AND column_name = 'student_id';
```

预期结果：`is_nullable` 应为 `NO`

#### 4️⃣ 测试插入

```sql
-- 测试：尝试插入没有 student_id 的记录（应该失败）
INSERT INTO reports (user_id, student_name) 
VALUES (gen_random_uuid(), 'Test Student');
-- 预期错误：null value in column "student_id" violates not-null constraint
```

### 影响范围

- ✅ TypeScript 接口已更新：`studentId: string` (必填)
- ✅ 数据库架构已更新：`student_id TEXT NOT NULL`
- ✅ API 请求验证：前端必须传递 studentId
- ✅ 报告记录：所有新报告必须包含学生ID

## ✅ 验证清单

迁移完成后，请检查：

- [ ] 数据库字段名已更新
- [ ] 索引命名已更新
- [ ] 后端 ORM/SQL 查询已更新
- [ ] API 响应字段名已更新
- [ ] 前端代码已更新
- [ ] 单元测试已更新
- [ ] 集成测试通过
- [ ] API 文档已更新
- [ ] 数据迁移脚本已测试
- [ ] **student_id NOT NULL 约束已添加** ⭐

## 📞 技术支持

如有问题，请参考：
- [数据库使用指南](README.md)
- [阿里云 RDS 部署指南](ALIYUN_RDS_GUIDE.md)
- [项目 Issues](../../issues)

---

**最后更新**：2025-11-17  
**版本**：v2.0 - 符合命名规范

