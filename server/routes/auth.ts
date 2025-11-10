import { Router, Request, Response } from 'express';
import { sendOtp, verifyOtp, getCurrentUser, loginWithPassword, setPassword } from '../services/authService.js';

const router = Router();

/**
 * 发送邮箱验证码
 * POST /api/auth/send-otp
 */
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: '请输入有效的邮箱地址',
      });
    }

    const result = await sendOtp(email);

    res.json({
      success: true,
      message: '验证码已发送',
      data: result,
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '验证码发送失败，请重试',
    });
  }
});

/**
 * 验证邮箱验证码并登录
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: '请输入有效的邮箱地址',
      });
    }

    if (!otp || otp.length !== 6) {
      return res.status(400).json({
        success: false,
        error: '请输入6位验证码',
      });
    }

    const result = await verifyOtp(email, otp);

    // 设置 HTTP-only cookie
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    res.status(401).json({
      success: false,
      error: error.message || '验证码错误或已过期，请重试',
    });
  }
});

/**
 * 使用邮箱和密码登录
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: '请输入有效的邮箱地址',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少为6位',
      });
    }

    const result = await loginWithPassword(email, password);

    // 设置 HTTP-only cookie
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || '登录失败，请检查邮箱和密码',
    });
  }
});

/**
 * 设置密码（用于首次设置或修改密码）
 * POST /api/auth/set-password
 */
router.post('/set-password', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: '请输入有效的邮箱地址',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少为6位',
      });
    }

    await setPassword(email, password);

    res.json({
      success: true,
      message: '密码设置成功',
    });
  } catch (error: any) {
    console.error('Set password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || '密码设置失败',
    });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const result = await getCurrentUser(token);

    res.json({
      success: true,
      data: {
        user: result.user,
      },
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    res.status(401).json({
      success: false,
      error: error.message || '获取用户信息失败',
    });
  }
});

/**
 * 登出
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    res.clearCookie('auth_token');
    res.json({
      success: true,
      message: '登出成功',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: '登出失败',
    });
  }
});

export default router;

