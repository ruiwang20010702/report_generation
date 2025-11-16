-- ============================================
-- 为 reports 表添加成本追踪字段
-- ============================================
-- 说明：在 Zeabur PostgreSQL Web Console 中执行此脚本
-- 用途：追踪每份报告的真实成本
-- ============================================

-- 添加成本追踪字段
ALTER TABLE reports ADD COLUMN IF NOT EXISTS cost_breakdown JSONB;

-- 添加索引以便快速查询成本统计
CREATE INDEX IF NOT EXISTS idx_reports_cost_breakdown ON reports USING GIN (cost_breakdown);

-- 添加注释
COMMENT ON COLUMN reports.cost_breakdown IS '成本详细信息（JSON格式）：包含转录成本、AI分析成本、总成本等';

-- ============================================
-- cost_breakdown 字段结构示例
-- ============================================
-- {
--   "transcription": {
--     "service": "tingwu",           // 使用的转录服务
--     "video1Duration": 300,          // 视频1时长（秒）
--     "video2Duration": 350,          // 视频2时长（秒）
--     "totalMinutes": 11,             // 总转录时长（分钟，向上取整）
--     "unitPrice": 0.01,              // 单价（元/分钟）
--     "cost": 0.11,                   // 转录成本（元）
--     "currency": "CNY"               // 货币单位
--   },
--   "aiAnalysis": {
--     "provider": "GLM",              // AI提供商
--     "model": "glm-4-plus",          // 使用的模型
--     "video1Analysis": {
--       "promptTokens": 1500,         // 输入token数
--       "completionTokens": 2000,     // 输出token数
--       "totalTokens": 3500,          // 总token数
--       "cost": 0.175                 // 成本（元）
--     },
--     "video2Analysis": {
--       "promptTokens": 1600,
--       "completionTokens": 2100,
--       "totalTokens": 3700,
--       "cost": 0.185
--     },
--     "comparison": {
--       "promptTokens": 3000,
--       "completionTokens": 2500,
--       "totalTokens": 5500,
--       "cost": 0.275
--     },
--     "totalTokens": 12700,           // 总token数
--     "totalCost": 0.635,             // AI分析总成本（元）
--     "currency": "CNY"               // 货币单位
--   },
--   "total": {
--     "cost": 0.745,                  // 总成本（元）
--     "currency": "CNY",              // 货币单位
--     "breakdown": "转录: ¥0.11 + AI分析: ¥0.64"
--   },
--   "timestamp": "2025-11-12T10:30:00Z"  // 成本计算时间
-- }

-- ============================================
-- 查询示例
-- ============================================

-- 1. 查看最近10份报告的成本
-- SELECT 
--   id,
--   created_at,
--   cost_breakdown->>'total' as total_cost,
--   cost_breakdown->'transcription'->>'totalMinutes' as transcription_minutes,
--   cost_breakdown->'aiAnalysis'->>'totalTokens' as ai_tokens
-- FROM reports 
-- WHERE cost_breakdown IS NOT NULL
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- 2. 统计总成本
-- SELECT 
--   COUNT(*) as report_count,
--   SUM((cost_breakdown->'total'->>'cost')::numeric) as total_cost_cny,
--   AVG((cost_breakdown->'total'->>'cost')::numeric) as avg_cost_per_report,
--   SUM((cost_breakdown->'transcription'->>'totalMinutes')::numeric) as total_transcription_minutes,
--   SUM((cost_breakdown->'aiAnalysis'->>'totalTokens')::numeric) as total_ai_tokens
-- FROM reports
-- WHERE cost_breakdown IS NOT NULL;

-- 3. 按日期统计成本
-- SELECT 
--   DATE(created_at) as date,
--   COUNT(*) as report_count,
--   SUM((cost_breakdown->'total'->>'cost')::numeric) as daily_cost,
--   SUM((cost_breakdown->'transcription'->>'totalMinutes')::numeric) as daily_minutes
-- FROM reports
-- WHERE cost_breakdown IS NOT NULL
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC
-- LIMIT 30;

-- 4. 按用户统计成本
-- SELECT 
--   user_id,
--   COUNT(*) as report_count,
--   SUM((cost_breakdown->'total'->>'cost')::numeric) as total_cost,
--   AVG((cost_breakdown->'total'->>'cost')::numeric) as avg_cost
-- FROM reports
-- WHERE cost_breakdown IS NOT NULL
-- GROUP BY user_id
-- ORDER BY total_cost DESC;

