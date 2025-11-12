# 📊 报告数据保存流程说明

## 🎯 何时保存数据到数据库？

报告数据会在以下流程中**自动**保存到数据库：

### ✅ 完整流程：

1. **用户上传视频** 📹
   - 上传课前视频（video1）
   - 上传课中视频（video2）

2. **填写学生信息** 📝
   - 学生姓名
   - 年级、级别、单元等

3. **点击"生成分析报告"按钮** 🚀
   - 系统开始转录视频（使用通义听悟）
   - 系统使用 AI 分析转录内容（GLM-4-Plus）
   - 系统生成对比报告

4. **报告显示在页面上** ✨
   - **此时数据已经自动保存到数据库！**
   - 包含：学生姓名、成本数据、完整分析报告
   - **不需要点击"下载长图"按钮**

5. **（可选）下载长图** 📥
   - 这只是把页面结果导出为图片
   - 与数据库保存无关

---

## 🔍 数据库结构

### `reports` 表结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 报告唯一ID |
| `user_id` | UUID | 用户ID（外键关联 users 表） |
| `analysis` | JSONB | **完整的分析报告数据**（包含 studentName） |
| `cost_breakdown` | JSONB | **成本详细信息** |
| `transcript` | TEXT | 转录文本（可能为空） |
| `video_url` | TEXT | 视频URL（可能为空） |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

---

## 💰 成本数据结构（`cost_breakdown` 字段）

```json
{
  "transcription": {
    "service": "tingwu",
    "video1Duration": 300,
    "video2Duration": 350,
    "totalMinutes": 11,
    "unitPrice": 0.01,
    "cost": 0.11,
    "currency": "CNY"
  },
  "aiAnalysis": {
    "provider": "GLM",
    "model": "glm-4-plus",
    "video1Analysis": {
      "promptTokens": 1500,
      "completionTokens": 2000,
      "totalTokens": 3500,
      "cost": 0.175
    },
    "video2Analysis": {
      "promptTokens": 1600,
      "completionTokens": 2100,
      "totalTokens": 3700,
      "cost": 0.185
    },
    "comparison": {
      "promptTokens": 3000,
      "completionTokens": 2500,
      "totalTokens": 5500,
      "cost": 0.275
    },
    "totalTokens": 12700,
    "totalCost": 0.635,
    "currency": "CNY"
  },
  "total": {
    "cost": 0.745,
    "currency": "CNY",
    "breakdown": "转录: ¥0.11 + AI分析: ¥0.64"
  },
  "timestamp": "2025-11-12T10:30:00Z"
}
```

---

## 📊 分析报告数据结构（`analysis` 字段）

```json
{
  "studentName": "张小明",
  "grade": "3年级",
  "level": "L4",
  "unit": "Unit 5",
  "video1Summary": { ... },
  "video2Summary": { ... },
  "comparison": { ... },
  "suggestions": [ ... ]
}
```

---

## 🔧 代码位置

### 1. 保存报告的服务：
`/Users/ruiwang/Desktop/test/server/services/reportRecordService.ts`

```typescript
async recordReport(record: ReportRecord): Promise<string> {
  const query = `
    INSERT INTO reports (
      user_id,
      cost_breakdown,
      analysis,
      created_at
    ) VALUES ($1, $2, $3, NOW())
    RETURNING id, created_at
  `;
  // ...
}
```

### 2. 调用保存的位置：
`/Users/ruiwang/Desktop/test/server/services/videoAnalysisService.ts`

```typescript
// 在 analyzeVideos 方法的最后：
if (report.costBreakdown) {
  reportRecordService.recordReport({
    userId: request.userId,
    studentName: request.studentName,
    costBreakdown: report.costBreakdown,
    analysisData: report // 保存完整的报告数据
  }).catch(err => {
    console.error('⚠️ 报告记录保存失败（不影响主流程）:', err.message);
  });
}
```

---

## 🎯 查询学生名字的正确方式

由于学生名字存储在 `analysis` JSONB 字段中，查询时需要使用：

```sql
-- ✅ 正确方式
SELECT 
  analysis->>'studentName' as 学生姓名,
  cost_breakdown->'total'->>'cost' as 成本
FROM reports;

-- ❌ 错误方式（表中没有这个字段）
SELECT student_name FROM reports;
```

---

## 📈 如何查看成本数据？

### 方式 1：使用交互式工具（推荐）

```bash
cd /Users/ruiwang/Desktop/test
./scripts/connect-db.sh
```

然后选择查询类型，例如：
- 选项 1：全局统计概览
- 选项 2：所有用户花费排行
- 选项 3：每个用户的学生花费明细

### 方式 2：直接 SQL 查询

```bash
./scripts/connect-db.sh -c "
  SELECT 
    analysis->>'studentName' as 学生姓名,
    ROUND((cost_breakdown->'total'->>'cost')::numeric, 4) as 成本,
    created_at as 生成时间
  FROM reports
  ORDER BY created_at DESC
  LIMIT 10;
"
```

### 方式 3：使用 SQL 查询文件

打开 `/Users/ruiwang/Desktop/test/sql_queries/cost_analysis.sql`，复制需要的查询，在 PostgreSQL 客户端中执行。

---

## 🐛 常见问题

### Q: 为什么数据库是空的？
**A:** 需要先通过网页生成至少一个报告。步骤：
1. 访问网页
2. 登录账号
3. 上传两个视频
4. 点击"生成分析报告"
5. 等待报告生成完成

### Q: 报告生成后是否需要点击"下载长图"才能保存到数据库？
**A:** 不需要！报告生成完成并显示在页面上时，数据已经自动保存到数据库了。

### Q: 如何确认数据已保存？
**A:** 运行查询：

```bash
./scripts/connect-db.sh -c "SELECT COUNT(*) as 报告数 FROM reports;"
```

### Q: 服务器日志中如何确认保存成功？
**A:** 生成报告后，在服务器日志中查找：

```
✅ 报告记录已保存到数据库
   报告ID: xxx-xxx-xxx
   学生姓名: 张小明
   生成时间: 2025-11-12 10:30:00
   总成本: ¥0.7450
```

---

## 🚀 下一步

1. **生成第一个报告**：通过网页上传视频并生成分析
2. **验证数据保存**：运行 `./scripts/connect-db.sh` 查看数据
3. **定期监控成本**：使用预设的 SQL 查询分析成本趋势

---

**最后更新**: 2025-11-12  
**作者**: AI 助手

