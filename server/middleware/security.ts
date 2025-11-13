/**
 * 安全中间件
 * 提供 HTTP 安全头、输入验证、XSS 防护等功能
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorType } from '../utils/errors.js';

/**
 * 安全响应头中间件
 * 添加各种安全相关的 HTTP 响应头
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // 防止点击劫持攻击
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 防止 MIME 类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 启用浏览器 XSS 过滤器
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 严格传输安全（HTTPS）- 仅在生产环境启用
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // 内容安全策略（CSP）
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com", // 允许内联脚本和第三方CDN（用于开发）
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // 允许内联样式和字体
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:", // 允许图片从各种来源加载
    "connect-src 'self' https://api.openai.com https://*.aliyuncs.com https://*.sentry.io", // 允许API连接
    "frame-ancestors 'none'", // 防止被嵌入iframe
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests" // 自动升级HTTP到HTTPS（生产环境）
  ];
  
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // 权限策略（Permissions Policy）- 限制浏览器功能
  const permissionsPolicy = [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ];
  res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));
  
  // 引用策略 - 控制Referer头信息
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

/**
 * 请求大小验证中间件
 * 防止过大的请求导致服务器资源耗尽
 */
export function validateRequestSize(maxSizeMB: number = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        return next(new AppError(
          ErrorType.VALIDATION_ERROR,
          `Request body too large: ${sizeMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`,
          {
            userMessage: `请求体过大，最大允许 ${maxSizeMB}MB`,
            context: { sizeMB: sizeMB.toFixed(2), maxSizeMB }
          }
        ));
      }
    }
    
    next();
  };
}

/**
 * URL 参数验证 - 防止路径遍历攻击
 */
export function sanitizePathParams(req: Request, res: Response, next: NextFunction) {
  const dangerousPatterns = [
    /\.\./g,  // 路径遍历
    /[<>]/g,  // HTML标签
    /[\x00-\x1f\x7f]/g,  // 控制字符
  ];
  
  // 检查所有路径参数
  for (const [key, value] of Object.entries(req.params)) {
    if (typeof value === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          return next(new AppError(
            ErrorType.VALIDATION_ERROR,
            `Invalid path parameter: ${key}`,
            {
              userMessage: '请求参数包含非法字符',
              context: { parameter: key }
            }
          ));
        }
      }
    }
  }
  
  next();
}

/**
 * 输入清理 - 移除潜在的 XSS 攻击向量
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // 移除或转义潜在的危险字符
    return input
      .replace(/[<>]/g, '') // 移除尖括号
      .replace(/javascript:/gi, '') // 移除javascript:协议
      .replace(/on\w+\s*=/gi, '') // 移除事件处理器
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  
  if (input !== null && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * 请求体清理中间件
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  
  next();
}

/**
 * 文件上传验证
 */
export interface FileValidationOptions {
  allowedMimeTypes?: string[];
  maxSizeMB?: number;
  allowedExtensions?: string[];
}

export function validateFileUpload(options: FileValidationOptions = {}) {
  const {
    allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'video/quicktime'],
    maxSizeMB = 100,
    allowedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.mov']
  } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    // 这里假设使用 multer 或类似的文件上传中间件
    const file = (req as any).file;
    
    if (!file) {
      return next();
    }
    
    // 验证文件大小
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return next(new AppError(
        ErrorType.VALIDATION_ERROR,
        `File too large: ${sizeMB.toFixed(2)}MB`,
        {
          userMessage: `文件过大，最大允许 ${maxSizeMB}MB`,
          context: { sizeMB: sizeMB.toFixed(2), maxSizeMB }
        }
      ));
    }
    
    // 验证 MIME 类型
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return next(new AppError(
        ErrorType.VALIDATION_ERROR,
        `Invalid file type: ${file.mimetype}`,
        {
          userMessage: '不支持的文件类型',
          context: { mimetype: file.mimetype, allowed: allowedMimeTypes }
        }
      ));
    }
    
    // 验证文件扩展名
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      return next(new AppError(
        ErrorType.VALIDATION_ERROR,
        `Invalid file extension: ${ext}`,
        {
          userMessage: '不支持的文件扩展名',
          context: { extension: ext, allowed: allowedExtensions }
        }
      ));
    }
    
    next();
  };
}

