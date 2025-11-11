-- 创建 OTP（验证码）表
CREATE TABLE IF NOT EXISTS otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(code);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_used ON otps(used);

-- 创建复合索引用于快速查找有效的验证码
-- 注意：不能使用 NOW() 在索引的 WHERE 子句中，因为 NOW() 不是 IMMUTABLE
-- 使用复合索引来优化查询，查询时需要在 WHERE 子句中显式指定 expires_at 条件
CREATE INDEX IF NOT EXISTS idx_otps_email_code_used ON otps(email, code, used);

-- 创建清理过期验证码的函数（可选，用于定期清理）
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM otps 
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 注释
COMMENT ON TABLE otps IS '邮箱验证码表';
COMMENT ON COLUMN otps.id IS '验证码唯一标识符';
COMMENT ON COLUMN otps.email IS '用户邮箱';
COMMENT ON COLUMN otps.code IS '验证码（6位数字）';
COMMENT ON COLUMN otps.expires_at IS '验证码过期时间';
COMMENT ON COLUMN otps.created_at IS '验证码创建时间';
COMMENT ON COLUMN otps.used IS '是否已使用';
COMMENT ON COLUMN otps.used_at IS '使用时间';

