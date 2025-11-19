import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 从 Authorization header 或 cookie 获取 token
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token && req.cookies) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }

    // 验证 token
    const decoded = jwt.verify(token, getJwtSecret()) as any;

    return res.status(200).json({
      user: {
        id: decoded.userId,
        email: decoded.email
      }
    });
  } catch (error: any) {
    console.error('验证 token 失败:', error);
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
}

