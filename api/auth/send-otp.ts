import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendOtp } from '../../server/services/authService.js';

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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '请提供邮箱地址' });
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    const result = await sendOtp(email);
    
    // 在生产环境不返回验证码
    if (process.env.NODE_ENV === 'production') {
      return res.status(200).json({ 
        message: '验证码已发送到您的邮箱',
        email 
      });
    }

    // 开发环境返回验证码（方便测试）
    return res.status(200).json({ 
      message: '验证码已发送',
      code: result.code,
      email 
    });
  } catch (error: any) {
    console.error('发送验证码失败:', error);
    return res.status(500).json({ 
      error: error.message || '发送验证码失败，请稍后重试' 
    });
  }
}

