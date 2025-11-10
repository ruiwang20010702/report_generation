import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyOtp } from '../../server/services/authService.js';

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
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: '请提供邮箱和验证码' });
    }

    const result = await verifyOtp(email, otp);

    // 设置 cookie（可选，也可以只返回 token 让前端存储）
    res.setHeader('Set-Cookie', `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);

    return res.status(200).json({
      message: '登录成功',
      token: result.token,
      user: result.user
    });
  } catch (error: any) {
    console.error('验证失败:', error);
    return res.status(401).json({ 
      error: error.message || '验证失败，请重试' 
    });
  }
}

