# 数据库迁移文件归档

本目录包含历史数据库迁移和更新脚本，这些脚本已经被整合到主 `schema.sql` 文件中。

## 归档日期
2025-11-15

## 归档文件说明

### 用户表相关
- `create_users_table.sql` - 初始用户表创建
- `add_password_to_users.sql` - 添加密码字段

### 报告表相关
- `create_reports_table.sql` - 初始报告表创建
- `update_reports_table.sql` - 报告表更新
- `add_student_id.sql` - 添加学生ID字段
- `add_cost_tracking.sql` - 添加成本追踪字段

### OTP表相关
- `create_otps_table.sql` - OTP验证码表创建

## 当前使用的建表文件

请使用 `/database/schema.sql` 文件，该文件包含：
- ✅ PostgreSQL 17 完整建表语句
- ✅ 所有表定义（users、otps、reports）
- ✅ 所有索引和外键约束
- ✅ 自动更新时间戳触发器
- ✅ 完整的字段注释

## 注意事项

这些归档文件仅供参考和历史记录，**不应再用于生产环境**。

