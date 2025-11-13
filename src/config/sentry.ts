/**
 * Sentry 配置文件 - 前端错误追踪
 * 
 * 使用说明：
 * 1. 在 Sentry.io 创建项目并获取 DSN
 * 2. 在环境变量中设置 VITE_SENTRY_DSN
 * 3. 可选：设置 VITE_SENTRY_ENVIRONMENT
 */

import * as Sentry from '@sentry/react';

/**
 * 初始化 Sentry
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  // 如果没有配置 DSN，跳过初始化
  if (!dsn) {
    console.log('⚠️  Sentry DSN 未配置，错误追踪已禁用');
    console.log('💡 设置 VITE_SENTRY_DSN 环境变量以启用 Sentry 错误追踪');
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development',
      
      // 集成配置
      integrations: [
        // React Router v6 浏览器追踪（新版本API）
        Sentry.reactRouterV6BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),
        // React 错误边界
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // 性能监控采样率
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
      
      // 会话重放采样率（仅在错误发生时）
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      
      // 发布版本
      release: import.meta.env.VITE_APP_VERSION || '2.0.0',
      
      // 忽略的错误
      ignoreErrors: [
        // 网络错误（通常是用户网络问题）
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'ECONNREFUSED',
        // 浏览器扩展引起的错误
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // 非关键的 React 错误
        'Non-Error promise rejection captured',
      ],
      
      // 在发送前处理错误
      beforeSend(event, hint) {
        const error = hint.originalException;
        
        // 过滤掉用户取消的请求
        if (error && error instanceof Error && error.message.includes('cancel')) {
          return null;
        }
        
        // 移除敏感信息
        if (event.request && event.request.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['Cookie'];
        }
        
        return event;
      },
    });

    console.log('✅ Sentry 前端错误追踪已启用');
    
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
 * 添加面包屑
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

// 导出必要的 React Router 依赖
import React from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';

export { Sentry };

