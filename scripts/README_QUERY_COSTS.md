# 成本查询 CLI 工具使用指南

## 🚀 快速开始

### 1️⃣ 安装 PostgreSQL 客户端（如果未安装）

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt install postgresql-client

# CentOS/RHEL
sudo yum install postgresql
```

### 2️⃣ 设置数据库连接字符串

从 **Zeabur 控制台** 复制 PostgreSQL 连接字符串：

```bash
# 临时设置（当前终端会话有效）
export POSTGRES_CONNECTION_STRING='postgresql://user:password@host:port/database'

# 或者使用 DATABASE_URL
export DATABASE_URL='postgresql://user:password@host:port/database'
```

**💡 提示**：在 Zeabur 控制台找到连接字符串的位置：
1. 打开你的 PostgreSQL 服务
2. 点击 "连接" 标签
3. 复制 "Connection String"

### 3️⃣ 运行查询工具

```bash
cd /Users/ruiwang/Desktop/test
./scripts/query-costs.sh
```

---

## 📋 可用查询

工具提供以下 10 种预设查询：

| 选项 | 查询名称 | 说明 |
|------|----------|------|
| 1 | 📊 全局统计概览 | 总用户数、总报告数、总花费等 |
| 2 | 👥 所有用户花费排行 | 按用户统计花费，从高到低排序 |
| 3 | 👨‍🎓 每个用户的学生花费明细 | 按用户和学生分组的详细花费 |
| 4 | 📝 最近 50 条报告详情 | 最新的 50 条报告成本明细 |
| 5 | 📅 按日期统计花费 | 每日花费趋势 |
| 6 | 🏆 花费最高的前 10 个学生 | TOP 10 学生花费排行 |
| 7 | 🔬 成本结构分析 | 转录成本 vs AI 成本占比 |
| 8 | 📈 按周统计花费趋势 | 每周花费汇总 |
| 9 | 🕒 最近一次报告成本详情 | 最新报告的完整成本分解 |
| 10 | 🔧 自定义 SQL 查询 | 输入任意 SQL 查询 |

---

## 💡 常见使用场景

### 场景 1：快速查看系统使用情况

```bash
# 1. 运行脚本
./scripts/query-costs.sh

# 2. 选择选项 1（全局统计概览）
# 3. 查看总用户数、总报告数、总花费等
```

### 场景 2：找出花费最高的用户

```bash
# 选择选项 2（所有用户花费排行）
# 按花费从高到低排序
```

### 场景 3：监控每日成本趋势

```bash
# 选择选项 5（按日期统计花费）
# 查看每天的报告数量和花费
```

### 场景 4：分析成本结构

```bash
# 选择选项 7（成本结构分析）
# 查看转录成本和 AI 成本的占比
```

### 场景 5：运行自定义查询

```bash
# 选择选项 10（自定义 SQL 查询）
# 输入你的 SQL（可以多行）
# 输入空行结束并执行
```

---

## 🔧 高级技巧

### 导出查询结果到 CSV

```bash
# 方法 1：使用重定向（需要修改脚本）
psql "$POSTGRES_CONNECTION_STRING" -c "SELECT ..." --csv > output.csv

# 方法 2：手动导出
export POSTGRES_CONNECTION_STRING='your-connection-string'
psql "$POSTGRES_CONNECTION_STRING" -c "
  COPY (
    SELECT 
      u.email as 用户邮箱,
      COUNT(r.id) as 报告数量,
      ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 总花费元
    FROM reports r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.cost_breakdown IS NOT NULL
    GROUP BY u.email
    ORDER BY 总花费元 DESC
  ) TO STDOUT WITH CSV HEADER
" > user_costs.csv
```

### 定时执行查询

```bash
# 创建定时任务（每天凌晨 2 点执行）
crontab -e

# 添加以下行：
0 2 * * * export POSTGRES_CONNECTION_STRING='your-string' && /path/to/query-costs.sh > /path/to/daily-report.log 2>&1
```

---

## 📊 示例输出

### 全局统计概览

```
 总用户数 | 总学生数 | 总报告数 | 总花费元 | 平均单次花费元 | 最低单次花费元 | 最高单次花费元
----------+----------+----------+----------+----------------+----------------+----------------
        5 |       12 |       45 |  23.4500 |         0.5211 |         0.1200 |         2.3400
```

### 用户花费排行

```
     用户邮箱      | 报告数量 | 总花费元 | 平均花费元 |   首次使用时间      |   最近使用时间
-------------------+----------+----------+------------+---------------------+---------------------
 user1@51talk.com |       15 |   8.4500 |     0.5633 | 2025-11-01 10:30:00 | 2025-11-12 15:20:00
 user2@51talk.com |       12 |   6.2300 |     0.5192 | 2025-11-03 14:15:00 | 2025-11-11 09:45:00
```

---

## ⚠️ 注意事项

1. **连接字符串安全**：
   - 不要将连接字符串提交到 Git
   - 使用环境变量或加密存储

2. **查询性能**：
   - 对于大数据量，某些查询可能较慢
   - 考虑添加 LIMIT 限制结果数量

3. **权限要求**：
   - 需要数据库的 SELECT 权限
   - 某些查询需要访问 `reports` 和 `users` 表

4. **时区问题**：
   - 查询结果中的时间为数据库时区
   - 如需转换时区，修改 SQL 中的 `TO_CHAR` 函数

---

## 🐛 故障排查

### 问题 1：`psql: command not found`

**解决方案**：安装 PostgreSQL 客户端

```bash
# macOS
brew install postgresql

# Ubuntu
sudo apt install postgresql-client
```

### 问题 2：连接失败

**检查项**：
1. ✅ 连接字符串格式正确
2. ✅ 网络可以访问 Zeabur 服务器
3. ✅ 数据库用户名和密码正确
4. ✅ 数据库服务正在运行

### 问题 3：查询返回空结果

**可能原因**：
- 数据库中没有 `cost_breakdown` 字段的数据
- 需要先生成几个报告才会有成本数据

### 问题 4：中文显示乱码

**解决方案**：设置终端编码

```bash
export LC_ALL=zh_CN.UTF-8
export LANG=zh_CN.UTF-8
```

---

## 📞 获取帮助

如果遇到问题，可以：

1. 查看脚本内的注释
2. 检查数据库连接状态
3. 直接在 Zeabur 控制台运行 SQL
4. 查看 PostgreSQL 日志

---

## 🔗 相关文件

- 📝 SQL 查询集合：`/Users/ruiwang/Desktop/test/sql_queries/cost_analysis.sql`
- 🔧 CLI 工具脚本：`/Users/ruiwang/Desktop/test/scripts/query-costs.sh`
- 📚 数据库架构：`/Users/ruiwang/Desktop/test/database/add_cost_tracking.sql`

---

**享受高效的成本分析！** 🎉

