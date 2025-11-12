# 🚀 快速参考指南

## 📊 查看成本数据

### 方法 1: 交互式工具（最简单）

```bash
cd /Users/ruiwang/Desktop/test
./scripts/connect-db.sh
```

然后选择：
- `1` - 全局统计概览
- `2` - 所有用户花费排行
- `3` - 每个用户的学生花费明细
- 或输入自定义 SQL

---

### 方法 2: 快速命令

```bash
# 查看报告总数
./scripts/connect-db.sh -c "SELECT COUNT(*) FROM reports;"

# 查看最新报告
./scripts/connect-db.sh -c "
  SELECT 
    analysis->>'studentName' as 学生,
    ROUND((cost_breakdown->'total'->>'cost')::numeric, 4) as 成本元,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as 时间
  FROM reports
  ORDER BY created_at DESC
  LIMIT 5;
"

# 查看所有用户的花费
./scripts/connect-db.sh -c "
  SELECT 
    u.email as 用户,
    COUNT(r.id) as 报告数,
    ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 2) as 总花费元
  FROM reports r
  LEFT JOIN users u ON r.user_id = u.id
  WHERE r.cost_breakdown IS NOT NULL
  GROUP BY u.email
  ORDER BY 总花费元 DESC;
"
```

---

## 🎯 常用操作

### 生成新报告（网页操作）

1. 访问网站
2. 登录（`@51talk.com` 邮箱）
3. 上传两个视频
4. 填写学生信息
5. 点击"生成分析报告"
6. ✅ **数据自动保存到数据库！**

### 部署到 Zeabur

```bash
cd /Users/ruiwang/Desktop/test
git add .
git commit -m "你的提交信息"
git push
# Zeabur 会自动部署
```

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

---

## 🔍 调试技巧

### 查看服务器日志

在 Zeabur 上：
1. 进入项目
2. 点击 "Logs"
3. 查找关键词：
   - `✅ 报告记录已保存到数据库` - 成功保存
   - `⚠️ 报告记录保存失败` - 保存失败
   - `总成本: ¥` - 查看成本

### 验证数据是否保存

```bash
# 检查最新一条记录
./scripts/connect-db.sh -c "
  SELECT 
    id,
    user_id IS NOT NULL as 有用户ID,
    analysis IS NOT NULL as 有分析数据,
    cost_breakdown IS NOT NULL as 有成本数据,
    analysis->>'studentName' as 学生姓名,
    created_at
  FROM reports
  ORDER BY created_at DESC
  LIMIT 1;
"
```

---

## 📁 重要文件位置

| 类型 | 文件路径 | 说明 |
|------|---------|------|
| **数据库** | `scripts/connect-db.sh` | 数据库连接工具 |
| | `sql_queries/cost_analysis.sql` | SQL 查询集合 |
| | `database/add_cost_tracking.sql` | 建表脚本 |
| **后端** | `server/services/reportRecordService.ts` | 报告记录服务 |
| | `server/services/videoAnalysisService.ts` | 视频分析服务 |
| | `server/routes/analysis.ts` | 分析 API 路由 |
| **前端** | `src/pages/Index.tsx` | 主页面 |
| | `src/services/api.ts` | API 服务 |
| **文档** | `DATABASE_REPORT_FLOW.md` | 数据流程说明 |
| | `CODE_REVIEW_SUMMARY.md` | 代码检查总结 |
| | `QUICK_REFERENCE.md` | 快速参考（本文档） |

---

## 💰 成本结构速查

```json
{
  "transcription": {
    "service": "tingwu",
    "totalMinutes": 11,
    "unitPrice": 0.01,      // ¥0.01/分钟
    "cost": 0.11,
    "currency": "CNY"
  },
  "aiAnalysis": {
    "provider": "GLM",
    "model": "glm-4-plus",
    "totalTokens": 12700,
    "totalCost": 0.635,     // 输入+输出: ¥0.05/千tokens
    "currency": "CNY"
  },
  "total": {
    "cost": 0.745,          // 总成本
    "currency": "CNY"
  }
}
```

---

## 🐛 问题排查

### 问题：数据库是空的

**原因**: 还没有生成任何报告  
**解决**: 通过网页生成一个报告

---

### 问题：user_id 为空

**原因**: 用户未登录或前端未传递 userId  
**解决**: 
1. 确保用户已登录
2. 检查 `src/pages/Index.tsx` 是否传递了 `userId: user?.id`

---

### 问题：查询报错

**原因**: SQL 语法错误或 JSON 路径错误  
**解决**: 
- ✅ 使用: `analysis->>'studentName'`
- ✅ 使用: `cost_breakdown->'total'->>'cost'`
- ❌ 不要: `student_name` （表中没有这个字段）

---

## 📞 获取帮助

1. 查看 `DATABASE_REPORT_FLOW.md` 了解数据流程
2. 查看 `CODE_REVIEW_SUMMARY.md` 了解代码检查结果
3. 运行 `./scripts/connect-db.sh` 使用交互式工具
4. 检查 `sql_queries/cost_analysis.sql` 中的查询示例

---

**最后更新**: 2025-11-12

