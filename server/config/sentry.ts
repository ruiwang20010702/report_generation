/**
 * Sentry 配置文件 - 后端错误追踪
 * 
 * 使用说明：
 * 1. 在 Sentry.io 创建项目并获取 DSN
 * 2. 在环境变量中设置 SENTRY_DSN
 * 3. 可选：设置 SENTRY_ENVIRONMENT (production/staging/development)
 */

import * as Sentry from '@sentry/node';

/**
 * 初始化 Sentry
 * 仅在生产环境或明确启用时才初始化
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  // 如果没有配置 DSN，跳过初始化
  if (!dsn) {
    console.log('⚠️  Sentry DSN 未配置，错误追踪已禁用');
    console.log('💡 设置 SENTRY_DSN 环境变量以启用 Sentry 错误追踪');
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      
      // 性能监控采样率（0.0 到 1.0）
      // 生产环境建议 0.1-0.2，开发环境可以 1.0
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // 发布版本（用于追踪特定版本的错误）
      release: process.env.npm_package_version || '2.0.0',
      
      // 错误采样（发送所有错误）
      sampleRate: 1.0,
      
      // 集成配置（新版本 Sentry 会自动包含必要的集成）
      integrations: [],
      
      // 忽略的错误类型
      ignoreErrors: [
        // 常见的客户端断开连接错误
        'ECONNRESET',
        'EPIPE',
        'ECANCELED',
        // Rate limiting 错误（这是预期的行为）
        'Too many requests',
      ],
      
      // 在发送前处理错误
      beforeSend(event, hint) {
        const error = hint.originalException;
        
        // 不发送 Mock 模式的错误（开发/测试）
        if (error && typeof error === 'object' && 'message' in error) {
          const message = String(error.message);
          if (message.includes('Mock') || message.includes('模拟')) {
            return null;
          }
        }
        
        // 移除敏感信息
        if (event.request) {
          // 移除可能包含敏感信息的 headers
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
          
          // 移除查询参数中的敏感信息
          if (event.request.query_string && typeof event.request.query_string === 'string') {
            const sanitized = event.request.query_string
              .replace(/apiKey=[^&]+/gi, 'apiKey=REDACTED')
              .replace(/api_key=[^&]+/gi, 'api_key=REDACTED')
              .replace(/password=[^&]+/gi, 'password=REDACTED');
            event.request.query_string = sanitized;
          }
        }
        
        return event;
      },
    });

    console.log('✅ Sentry 错误追踪已启用');
    console.log(`   环境: ${process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'}`);
    console.log(`   采样率: ${process.env.NODE_ENV === 'production' ? '10%' : '100%'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Sentry 初始化失败:', error);
    return false;
  }
}

/**
 * 手动捕获错误
 */
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * 添加面包屑（用于追踪用户操作路径）
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * 设置用户上下文
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user);
}

/**
 * 清除用户上下文
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Express 错误处理中间件
 * 必须在所有路由之后、错误处理器之前添加
 */
export function sentryErrorHandler(error: any, req: any, res: any, next: any) {
  // 捕获所有 5xx 错误
  if (error && 'statusCode' in error) {
    const statusCode = error.statusCode;
    if (statusCode >= 500) {
      Sentry.captureException(error);
    }
  } else {
    Sentry.captureException(error);
  }
  next(error);
}

/**
 * Express 请求处理中间件
 * 必须在所有路由之前添加
 */
export function sentryRequestHandler(req: any, res: any, next: any) {
  // 设置请求上下文
  Sentry.setContext('request', {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });
  next();
}

/**
 * Express 追踪中间件
 * 用于性能监控
 */
export function sentryTracingHandler(req: any, res: any, next: any) {
  // 新版本 Sentry 会自动处理追踪
  next();
}

export { Sentry };

