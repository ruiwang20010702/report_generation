/**
 * 结构化日志中间件
 * 提供 requestId 追踪、性能监控、关键操作记录
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// 扩展 Express Request 类型以包含 requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * 日志条目接口
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  type: string;
  message: string;
  duration?: number;
  [key: string]: any;
}

/**
 * 结构化日志器类
 */
class StructuredLogger {
  private isDevelopment: boolean;
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }
  
  /**
   * 格式化日志输出
   */
  private formatLog(entry: LogEntry): string {
    if (this.isDevelopment) {
      // 开发环境：人类可读格式
      const { timestamp, level, requestId, type, message, duration, ...rest } = entry;
      let output = `[${timestamp}] [${level.toUpperCase()}]`;
      
      if (requestId) {
        output += ` [${requestId.substring(0, 8)}]`;
      }
      
      output += ` [${type}] ${message}`;
      
      if (duration !== undefined) {
        output += ` (${duration}ms)`;
      }
      
      // 添加额外的上下文信息
      if (Object.keys(rest).length > 0) {
        output += ` ${JSON.stringify(rest)}`;
      }
      
      return output;
    } else {
      // 生产环境：JSON格式（便于日志聚合系统解析）
      return JSON.stringify(entry);
    }
  }
  
  /**
   * 通用日志方法
   */
  private log(level: LogLevel, type: string, message: string, context?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      ...context,
    };
    
    const formatted = this.formatLog(entry);
    
    // 根据日志级别选择输出方式
    switch (level) {
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
  
  debug(type: string, message: string, context?: any) {
    this.log(LogLevel.DEBUG, type, message, context);
  }
  
  info(type: string, message: string, context?: any) {
    this.log(LogLevel.INFO, type, message, context);
  }
  
  warn(type: string, message: string, context?: any) {
    this.log(LogLevel.WARN, type, message, context);
  }
  
  error(type: string, message: string, context?: any) {
    this.log(LogLevel.ERROR, type, message, context);
  }
  
  critical(type: string, message: string, context?: any) {
    this.log(LogLevel.CRITICAL, type, message, context);
  }
  
  /**
   * HTTP 请求日志
   */
  httpRequest(req: Request, additionalContext?: any) {
    this.info('http_request', `${req.method} ${req.path}`, {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      ...additionalContext,
    });
  }
  
  /**
   * HTTP 响应日志
   */
  httpResponse(req: Request, res: Response, duration: number, additionalContext?: any) {
    const level = res.statusCode >= 500 ? LogLevel.ERROR 
                : res.statusCode >= 400 ? LogLevel.WARN 
                : LogLevel.INFO;
    
    this.log(level, 'http_response', `${req.method} ${req.path} ${res.statusCode}`, {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip || req.socket.remoteAddress,
      ...additionalContext,
    });
  }
  
  /**
   * 数据库操作日志
   */
  database(operation: string, query: string, duration?: number, context?: any) {
    this.info('database', `${operation}: ${query.substring(0, 100)}`, {
      operation,
      query: query.substring(0, 200),
      duration,
      ...context,
    });
  }
  
  /**
   * 外部 API 调用日志
   */
  externalApi(service: string, endpoint: string, duration?: number, context?: any) {
    this.info('external_api', `${service}: ${endpoint}`, {
      service,
      endpoint,
      duration,
      ...context,
    });
  }
  
  /**
   * 业务操作日志
   */
  business(operation: string, message: string, context?: any) {
    this.info('business', `${operation}: ${message}`, {
      operation,
      ...context,
    });
  }
  
  /**
   * 安全事件日志
   */
  security(event: string, message: string, context?: any) {
    this.warn('security', `${event}: ${message}`, {
      event,
      ...context,
    });
  }
}

// 导出单例
export const logger = new StructuredLogger();

/**
 * RequestId 中间件
 * 为每个请求生成唯一的 requestId，用于追踪整个请求链路
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // 从请求头获取或生成新的 requestId
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = Date.now();
  
  // 将 requestId 添加到响应头
  res.setHeader('X-Request-Id', req.requestId);
  
  next();
}

/**
 * HTTP 请求日志中间件
 */
export function httpLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  // 记录请求开始
  logger.httpRequest(req);
  
  // 记录响应完成
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    logger.httpResponse(req, res, duration);
  });
  
  next();
}

/**
 * 慢请求检测中间件
 */
export function slowRequestDetection(thresholdMs: number = 3000) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      const duration = req.startTime ? Date.now() - req.startTime : 0;
      
      if (duration > thresholdMs) {
        logger.warn('slow_request', `Slow request detected: ${req.method} ${req.path}`, {
          requestId: req.requestId,
          duration,
          threshold: thresholdMs,
          method: req.method,
          path: req.path,
        });
      }
    });
    
    next();
  };
}

/**
 * 业务操作日志装饰器
 * 用于包装业务函数，自动记录执行时间和结果
 */
export function logBusinessOperation<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    const requestId = (args[0] as any)?.requestId || 'unknown';
    
    try {
      logger.business(operation, 'Started', { requestId });
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      logger.business(operation, 'Completed', { 
        requestId, 
        duration,
        success: true 
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('business', `${operation} failed`, {
        requestId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
      
      throw error;
    }
  }) as T;
}

/**
 * 数据库查询日志包装器
 */
export async function logDatabaseQuery<T>(
  operation: string,
  query: string,
  executor: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await executor();
    const duration = Date.now() - startTime;
    
    logger.database(operation, query, duration, { success: true });
    
    // 慢查询告警
    if (duration > 1000) {
      logger.warn('slow_query', `Slow database query detected`, {
        operation,
        query: query.substring(0, 200),
        duration,
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('database', `${operation} failed`, {
      query: query.substring(0, 200),
      duration,
      error: error instanceof Error ? error.message : String(error),
      success: false,
    });
    
    throw error;
  }
}

/**
 * 外部 API 调用日志包装器
 */
export async function logExternalApiCall<T>(
  service: string,
  endpoint: string,
  executor: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await executor();
    const duration = Date.now() - startTime;
    
    logger.externalApi(service, endpoint, duration, { success: true });
    
    // 慢 API 调用告警
    if (duration > 5000) {
      logger.warn('slow_api', `Slow external API call detected`, {
        service,
        endpoint,
        duration,
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('external_api', `${service} API call failed`, {
      endpoint,
      duration,
      error: error instanceof Error ? error.message : String(error),
      success: false,
    });
    
    throw error;
  }
}

/**
 * 组合日志中间件
 */
export function enableStructuredLogging() {
  return [
    requestIdMiddleware,
    httpLoggingMiddleware,
    slowRequestDetection(3000),
  ];
}

