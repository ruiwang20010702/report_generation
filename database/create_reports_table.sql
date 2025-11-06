-- 创建 reports 表
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  student_name TEXT NOT NULL,
  audio_duration INTEGER NOT NULL,
  transcript TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_student_name ON reports(student_name);

-- 启用 Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取报告
CREATE POLICY "Enable read access for all users" ON reports
  FOR SELECT USING (true);

-- 创建策略：允许所有人插入报告
CREATE POLICY "Enable insert access for all users" ON reports
  FOR INSERT WITH CHECK (true);

-- 注释
COMMENT ON TABLE reports IS '51Talk 课程音频分析报告';
COMMENT ON COLUMN reports.id IS '报告唯一标识符';
COMMENT ON COLUMN reports.created_at IS '报告创建时间';
COMMENT ON COLUMN reports.student_name IS '学生姓名';
COMMENT ON COLUMN reports.audio_duration IS '音频时长（秒）';
COMMENT ON COLUMN reports.transcript IS '完整转录文本';
COMMENT ON COLUMN reports.analysis_data IS '分析结果（JSON格式）';
COMMENT ON COLUMN reports.file_name IS '原始音频文件名';
COMMENT ON COLUMN reports.file_url IS '音频文件 URL（可选）';

