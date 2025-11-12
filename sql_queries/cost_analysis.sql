-- ============================================
-- 51Talk 视频分析系统 - 成本查询 SQL 集合
-- ============================================

-- 1. 查看所有用户的总花费排行
SELECT 
  u.email as 用户邮箱,
  COUNT(r.id) as 报告数量,
  ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 总花费元,
  ROUND(AVG((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 平均花费元,
  TO_CHAR(MIN(r.created_at), 'YYYY-MM-DD HH24:MI') as 首次使用时间,
  TO_CHAR(MAX(r.created_at), 'YYYY-MM-DD HH24:MI') as 最近使用时间
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
WHERE r.cost_breakdown IS NOT NULL
GROUP BY u.email
ORDER BY 总花费元 DESC;

-- ============================================

-- 2. 查看每个用户的每个学生花费明细
SELECT 
  u.email as 用户邮箱,
  r.analysis->>'studentName' as 学生姓名,
  COUNT(r.id) as 报告次数,
  ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 该学生总花费元,
  ROUND(AVG((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 平均单次花费元,
  TO_CHAR(MIN(r.created_at), 'YYYY-MM-DD HH24:MI') as 首次分析时间,
  TO_CHAR(MAX(r.created_at), 'YYYY-MM-DD HH24:MI') as 最近分析时间
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
WHERE r.cost_breakdown IS NOT NULL
GROUP BY u.email, r.analysis->>'studentName'
ORDER BY u.email, 该学生总花费元 DESC;

-- ============================================

-- 3. 查看最近50条报告的详细成本
SELECT 
  u.email as 用户邮箱,
  r.analysis->>'studentName' as 学生姓名,
  TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as 生成时间,
  ROUND((r.cost_breakdown->'transcription'->>'cost')::numeric, 4) as 转录成本元,
  ROUND((r.cost_breakdown->'transcription'->>'totalMinutes')::numeric, 2) as 转录分钟数,
  ROUND((r.cost_breakdown->'aiAnalysis'->>'totalCost')::numeric, 4) as AI分析成本元,
  (r.cost_breakdown->'aiAnalysis'->>'totalTokens')::integer as 使用Token数,
  ROUND((r.cost_breakdown->'total'->>'cost')::numeric, 4) as 总成本元
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
WHERE r.cost_breakdown IS NOT NULL
ORDER BY r.created_at DESC
LIMIT 50;

-- ============================================

-- 4. 按日期统计每日花费
SELECT 
  TO_CHAR(r.created_at, 'YYYY-MM-DD') as 日期,
  COUNT(r.id) as 报告数量,
  ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 当日总花费元,
  ROUND(AVG((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 平均单次花费元,
  COUNT(DISTINCT r.user_id) as 使用用户数,
  COUNT(DISTINCT r.analysis->>'studentName') as 分析学生数
FROM reports r
WHERE r.cost_breakdown IS NOT NULL
GROUP BY TO_CHAR(r.created_at, 'YYYY-MM-DD')
ORDER BY 日期 DESC;

-- ============================================

-- 5. 查找花费最高的前10个学生
SELECT 
  r.analysis->>'studentName' as 学生姓名,
  u.email as 所属用户,
  COUNT(r.id) as 分析次数,
  ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 总花费元,
  ROUND(AVG((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 平均花费元
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
WHERE r.cost_breakdown IS NOT NULL
GROUP BY r.analysis->>'studentName', u.email
ORDER BY 总花费元 DESC
LIMIT 10;

-- ============================================

-- 6. 成本结构分析（转录 vs AI）
SELECT 
  u.email as 用户邮箱,
  COUNT(r.id) as 报告数量,
  ROUND(SUM((r.cost_breakdown->'transcription'->>'cost')::numeric), 4) as 转录总成本元,
  ROUND(SUM((r.cost_breakdown->'aiAnalysis'->>'totalCost')::numeric), 4) as AI总成本元,
  ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 总成本元,
  ROUND(
    SUM((r.cost_breakdown->'transcription'->>'cost')::numeric) / 
    NULLIF(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 0) * 100, 
    2
  ) || '%' as 转录成本占比,
  ROUND(
    SUM((r.cost_breakdown->'aiAnalysis'->>'totalCost')::numeric) / 
    NULLIF(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 0) * 100, 
    2
  ) || '%' as AI成本占比
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
WHERE r.cost_breakdown IS NOT NULL
GROUP BY u.email
ORDER BY 总成本元 DESC;

-- ============================================

-- 7. 查看特定用户的所有学生花费（替换邮箱后使用）
-- SELECT 
--   r.analysis->>'studentName' as 学生姓名,
--   COUNT(r.id) as 分析次数,
--   ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 总花费元,
--   STRING_AGG(
--     TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI'), 
--     ', ' 
--     ORDER BY r.created_at DESC
--   ) as 分析时间列表
-- FROM reports r
-- LEFT JOIN users u ON r.user_id = u.id
-- WHERE u.email = 'your-email@51talk.com'  -- 替换为实际邮箱
--   AND r.cost_breakdown IS NOT NULL
-- GROUP BY r.analysis->>'studentName'
-- ORDER BY 总花费元 DESC;

-- ============================================

-- 8. 全局统计概览
SELECT 
  COUNT(DISTINCT r.user_id) as 总用户数,
  COUNT(DISTINCT r.analysis->>'studentName') as 总学生数,
  COUNT(r.id) as 总报告数,
  ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 总花费元,
  ROUND(AVG((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 平均单次花费元,
  ROUND(MIN((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 最低单次花费元,
  ROUND(MAX((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 最高单次花费元
FROM reports r
WHERE r.cost_breakdown IS NOT NULL;

-- ============================================

-- 9. 按周统计花费趋势
SELECT 
  TO_CHAR(DATE_TRUNC('week', r.created_at), 'YYYY-MM-DD') as 周开始日期,
  COUNT(r.id) as 报告数量,
  ROUND(SUM((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 周总花费元,
  ROUND(AVG((r.cost_breakdown->'total'->>'cost')::numeric), 4) as 平均花费元,
  COUNT(DISTINCT r.user_id) as 活跃用户数
FROM reports r
WHERE r.cost_breakdown IS NOT NULL
GROUP BY DATE_TRUNC('week', r.created_at)
ORDER BY 周开始日期 DESC;

-- ============================================

-- 10. 查看最近一次生成报告的成本详情
SELECT 
  u.email as 用户邮箱,
  r.analysis->>'studentName' as 学生姓名,
  TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as 生成时间,
  r.cost_breakdown->'transcription'->>'service' as 转录服务,
  ROUND((r.cost_breakdown->'transcription'->>'totalMinutes')::numeric, 2) as 转录分钟数,
  ROUND((r.cost_breakdown->'transcription'->>'cost')::numeric, 4) as 转录成本元,
  r.cost_breakdown->'aiAnalysis'->>'model' as AI模型,
  (r.cost_breakdown->'aiAnalysis'->>'totalTokens')::integer as 总Token数,
  ROUND((r.cost_breakdown->'aiAnalysis'->>'totalCost')::numeric, 4) as AI成本元,
  ROUND((r.cost_breakdown->'total'->>'cost')::numeric, 4) as 总成本元,
  r.cost_breakdown->'total'->>'breakdown' as 成本明细
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
WHERE r.cost_breakdown IS NOT NULL
ORDER BY r.created_at DESC
LIMIT 1;

