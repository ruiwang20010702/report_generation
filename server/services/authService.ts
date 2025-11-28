import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { sendVerificationEmail } from './emailService.js';

const OTP_EXPIRY = 10 * 60 * 1000; // 10分钟（毫秒）
const OTP_LENGTH = 6;
const ALLOWED_EMAIL_DOMAIN = '@51talk.com'; // 允许的邮箱域名

/**
 * 获取 JWT Secret（运行时读取环境变量）
 * 如果未设置，抛出错误以确保安全性
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Please configure it in your .env file.');
  }
  return secret;
}

/**
 * 验证邮箱域名是否为 @51talk.com
 */
function validateEmailDomain(email: string): boolean {
  return email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

/**
 * 生成6位数字验证码
 */
function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * 发送邮箱验证码
 * 验证码仅通过邮件发送，不会返回给前端
 */
export async function sendOtp(email: string): Promise<void> {
  // 验证邮箱域名
  if (!validateEmailDomain(email)) {
    throw new Error('只允许使用 @51talk.com 邮箱注册和登录');
  }

  // 清理过期的验证码（可选，也可以定期清理）
  try {
    await query(
      'DELETE FROM otps WHERE expires_at < NOW() - INTERVAL \'1 day\''
    );
  } catch (error) {
    // 忽略清理错误，不影响主流程
    console.warn('清理过期验证码失败:', error);
  }

  // 生成验证码
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY);

  // 将之前的验证码标记为已使用（同一邮箱只能有一个有效验证码）
  try {
    await query(
      'UPDATE otps SET used = TRUE, used_at = NOW() WHERE email = $1 AND used = FALSE',
      [email]
    );
  } catch (error) {
    console.warn('更新旧验证码状态失败:', error);
  }

  // 存储验证码到数据库
  try {
    await query(
      `INSERT INTO otps (email, code, expires_at) 
       VALUES ($1, $2, $3)`,
      [email, code, expiresAt.toISOString()]
    );
  } catch (error: any) {
    console.error('保存验证码失败:', error);
    throw new Error('发送验证码失败，请稍后重试');
  }

  // 发送验证码邮件
    await sendVerificationEmail(email, code);
}

/**
 * 验证邮箱验证码
 */
export async function verifyOtp(email: string, otp: string): Promise<{ token: string; user: { id: string; email: string } }> {
  // 验证邮箱域名
  if (!validateEmailDomain(email)) {
    throw new Error('只允许使用 @51talk.com 邮箱注册和登录');
  }

  // 从数据库查找有效的验证码
  const result = await query(
    `SELECT id, code, expires_at, used 
     FROM otps 
     WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, otp]
  );

  if (result.rows.length === 0) {
    throw new Error('验证码不存在、已过期或已使用');
  }

  const stored = result.rows[0];

  // 验证码已过期（双重检查）
  if (new Date(stored.expires_at) < new Date()) {
    throw new Error('验证码已过期，请重新获取');
  }

  // 标记验证码为已使用
  await query(
    'UPDATE otps SET used = TRUE, used_at = NOW() WHERE id = $1',
    [stored.id]
  );

  // 查找或创建用户
  let userResult = await query(
    'SELECT id, email FROM users WHERE email = $1',
    [email]
  );

  let user;
  if (userResult.rows.length === 0) {
    // 创建新用户
    const userId = crypto.randomUUID();
    const insertResult = await query(
      'INSERT INTO users (id, email) VALUES ($1, $2) RETURNING id, email',
      [userId, email]
    );
    user = insertResult.rows[0];
  } else {
    user = userResult.rows[0];
  }

  // 生成 JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    getJwtSecret(),
    {
      expiresIn: '7d', // 7天
    }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

/**
 * 使用邮箱和密码登录
 */
export async function loginWithPassword(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
  // 验证邮箱域名
  if (!validateEmailDomain(email)) {
    throw new Error('只允许使用 @51talk.com 邮箱注册和登录');
  }

  // 查找用户
  const result = await query(
    'SELECT id, email, passwd_hash FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('用户不存在');
  }

  const user = result.rows[0];

  // 检查用户是否设置了密码
  if (!user.passwd_hash) {
    throw new Error('该账户尚未设置密码，请使用验证码登录');
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.passwd_hash);
  if (!isPasswordValid) {
    throw new Error('密码错误');
  }

  // 生成 JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    getJwtSecret(),
    {
      expiresIn: '7d', // 7天
    }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

/**
 * 设置用户密码（仅限已认证用户修改自己的密码）
 * @param userId - 已认证用户的ID（从JWT中获取）
 * @param password - 新密码
 */
export async function setPassword(userId: string, password: string): Promise<void> {
  // 查找用户
  const result = await query(
    'SELECT id, email FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('用户不存在');
  }

  // 加密密码
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // 更新密码
  await query(
    'UPDATE users SET passwd_hash = $1 WHERE id = $2',
    [hashedPassword, userId]
  );
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(token: string): Promise<{ user: { id: string; email: string } }> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; email: string };
    
    // 从数据库查找用户
    const result = await query(
      'SELECT id, email FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('用户不存在');
    }

    const user = result.rows[0];

    return {
      user: {
        id: user.id,
        email: user.email,
      },
    };
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new Error('Token 无效或已过期');
    }
    throw error;
  }
}