/**
 * API Key 验证中间件（可选）
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.API_KEY;
  
  // 如果没有配置 API_KEY，则跳过验证
  if (!expectedApiKey) {
    return next();
  }
  
  // 验证 API Key
  if (!apiKey || apiKey !== expectedApiKey) {
    return next(new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      'Invalid or missing API key',
      {
        userMessage: 'API密钥无效或缺失',
        context: { hasApiKey: !!apiKey }
      }
    ));
  }
  
  next();
}

/**
 * IP 白名单验证（可选）
 */
export function validateIpWhitelist(req: Request, res: Response, next: NextFunction) {
  const whitelist = process.env.IP_WHITELIST;
  
  // 如果没有配置白名单，则跳过验证
  if (!whitelist) {
    return next();
  }
  
  const allowedIps = whitelist.split(',').map(ip => ip.trim());
  const clientIp = req.ip || req.socket.remoteAddress || '';
  
  // 检查是否在白名单中
  const isAllowed = allowedIps.some(allowedIp => {
    if (allowedIp === '*') return true;
    if (allowedIp.endsWith('*')) {
      // 支持通配符，如 192.168.1.*
      const prefix = allowedIp.slice(0, -1);
      return clientIp.startsWith(prefix);
    }
    return clientIp === allowedIp;
  });
  
  if (!isAllowed) {
    return next(new AppError(
      ErrorType.AUTHORIZATION_ERROR,
      'IP address not whitelisted',
      {
        userMessage: 'IP地址未授权',
        context: { clientIp }
      }
    ));
  }
  
  next();
}

/**
 * SQL 注入防护 - 检测常见的 SQL 注入模式
 */
export function detectSqlInjection(req: Request, res: Response, next: NextFunction) {
  const sqlPatterns = [
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(\bSELECT\b.*\bFROM\b)/gi,
    /(\bINSERT\b.*\bINTO\b)/gi,
    /(\bDELETE\b.*\bFROM\b)/gi,
    /(\bUPDATE\b.*\bSET\b)/gi,
    /(\bDROP\b.*\bTABLE\b)/gi,
    /(--|\#|\/\*|\*\/)/g, // SQL注释
    /('|"|`|;)/g, // SQL特殊字符
  ];
  
  // 检查所有输入
  const checkForSqlInjection = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      // 对于字符串，检查是否包含 SQL 注入模式
      for (const pattern of sqlPatterns) {
        if (pattern.test(obj)) {
          console.warn(`[Security] Potential SQL injection detected at ${path}: ${obj.substring(0, 100)}`);
          return true;
        }
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (checkForSqlInjection(obj[i], `${path}[${i}]`)) {
          return true;
        }
      }
    } else if (obj !== null && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForSqlInjection(value, path ? `${path}.${key}` : key)) {
          return true;
        }
      }
    }
    return false;
  };
  
  // 检查请求体和查询参数
  if (checkForSqlInjection(req.body, 'body') || checkForSqlInjection(req.query, 'query')) {
    return next(new AppError(
      ErrorType.VALIDATION_ERROR,
      'Potential SQL injection detected',
      {
        userMessage: '检测到潜在的安全威胁，请求已被拒绝',
        context: { reason: 'sql_injection_pattern_detected' }
      }
    ));
  }
  
  next();
}

/**
 * 慢速攻击防护 - 检测异常慢的请求
 */
export function slowlorisProtection(timeoutSeconds: number = 30) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      console.warn(`[Security] Slow request detected: ${req.method} ${req.path} from ${req.ip}`);
      res.status(408).json({
        error: '请求超时',
        message: 'Request timeout - connection too slow'
      });
    }, timeoutSeconds * 1000);
    
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
}

/**
 * 组合安全中间件 - 一键启用所有安全措施
 */
export function enableAllSecurityMiddleware() {
  return [
    securityHeaders,
    sanitizePathParams,
    sanitizeRequestBody,
    detectSqlInjection,
    slowlorisProtection(30),
  ];
}

