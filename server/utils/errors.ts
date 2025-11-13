/**
 * 统一的错误处理系统
 * 提供错误类型定义、错误类、错误处理器和用户友好的错误消息
 */

import { Request } from 'express';
import { randomUUID } from 'crypto';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 客户端错误 (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // 服务端错误 (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // 业务逻辑错误
  TRANSCRIPTION_ERROR = 'TRANSCRIPTION_ERROR',
  AI_ANALYSIS_ERROR = 'AI_ANALYSIS_ERROR',
  VIDEO_PROCESSING_ERROR = 'VIDEO_PROCESSING_ERROR',
  API_KEY_ERROR = 'API_KEY_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  timestamp: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any; // 允许添加额外的上下文信息
}

/**
 * 应用错误基类
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly isOperational: boolean; // 是否为可预期的业务错误

  constructor(
    type: ErrorType,
    message: string,
    options: {
      statusCode?: number;
      severity?: ErrorSeverity;
      context?: Partial<ErrorContext>;
      originalError?: Error;
      userMessage?: string;
      isOperational?: boolean;
    } = {}
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = options.statusCode || this.getDefaultStatusCode(type);
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.originalError = options.originalError;
    this.isOperational = options.isOperational !== false;
    
    // 构建上下文
    this.context = {
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      ...options.context,
    };
    
    // 用户友好的错误消息
    this.userMessage = options.userMessage || this.getUserFriendlyMessage(type, message);
    
    // 技术性错误消息（用于日志）
    this.technicalMessage = message;
    
    // 保持堆栈跟踪
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 根据错误类型获取默认HTTP状态码
   */
  private getDefaultStatusCode(type: ErrorType): number {
    const statusMap: Record<ErrorType, number> = {
      [ErrorType.VALIDATION_ERROR]: 400,
      [ErrorType.AUTHENTICATION_ERROR]: 401,
      [ErrorType.AUTHORIZATION_ERROR]: 403,
      [ErrorType.NOT_FOUND]: 404,
      [ErrorType.RATE_LIMIT_EXCEEDED]: 429,
      [ErrorType.INTERNAL_ERROR]: 500,
      [ErrorType.SERVICE_UNAVAILABLE]: 503,
      [ErrorType.TIMEOUT_ERROR]: 504,
      [ErrorType.TRANSCRIPTION_ERROR]: 500,
      [ErrorType.AI_ANALYSIS_ERROR]: 500,
      [ErrorType.VIDEO_PROCESSING_ERROR]: 500,
      [ErrorType.API_KEY_ERROR]: 401,
      [ErrorType.QUOTA_EXCEEDED]: 429,
    };
    return statusMap[type] || 500;
  }

  /**
   * 获取用户友好的错误消息
   */
  private getUserFriendlyMessage(type: ErrorType, technicalMessage: string): string {
    // 错误消息映射表
    const messageMap: Record<ErrorType, string> = {
      [ErrorType.VALIDATION_ERROR]: '请求参数不正确，请检查输入信息',
      [ErrorType.AUTHENTICATION_ERROR]: '身份验证失败，请重新登录',
      [ErrorType.AUTHORIZATION_ERROR]: '您没有权限执行此操作',
      [ErrorType.NOT_FOUND]: '请求的资源不存在',
      [ErrorType.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后再试',
      [ErrorType.INTERNAL_ERROR]: '服务器内部错误，请稍后重试',
      [ErrorType.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后重试',
      [ErrorType.TIMEOUT_ERROR]: '请求超时，请稍后重试或使用较短的视频',
      [ErrorType.TRANSCRIPTION_ERROR]: '视频转录失败，请检查视频链接和内容',
      [ErrorType.AI_ANALYSIS_ERROR]: 'AI分析失败，请稍后重试',
      [ErrorType.VIDEO_PROCESSING_ERROR]: '视频处理失败，请检查视频格式和链接',
      [ErrorType.API_KEY_ERROR]: 'API密钥无效或未配置，请检查配置',
      [ErrorType.QUOTA_EXCEEDED]: '服务额度已用完，请稍后再试或升级套餐',
    };

    // 尝试从技术消息中提取更具体的信息
    let userMessage = messageMap[type] || '操作失败，请稍后重试';
    
    // 针对特定错误类型，提供更详细的用户消息
    if (type === ErrorType.TRANSCRIPTION_ERROR) {
      if (technicalMessage.includes('额度') || technicalMessage.includes('quota')) {
        userMessage = '转录服务免费额度已用完，请等待明天重置或升级套餐';
      } else if (technicalMessage.includes('URL') || technicalMessage.includes('链接')) {
        userMessage = '视频链接无法访问，请确保链接有效且可公开访问';
      } else if (technicalMessage.includes('格式') || technicalMessage.includes('format')) {
        userMessage = '视频格式不支持，请使用支持的视频格式（MP4、MOV等）';
      }
    } else if (type === ErrorType.AI_ANALYSIS_ERROR) {
      if (technicalMessage.includes('API key') || technicalMessage.includes('API Key')) {
        userMessage = 'AI服务配置错误，请检查API密钥设置';
      } else if (technicalMessage.includes('timeout') || technicalMessage.includes('超时')) {
        userMessage = 'AI分析超时，请尝试使用较短的视频（建议3-5分钟）';
      }
    } else if (type === ErrorType.API_KEY_ERROR) {
      if (technicalMessage.includes('GLM')) {
        userMessage = 'GLM API密钥未配置或无效，请提供有效的智谱AI API密钥';
      } else if (technicalMessage.includes('未配置')) {
        userMessage = 'API密钥未配置，请在环境变量中设置或通过表单提供';
      }
    }

    return userMessage;
  }

  /**
   * 转换为JSON格式（用于API响应）
   */
  toJSON() {
    return {
      error: {
        type: this.type,
        message: this.userMessage,
        requestId: this.context.requestId,
        timestamp: this.context.timestamp,
      },
      // 开发环境包含更多调试信息
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          technicalMessage: this.technicalMessage,
          stack: this.stack,
          context: this.context,
        },
      }),
    };
  }

  /**
   * 转换为日志格式
   */
  toLog() {
    return {
      type: this.type,
      severity: this.severity,
      message: this.technicalMessage,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError ? {
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
    };
  }
}

