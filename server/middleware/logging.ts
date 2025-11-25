/**
 * 结构化日志中间件
 * 提供 requestId 追踪、性能监控、关键操作记录
 * 
 * 日志格式（通过 LOG_FORMAT 环境变量控制）：
 * - json: 结构化 JSON（适合日志聚合系统）
 * - pretty: 彩色可读格式（适合开发环境）
 * - compact: 简洁可读格式（适合生产环境人工查看，默认）
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * 日志格式类型
 */
type LogFormat = 'json' | 'pretty' | 'compact';

/**
 * 获取当前日志格式
 */
function getLogFormat(): LogFormat {
  const format = process.env.LOG_FORMAT?.toLowerCase();
  if (format === 'json' || format === 'pretty' || format === 'compact') {
    return format;
  }
  // 默认：生产环境用 compact，开发环境用 pretty
  return process.env.NODE_ENV === 'production' ? 'compact' : 'pretty';
}

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
 * 日志颜色（ANSI escape codes）
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  // 前景色
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

/**
 * 状态码颜色
 */
function getStatusColor(status: number): string {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.white;
}

/**
 * 方法颜色
 */
function getMethodColor(method: string): string {
  switch (method) {
    case 'GET': return colors.green;
    case 'POST': return colors.blue;
    case 'PUT': return colors.yellow;
    case 'DELETE': return colors.red;
    case 'PATCH': return colors.magenta;
    case 'OPTIONS': return colors.gray;
    default: return colors.white;
  }
}

/**
 * 结构化日志器类
 */
class StructuredLogger {
  private logFormat: LogFormat;
  
  constructor() {
    this.logFormat = getLogFormat();
  }
  
  /**
   * 格式化时间为简短格式 HH:MM:SS
   */
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour12: false });
  }
  
  /**
   * 格式化日志输出
   */
  private formatLog(entry: LogEntry): string {
    const format = this.logFormat;
    const { timestamp, level, requestId, type, message, duration, statusCode, method, ...rest } = entry;
    const time = this.formatTime(timestamp);
    
    if (format === 'json') {
      // JSON 格式：适合日志聚合系统
      return JSON.stringify(entry);
    }
    
    if (format === 'compact') {
      // Compact 格式：简洁的单行输出，适合生产环境人工查看
      // 格式: HH:MM:SS LEVEL [type] message key=value
      const levelTag = level.toUpperCase().padEnd(5);
      const levelColors: Record<string, string> = {
        debug: colors.gray,
        info: colors.blue,
        warn: colors.yellow,
        error: colors.red,
        critical: colors.red + colors.bold,
      };
      const levelColor = levelColors[level] || colors.white;
      
      // HTTP 请求/响应使用简化格式
      if (type === 'http_request') {
        const m = method || '';
        return `${colors.dim}${time}${colors.reset} ${getMethodColor(m)}→${colors.reset} ${m.padEnd(6)} ${colors.cyan}${rest.path || message}${colors.reset}`;
      }
      
      if (type === 'http_response') {
        const m = method || '';
        const status = statusCode || 200;
        const statusColor = getStatusColor(status);
        const durationStr = duration !== undefined ? ` ${colors.dim}${duration}ms${colors.reset}` : '';
        return `${colors.dim}${time}${colors.reset} ${getMethodColor(m)}←${colors.reset} ${m.padEnd(6)} ${colors.cyan}${rest.path || ''}${colors.reset} ${statusColor}${status}${colors.reset}${durationStr}`;
      }
      
      // 其他日志类型
      let line = `${colors.dim}${time}${colors.reset} ${levelColor}${levelTag}${colors.reset} ${colors.magenta}[${type}]${colors.reset} ${message}`;
      
      if (duration !== undefined) {
        line += ` ${colors.dim}${duration}ms${colors.reset}`;
      }
      
      // 添加重要的 key=value 对
      const importantKeys = Object.keys(rest).filter(k => 
        !['ip', 'userAgent', 'path', 'operation', 'success'].includes(k)
      );
      if (importantKeys.length > 0) {
        const kvPairs = importantKeys.map(k => {
          const v = typeof rest[k] === 'object' ? JSON.stringify(rest[k]) : String(rest[k]);
          const truncated = v.length > 50 ? v.substring(0, 50) + '...' : v;
          return `${k}=${truncated}`;
        }).join(' ');
        line += ` ${colors.dim}${kvPairs}${colors.reset}`;
      }
      
      return line;
    }
    
    // Pretty 格式：开发环境彩色格式
    // HTTP 请求/响应使用特殊格式
    if (type === 'http_request') {
      const m = method || '';
      return `${colors.dim}${time}${colors.reset} ${getMethodColor(m)}→ ${m}${colors.reset} ${colors.cyan}${rest.path || message}${colors.reset}`;
    }
    
    if (type === 'http_response') {
      const m = method || '';
      const status = statusCode || 200;
      const statusColor = getStatusColor(status);
      const durationStr = duration !== undefined ? `${colors.dim}${duration}ms${colors.reset}` : '';
      return `${colors.dim}${time}${colors.reset} ${getMethodColor(m)}← ${m}${colors.reset} ${colors.cyan}${rest.path || ''}${colors.reset} ${statusColor}${status}${colors.reset} ${durationStr}`;
    }
    
    // 其他日志类型
    const levelColors: Record<string, string> = {
      debug: colors.gray,
      info: colors.blue,
      warn: colors.yellow,
      error: colors.red,
      critical: colors.red + colors.bold,
    };
    const levelColor = levelColors[level] || colors.white;
    const levelTag = level.toUpperCase().padEnd(5);
    
    let output = `${colors.dim}${time}${colors.reset} ${levelColor}${levelTag}${colors.reset} ${colors.magenta}[${type}]${colors.reset} ${message}`;
    
    if (duration !== undefined) {
      output += ` ${colors.dim}(${duration}ms)${colors.reset}`;
    }
    
    // 只在有重要额外信息时显示
    const importantKeys = Object.keys(rest).filter(k => 
      !['ip', 'userAgent', 'path', 'operation', 'success'].includes(k)
    );
    if (importantKeys.length > 0) {
      const importantRest = Object.fromEntries(importantKeys.map(k => [k, rest[k]]));
      output += ` ${colors.dim}${JSON.stringify(importantRest)}${colors.reset}`;
    }
    
    return output;
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
 * 需要过滤的路径（不打印日志）
 */
const QUIET_PATHS = [
  '/api/health',
  '/health',
  '/favicon.ico',
];

/**
 * HTTP 请求日志中间件
 */
export function httpLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  // 跳过 OPTIONS 请求（CORS 预检）和健康检查
  const isQuiet = req.method === 'OPTIONS' || QUIET_PATHS.some(p => req.path.startsWith(p));
  
  if (!isQuiet) {
    // 记录请求开始
    logger.httpRequest(req);
  }
  
  // 记录响应完成
  res.on('finish', () => {
    if (!isQuiet) {
      const duration = req.startTime ? Date.now() - req.startTime : 0;
      logger.httpResponse(req, res, duration);
    }
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

