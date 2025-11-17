# 📦 数据库归档文件说明

> **归档日期：** 2025-11-17  
> **原因：** 整理重复文件，统一数据库架构

---

## ⚠️ 重要提示

**此目录中的文件已归档，不应用于新部署！**

所有功能已合并到根目录的 `schema.sql` 文件中。

---

## 📁 归档文件列表

### 1. `init.sql` - 旧的简化版初始化脚本

**归档原因：** 功能已被 `schema.sql` 完全取代

**与 schema.sql 的区别：**
- ❌ 缺少多个重要字段（student_name, file_name, file_url, audio_dur 等）
- ❌ 缺少成本追踪字段（cost_detail, total_cost）
- ❌ 索引数量较少（6个 vs 12个）
- ❌ 缺少触发器和字段注释

**状态：** ⚠️ 已过时，请使用 `../schema.sql`

---

### 2. `migrate_field_names.sql` - 字段名迁移脚本

**归档原因：** 历史迁移任务已完成

**功能：** 将旧字段名迁移到新字段名
- `password_hash` → `passwd_hash`
- `audio_duration` → `audio_dur`
- `cost_breakdown` → `cost_detail`

**状态：** ✅ 历史迁移，已完成

**注意：** 新部署使用 `schema.sql` 已包含正确的字段名，无需执行此脚本。

---

### 3. `migrate_student_id_required.sql` - student_id 必填迁移

**归档原因：** 历史迁移任务已完成

**功能：** 将 `student_id` 字段从可选改为必填（添加 NOT NULL 约束）

**状态：** ✅ 历史迁移，已完成

**注意：** `schema.sql` 中 `student_id` 已默认为 NOT NULL。

---

### 4. `add_*.sql` - 增量迁移脚本

**包含文件：**
- `add_cost_tracking.sql` - 添加成本追踪字段
- `add_password_to_users.sql` - 添加密码字段
- `add_student_id.sql` - 添加学生ID字段

**归档原因：** 所有增量字段已合并到 `schema.sql`

**状态：** ✅ 已合并

---

### 5. `create_*.sql` - 单表创建脚本

**包含文件：**
- `create_users_table.sql` - 创建用户表
- `create_otps_table.sql` - 创建验证码表
- `create_reports_table.sql` - 创建报告表
- `update_reports_table.sql` - 更新报告表

**归档原因：** 分散的单表创建已统一到 `schema.sql`

**状态：** ✅ 已合并

---

### 6. `aliyun/` - 阿里云 RDS 历史配置

**包含文件：**
- `aliyun_rds_setup.sql` - 阿里云特定配置
- `complete_setup.sql` - 完整安装脚本
- `SETUP_INSTRUCTIONS.md` - 安装说明
- `README.md` - 阿里云文档

**归档原因：** 阿里云部署现在使用通用的 `schema.sql`

**状态：** 📦 历史参考

**注意：** 阿里云 RDS 部署请参考根目录的 `ALIYUN_RDS_GUIDE.md`

---

### 7. `schema.sql`（旧版） - 旧版本架构

**归档原因：** 已被根目录的 `schema.sql` 取代

**状态：** ⚠️ 已过时

---

## 🎯 如何使用正确的文件？

### ✅ 新项目部署

```bash
# 使用根目录的 schema.sql（推荐）
psql $DATABASE_URL -f ../schema.sql
```

### ✅ 现有数据库

如果你的数据库使用了归档文件创建，建议：

1. **检查字段是否完整**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'reports' 
   ORDER BY ordinal_position;
   ```

2. **对比缺失字段**
   查看 `../schema.sql` 中的完整字段列表

3. **考虑迁移**
   如缺少重要字段（如 cost_detail, student_name 等），建议：
   - 备份现有数据
   - 添加缺失字段
   - 参考 `../FIELD_NAMING_CHANGES.md` 进行字段名更新

---

## 📚 相关文档

- **当前架构：** `../schema.sql`
- **快速参考：** `../QUICK_REFERENCE.md`
- **字段命名：** `../FIELD_NAMING_CHANGES.md`
- **部署指南：** `../README.md`
- **阿里云部署：** `../ALIYUN_RDS_GUIDE.md`

---

## ❓ 常见问题

### Q1: 我可以继续使用 init.sql 吗？

**A:** 不推荐。`init.sql` 缺少多个重要字段和功能。建议使用 `../schema.sql`。

### Q2: 如果我的数据库已经用 init.sql 创建了怎么办？

**A:** 可以继续使用，但建议添加缺失的字段。参考 `add_*.sql` 脚本了解需要添加的字段。

### Q3: 迁移脚本还有用吗？

**A:** 仅用于历史参考。新部署直接使用 `../schema.sql` 即可，无需执行迁移。

### Q4: 这些文件可以删除吗？

**A:** 建议保留用于：
- 版本追溯
- 了解架构演变历史
- 旧数据库迁移参考

---

**归档版本：** v3.0  
**归档日期：** 2025-11-17  
**维护状态：** 📦 仅保留，不再更新
