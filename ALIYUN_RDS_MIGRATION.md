# 阿里云 RDS 数据库迁移完成

## 📋 迁移总结

已成功将数据库从 **Zeabur PostgreSQL** 迁移到 **阿里云 RDS PostgreSQL**。

迁移时间：2025-11-15

---

## ✅ 已完成的工作

### 1. 环境变量配置更新

#### `.env` 文件
- ✅ 替换 `DATABASE_URL` 为独立的数据库配置变量
- ✅ 设置阿里云 RDS 连接参数：
  - `DB_HOST`: `pgm-2zeocagx2zo8v2c55o.rwlb.rds.aliyuncs.com`
  - `DB_PORT`: `5432`
  - `DB_NAME`: `report_generation`
  - `DB_USER`: `wangrui003`
  - `DB_PASSWORD`: `Wr18912332269`
  - `DB_SSL`: `false` (阿里云 RDS 不支持 SSL 或需要特殊配置)

#### `.env.local` 文件
- ✅ 同步更新本地开发环境配置
- ✅ 保持与 `.env` 一致的数据库连接参数

#### 备份文件
- ✅ 已创建 `.env.backup.zeabur` - 保存原 Zeabur 配置
- ✅ 已创建 `.env.local.backup.zeabur` - 保存原本地配置

### 2. 数据库连接测试

```bash
npm run test:db
```

测试结果：✅ **连接成功**

```
✅ 数据库连接成功: 2025-11-15T12:29:20.541Z

🔍 检查数据库表...
✅ users 表存在
✅ otps 表存在
✅ reports 表存在
```

### 3. Zeabur 配置更新

已更新 `zeabur.yaml`：
- ✅ 移除了 `depends_on: database` 依赖
- ✅ 移除了 Zeabur 自带的 PostgreSQL 服务配置
- ✅ 添加了阿里云 RDS 环境变量配置
- ✅ 添加了敏感信息设置提醒

---

## 🔧 阿里云 RDS 配置详情

### 数据库信息
- **实例地址**: `pgm-2zeocagx2zo8v2c55o.rwlb.rds.aliyuncs.com`
- **端口**: `5432`
- **数据库名**: `report_generation`
- **用户名**: `wangrui003`
- **SSL**: 禁用

### 已创建的表
1. **users** - 用户表
2. **otps** - 验证码表
3. **reports** - 报告表

所有表结构已通过以下 SQL 文件创建：
- `database/complete_setup.sql`
- `database/aliyun_rds_setup.sql`

---

## 🚀 部署到 Zeabur

### 需要在 Zeabur 控制台设置的环境变量

由于 `zeabur.yaml` 中已配置了非敏感信息，您只需要在 Zeabur 控制台设置以下**敏感变量**：

#### 数据库配置
```
DB_PASSWORD=your_database_password
```

#### 应用配置
```
JWT_SECRET=your_jwt_secret_here
```

#### 阿里云服务
```
ALIYUN_ACCESS_KEY_ID=your_aliyun_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_aliyun_access_key_secret
ALIYUN_TINGWU_APP_KEY=your_tingwu_app_key
```

#### AI 服务
```
GLM_API_KEY=your_glm_api_key
```

#### 邮件服务
```
SMTP_HOST=smtp.qiye.aliyun.com
SMTP_PORT=465
SMTP_USER=your_email@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM=your_email@example.com
```

#### 监控服务
```
SENTRY_DSN=your_sentry_dsn
VITE_SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production
```

### 部署步骤

1. **提交代码到 Git**
   ```bash
   git add .
   git commit -m "迁移到阿里云 RDS 数据库"
   git push
   ```

2. **在 Zeabur 控制台设置环境变量**
   - 进入项目设置
   - 找到环境变量配置页面
   - 添加上述所有敏感变量

3. **触发部署**
   - Zeabur 会自动检测 Git 推送并触发部署
   - 或在控制台手动触发重新部署

4. **验证部署**
   ```bash
   curl https://your-app.zeabur.app/api/health
   ```

---

## 🔄 回滚到 Zeabur 数据库

如果需要回滚到 Zeabur 自带的数据库：

```bash
# 恢复配置文件
cp .env.backup.zeabur .env
cp .env.local.backup.zeabur .env.local

# 恢复 zeabur.yaml（使用 git）
git checkout zeabur.yaml

# 测试连接
npm run test:db
```

---

## 📊 数据库对比

| 特性 | Zeabur PostgreSQL | 阿里云 RDS PostgreSQL |
|------|-------------------|----------------------|
| **访问速度** | 快（同区域） | 快（阿里云国内） |
| **稳定性** | 高 | 高（企业级） |
| **价格** | 按小时计费 | 按配置计费 |
| **备份** | 自动备份 | 自动备份 + 手动备份 |
| **扩展性** | 受限于套餐 | 灵活扩展 |
| **SSL** | 不支持 | 支持（需配置） |
| **监控** | 基础监控 | 完整监控面板 |
| **管理工具** | Zeabur 控制台 | 阿里云控制台 + 第三方工具 |

---

## ⚠️ 注意事项

1. **SSL 配置**
   - 当前设置为 `DB_SSL=false`
   - 如需启用 SSL，需要在阿里云控制台配置 SSL 证书
   - 参考：[阿里云 RDS SSL 配置文档](https://help.aliyun.com/document_detail/229518.html)

2. **网络安全**
   - 确保阿里云 RDS 白名单包含 Zeabur 的出口 IP
   - 当前已开放公网访问（仅用于开发测试）
   - 生产环境建议配置 VPC 专网访问

3. **性能优化**
   - 当前连接池配置：`DB_POOL_MAX=20`
   - 可根据实际负载调整连接池大小
   - 监控慢查询并优化索引

4. **成本控制**
   - 阿里云 RDS 按配置计费
   - 定期检查使用情况和成本
   - 考虑使用预留实例降低成本

---

## 📚 相关文档

- [数据库设置说明](database/SETUP_INSTRUCTIONS.md)
- [环境配置指南](ENVIRONMENT_SETUP_GUIDE.md)
- [部署检查清单](DEPLOYMENT_CHECKLIST.md)
- [阿里云 RDS 文档](https://help.aliyun.com/product/26090.html)

---

## 🎉 迁移完成！

您的应用现在已经成功连接到阿里云 RDS PostgreSQL 数据库。

如有任何问题，请参考上述文档或联系技术支持。

