/**
 * 基于用户ID的限流中间件
 * 解决办公室场景下多用户共享IP的问题
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * 获取JWT密钥
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * 从请求中提取用户ID
 * 优先使用userId，如果无法获取则fallback到IP地址
 */
export function extractUserKey(req: Request): string {
  try {
    // 1. 从 cookie 或 Authorization header 获取 token
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // 2. 验证并解析 token
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; email: string };
      
      if (decoded.userId) {
        // 3. 返回 userId 作为限流键（添加前缀以区分IP和用户ID）
        return `user:${decoded.userId}`;
      }
    }
  } catch (error) {
    // Token 无效或过期，fallback 到 IP
    // 不需要记录错误，这是正常行为（未登录用户）
  }
  
  // 4. Fallback 到 IP 地址（添加前缀）
  return `ip:${req.ip}`;
}

/**
 * 全局限流：防止滥用（支持100并发）
 * 基于IP，因为包含登录等公开接口
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 2000, // 每个IP最多2000个请求（100并发 x 20请求/会话）
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
  // 使用IP作为key（默认行为）
});

/**
 * 分析接口专用限流：基于用户ID，支持真正的100并发
 * 每个用户独立限流，解决同一办公室多用户共享IP的问题
 */
export const analysisLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10分钟窗口
  max: 5, // 每个用户10分钟最多5次分析请求
  message: '您的分析请求过于频繁，请等待10分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // 即使成功也计数
  
  // 🔑 关键：使用用户ID作为限流键
  keyGenerator: (req) => {
    const key = extractUserKey(req);
    console.log(`🔑 Analysis Rate Limiter - Key: ${key}`);
    return key;
  },
  
  // 自定义错误处理，返回更友好的信息
  handler: (req: Request, res: Response) => {
    const userKey = extractUserKey(req);
    const isUser = userKey.startsWith('user:');
    
    res.status(429).json({
      success: false,
      error: isUser 
        ? '您的分析请求次数过多，请等待10分钟后再试'
        : '请求过于频繁，请登录后重试',
      retryAfter: Math.ceil(10 * 60), // 秒
      limit: 5,
      window: '10分钟',
      message: isUser
        ? '每个用户10分钟内最多可提交5次分析请求'
        : '未登录用户请先登录以获得独立的请求配额',
    });
  },
});

/**
 * 认证接口限流：防止暴力破解
 * 基于IP（因为用户还未登录）
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次登录尝试
  message: '登录尝试次数过多，请15分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
  // 使用IP作为key（默认行为）
  
  // 自定义错误处理
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: '登录尝试次数过多，请15分钟后再试',
      retryAfter: Math.ceil(15 * 60), // 秒
      limit: 5,
      window: '15分钟',
      message: '为了账户安全，同一IP地址15分钟内最多尝试5次登录',
    });
  },
});

/**
 * 可选：为特定路由提取限流信息的中间件
 * 用于调试和监控
 */
export function rateLimitInfo(req: Request, res: Response, next: NextFunction) {
  const userKey = extractUserKey(req);
  
  // 添加到请求对象，供后续中间件使用
  (req as any).rateLimitKey = userKey;
  (req as any).rateLimitType = userKey.startsWith('user:') ? 'user' : 'ip';
  
  next();
}

/**
 * 开发环境：禁用限流（可选）
 */
export function createDevelopmentLimiter() {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`⚠️  限流已禁用（开发模式）- Key: ${extractUserKey(req)}`);
    next();
  };
}

