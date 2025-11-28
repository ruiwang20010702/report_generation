# 🚀 快速开始 - 数据库查询工具

## 方式 1：使用交互式查询工具（推荐）

```bash
cd /Users/ruiwang/Desktop/test

# 先设置数据库连接（从 .env 文件或手动设置）
source .env  # 或手动 export DATABASE_URL='...'

./scripts/query-costs.sh
```

这将启动一个带菜单的交互式工具，你可以选择预设的查询。

---

## 方式 2：直接连接到 psql

```bash
cd /Users/ruiwang/Desktop/test
source .env
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM reports;"
```

---

## 方式 3：手动设置环境变量

```bash
# 从 .env 文件或云服务控制台获取连接字符串
export DATABASE_URL='postgresql://user:password@host:port/database'

# 然后运行查询工具
./scripts/query-costs.sh

# 或直接使用 psql
psql "$DATABASE_URL"
```

---

## 📊 常用查询示例

### 查看数据库状态

```bash
psql "$DATABASE_URL" -c "
  SELECT 
    COUNT(*) as 报告总数,
    COUNT(DISTINCT user_id) as 用户数,
    MIN(created_at) as 最早报告,
    MAX(created_at) as 最新报告
  FROM reports;
"
```

### 查看最近的报告

```bash
psql "$DATABASE_URL" -c "
  SELECT 
    created_at,
    analysis->>'studentName' as 学生姓名,
    ROUND((cost_breakdown->'total'->>'cost')::numeric, 4) as 成本
  FROM reports
  ORDER BY created_at DESC
  LIMIT 10;
"
```

### 查看所有表

```bash
psql "$DATABASE_URL" -c "\dt"
```

---

## 📁 文件说明

- `query-costs.sh` - 交互式查询工具（需要 DATABASE_URL 环境变量）
- `README_QUERY_COSTS.md` - 完整使用文档

---

## 🎯 下一步

1. **首次使用**：设置 `DATABASE_URL` 后运行 `./scripts/query-costs.sh`
2. **生成报告**：在网页中分析一个视频，生成第一个报告
3. **查看成本**：再次运行查询工具，选择"全局统计概览"

---

**提示**：目前数据库是空的，需要先通过网页生成报告才会有数据！🎓