/**
 * 从请求对象创建错误上下文
 */
export function createErrorContext(req?: Request): Partial<ErrorContext> {
  if (!req) return {};
  
  return {
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent'),
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).user?.id, // 如果使用了认证中间件
  };
}

/**
 * 将普通错误转换为AppError
 */
export function normalizeError(error: unknown, context?: Partial<ErrorContext>): AppError {
  // 如果已经是AppError，需要合并上下文时创建新实例（因为context是只读的）
  if (error instanceof AppError) {
    if (context && Object.keys(context).length > 0) {
      // 创建新的AppError实例以合并上下文
      return new AppError(
        error.type,
        error.technicalMessage,
        {
          statusCode: error.statusCode,
          severity: error.severity,
          context: { ...error.context, ...context },
          originalError: error.originalError || error,
          userMessage: error.userMessage,
          isOperational: error.isOperational,
        }
      );
    }
    return error;
  }

  // 如果是标准Error对象
  if (error instanceof Error) {
    // 尝试从错误消息推断错误类型
    const errorMessage = error.message.toLowerCase();
    let errorType = ErrorType.INTERNAL_ERROR;
    let userMessage: string | undefined;

    if (errorMessage.includes('transcribe') || errorMessage.includes('转录')) {
      errorType = ErrorType.TRANSCRIPTION_ERROR;
    } else if (errorMessage.includes('api key') || errorMessage.includes('api key') || errorMessage.includes('未配置')) {
      errorType = ErrorType.API_KEY_ERROR;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
      errorType = ErrorType.TIMEOUT_ERROR;
    } else if (errorMessage.includes('quota') || errorMessage.includes('额度')) {
      errorType = ErrorType.QUOTA_EXCEEDED;
    } else if (errorMessage.includes('validation') || errorMessage.includes('验证')) {
      errorType = ErrorType.VALIDATION_ERROR;
    } else if (errorMessage.includes('not found') || errorMessage.includes('不存在')) {
      errorType = ErrorType.NOT_FOUND;
    }

    return new AppError(
      errorType,
      error.message,
      {
        originalError: error,
        context,
        userMessage,
      }
    );
  }

  // 未知错误类型
  return new AppError(
    ErrorType.INTERNAL_ERROR,
    String(error),
    {
      context,
      isOperational: false,
    }
  );
}

/**
 * 错误处理器 - Express中间件
 */
export function errorHandler(err: Error, req: Request, res: any, next: any) {
  const appError = normalizeError(err, createErrorContext(req));
  
  // 记录错误日志
  console.error('❌ Error occurred:', appError.toLog());
  
  // 返回错误响应
  res.status(appError.statusCode).json(appError.toJSON());
}

/**
 * 异步错误包装器 - 用于Express路由
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

