-- =====================================================
-- 迁移脚本：添加 report_cost 和 interpretation_cost 字段
-- 将原来的 total_cost 拆分为两部分，total_cost 改为自动计算
-- =====================================================

-- 1. 添加新字段
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS report_cost DECIMAL(10, 4);

ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS interpretation_cost DECIMAL(10, 4);

-- 2. 迁移现有数据：将原 total_cost 值复制到 report_cost
-- 因为现有记录的 total_cost 主要是报告生成成本
UPDATE reports 
SET report_cost = total_cost 
WHERE total_cost IS NOT NULL AND report_cost IS NULL;

-- 3. 从 cost_detail 中提取 interpretation 成本（如果存在）
UPDATE reports 
SET interpretation_cost = (cost_detail->'interpretation'->>'cost')::numeric
WHERE cost_detail->'interpretation' IS NOT NULL 
  AND cost_detail->'interpretation'->>'cost' IS NOT NULL
  AND interpretation_cost IS NULL;

-- 4. 如果有 interpretation_cost，需要从 report_cost 中减去
-- 因为原来的 total_cost 可能已经包含了 interpretation 成本
UPDATE reports 
SET report_cost = report_cost - COALESCE(interpretation_cost, 0)
WHERE interpretation_cost IS NOT NULL 
  AND report_cost IS NOT NULL
  AND report_cost > interpretation_cost;

-- 5. 删除原来的 total_cost 列（需要先删除依赖它的索引）
DROP INDEX IF EXISTS idx_reports_total_cost;

-- 6. 删除旧的 total_cost 列
ALTER TABLE reports DROP COLUMN IF EXISTS total_cost;

-- 7. 添加新的 total_cost 计算列
ALTER TABLE reports 
ADD COLUMN total_cost DECIMAL(10, 4) 
GENERATED ALWAYS AS (COALESCE(report_cost, 0) + COALESCE(interpretation_cost, 0)) STORED;

-- 8. 重新创建 total_cost 索引
CREATE INDEX IF NOT EXISTS idx_reports_total_cost ON reports(total_cost);

-- 9. 添加字段注释
COMMENT ON COLUMN reports.report_cost IS '报告生成成本（转录+AI分析，单位：元）';
COMMENT ON COLUMN reports.interpretation_cost IS '解读版生成成本（单位：元）';
COMMENT ON COLUMN reports.total_cost IS '总成本（report_cost + interpretation_cost，自动计算）';

-- 验证迁移结果
SELECT 
    COUNT(*) as total_records,
    COUNT(report_cost) as records_with_report_cost,
    COUNT(interpretation_cost) as records_with_interpretation_cost,
    SUM(report_cost) as total_report_cost,
    SUM(interpretation_cost) as total_interpretation_cost,
    SUM(total_cost) as total_cost_sum
FROM reports;

