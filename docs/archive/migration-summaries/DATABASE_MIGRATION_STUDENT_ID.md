# 数据库迁移：添加学生ID字段

## 📋 迁移概述

本次迁移为 `reports` 表添加 `student_id` 字段，用于存储学生的唯一标识。

## 🗓️ 迁移日期

2025-11-13

## 📦 变更内容

### 1. 数据库表结构变更

**表名：** `reports`

**新增字段：**
- `student_id` (TEXT, 可空)
  - 说明：学生的唯一标识符
  - 索引：已创建索引 `idx_reports_student_id`

### 2. 迁移脚本

位置：`database/add_student_id.sql`

```sql
-- 添加 student_id 字段
ALTER TABLE reports ADD COLUMN IF NOT EXISTS student_id TEXT;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON reports(student_id);

-- 添加注释
COMMENT ON COLUMN reports.student_id IS '学生ID（唯一标识）';
```

## 🚀 如何执行迁移

### 本地开发环境

```bash
# 连接到本地数据库
psql -U your_username -d your_database

# 执行迁移脚本
\i database/add_student_id.sql
```

### Zeabur 生产环境

1. 登录 Zeabur 控制台
2. 选择 PostgreSQL 服务
3. 点击 "Connect" 获取连接信息
4. 使用 psql 连接：
   ```bash
   psql postgres://username:password@host:port/database
   ```
5. 执行迁移脚本：
   ```sql
   \i database/add_student_id.sql
   ```

或者直接在 Zeabur 的 Database Console 中执行 SQL：

```sql
ALTER TABLE reports ADD COLUMN IF NOT EXISTS student_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON reports(student_id);
COMMENT ON COLUMN reports.student_id IS '学生ID（唯一标识）';
```

## ✅ 验证迁移

执行以下查询确认字段已添加：

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'reports' 
  AND column_name = 'student_id';
```

预期输出：
```
 column_name | data_type | is_nullable 
-------------+-----------+-------------
 student_id  | text      | YES
```

## 📝 相关代码变更

### 后端

1. **类型定义** (`server/types/index.ts`)
   - `VideoAnalysisRequest` 添加 `studentId?: string`
   - `VideoAnalysisResponse` 添加 `studentId?: string`

2. **验证逻辑** (`server/utils/validation.ts`)
   - 新增 `isValidStudentId()` 函数

3. **API路由** (`server/routes/analysis.ts`)
   - 添加学生ID验证逻辑
   - 日志中记录学生ID

4. **服务层** (`server/services/videoAnalysisService.ts`)
   - `compareVideos()` 方法接收 `studentId`
   - `analyzeMock()` 返回 `studentId`
   - 报告记录包含 `studentId`

5. **数据库服务** (`server/services/reportRecordService.ts`)
   - `ReportRecord` 接口添加 `studentId`
   - `recordReport()` 方法保存 `student_id` 到数据库
   - 查询方法返回 `student_id`

### 前端

1. **表单组件** (`src/components/VideoAnalysisForm.tsx`)
   - `FormData` 接口添加 `studentId?: string`
   - 新增学生ID输入框（与学生姓名并排显示）
   - 快速测试功能填充示例学生ID

2. **报告展示** (`src/components/ReportDisplay.tsx`)
   - `ReportData` 接口添加 `studentId?: string`
   - 报告头部显示学生ID（如果存在）

## 🔍 字段说明

### student_id 字段

- **用途：** 存储学生的唯一标识符（如学生编号、学号等）
- **类型：** TEXT
- **可空：** 是（可选字段）
- **验证规则：**
  - 长度：2-50 个字符
  - 格式：仅支持字母、数字、下划线和短横线 (`[a-zA-Z0-9_-]+`)
- **示例：** `STU001`, `student-123`, `2024_zhang_ming`

## 📊 数据库表完整结构

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT,                    -- 新增字段
  video_url TEXT,
  transcript TEXT,
  analysis JSONB,
  cost_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_student_id ON reports(student_id);  -- 新增索引
CREATE INDEX idx_reports_created_at ON reports(created_at);
CREATE INDEX idx_reports_cost_breakdown ON reports USING GIN (cost_breakdown);
```

## 🔄 回滚方案

如果需要回滚此次迁移：

```sql
-- 删除索引
DROP INDEX IF EXISTS idx_reports_student_id;

-- 删除字段
ALTER TABLE reports DROP COLUMN IF EXISTS student_id;
```

**注意：** 回滚会永久删除所有已存储的学生ID数据，请谨慎操作。

## 📌 注意事项

1. **向后兼容：** 学生ID字段为可选（可空），不影响现有功能
2. **数据验证：** 前端和后端都进行格式验证
3. **性能影响：** 已添加索引，对查询性能影响最小
4. **显示逻辑：** 报告中仅在有学生ID时显示该字段

## ✨ 新功能说明

用户现在可以在创建报告时输入学生ID，该ID将：
- ✅ 保存到数据库 `reports` 表
- ✅ 显示在生成的报告中
- ✅ 包含在下载的报告长图中
- ✅ 可用于后续的数据查询和统计

学生ID是**可选字段**，用户可以选择是否填写。

