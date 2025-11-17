# 阿里云 RDS PostgreSQL 配置归档

> ⚠️ **注意**：本目录包含的阿里云 RDS 相关配置文件已归档，**不推荐继续使用**。

## 归档原因

项目已迁移到 **Zeabur** 平台进行部署，阿里云 RDS 配置已不再使用。主要原因：

1. **成本优化**：Zeabur 提供开发阶段免费额度
2. **简化运维**：一键部署，自动注入 `DATABASE_URL`
3. **开发体验**：更好的开发者工具和日志查看
4. **安全性**：避免在代码中硬编码数据库密码

## 归档文件

### SQL 脚本
- `complete_setup.sql` - 阿里云 RDS 完整初始化脚本（330行）
- `aliyun_rds_setup.sql` - 阿里云 RDS 简化初始化脚本（195行）

### 文档
- `SETUP_INSTRUCTIONS.md` - 阿里云 RDS 详细配置指南

## ⚠️ 安全提醒

这些文件包含阿里云 RDS 数据库的连接信息：

```
Host: report-generation-project-pub.rwlb.rds.aliyuncs.com
User: report_write
Password: tJQeRmma-lixM%NR-V
```

**如果该数据库仍在使用，请务必：**
1. 修改数据库密码
2. 配置安全组白名单
3. 启用 SSL 加密连接
4. 定期备份数据

## 推荐的数据库部署方式

1. **Zeabur**（推荐）：
   - 使用项目根目录的 `init.sql` 初始化
   - 参考 `QUICKSTART_ZEABUR.md` 快速部署
   - 自动注入 `DATABASE_URL` 环境变量

2. **自托管 PostgreSQL**：
   - 使用 Docker Compose
   - 参考 `database/README.md` 配置

3. **其他云平台**：
   - AWS RDS
   - Google Cloud SQL
   - Supabase

## 迁移指南

如果需要从阿里云 RDS 迁移数据：

1. **导出数据**：
```bash
pg_dump "postgresql://report_write:tJQeRmma-lixM%25NR-V@report-generation-project-pub.rwlb.rds.aliyuncs.com:5432/postgres" > backup.sql
```

2. **导入到新数据库**：
```bash
psql $DATABASE_URL < backup.sql
```

3. **验证数据**：
```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM reports;
SELECT COUNT(*) FROM otps;
```

---

归档时间：2025-11-17

