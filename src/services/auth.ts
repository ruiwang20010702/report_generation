// 自定义认证服务（使用阿里云 RDS PostgreSQL + 自建认证）
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    token?: string;
    user?: {
      id: string;
      email: string;
    };
  };
  error?: string;
}

/**
 * 发送邮箱验证码
 */
export const sendOtp = async (email: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '验证码发送失败');
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || '验证码发送失败，请重试');
  }
};

/**
 * 验证邮箱验证码并登录
 */
export const verifyOtp = async (email: string, otp: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '验证码验证失败');
    }

    // 保存 token 到 localStorage
    if (data.data?.token) {
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('user_email', email);
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || '验证码错误或已过期，请重试');
  }
};

/**
 * 使用邮箱和密码登录
 */
export const loginWithPassword = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '登录失败');
    }

    // 保存 token 到 localStorage
    if (data.data?.token) {
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('user_email', email);
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || '登录失败，请检查邮箱和密码');
  }
};

/**
 * 登出
 */
export const logout = async (): Promise<void> => {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
  }
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<AuthResponse> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('未登录');
    }

    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '获取用户信息失败');
    }

    return data;
  } catch (error: any) {
    // 如果获取失败，清除本地存储
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
    throw error;
  }
};

/**
 * 检查是否已登录
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('auth_token');
};

/**
 * 获取存储的 token
 */
export const getToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

