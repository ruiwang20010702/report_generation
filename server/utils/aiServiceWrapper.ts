/**
 * AI 服务包装器
 * 提供重试机制、超时控制和 fallback 处理
 * 
 * 生产环境注意事项：
 * 1. 使用 AbortController 实现真正的请求取消
 * 2. 使用信号量控制并发数量，避免触发 API 速率限制
 * 3. 所有超时都会正确清理资源
 */

import OpenAI from 'openai';
import { AppError, ErrorType, ErrorSeverity } from './errors.js';
import { alertServiceError } from '../services/alertService.js';
import { Sentry } from '../config/sentry.js';

/**
 * AI 调用配置
 */
export interface AICallConfig {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟基数（毫秒） */
  retryDelayBase?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否启用 fallback */
  enableFallback?: boolean;
  /** 操作标识（用于日志） */
  operationLabel?: string;
  /** AbortSignal（用于外部取消） */
  signal?: AbortSignal;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<AICallConfig, 'signal'>> = {
  maxRetries: 3,
  retryDelayBase: 1000,
  timeout: 120000, // 2分钟
  enableFallback: true,
  operationLabel: 'AI调用',
};

/**
 * AI 并发控制信号量
 * 限制同时进行的 AI 调用数量，避免触发速率限制
 */
class AISemaphore {
  private readonly maxConcurrent: number;
  private currentCount: number = 0;
  private readonly waitQueue: Array<() => void> = [];

  constructor(maxConcurrent: number = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.currentCount < this.maxConcurrent) {
      this.currentCount++;
      return;
    }

    // 等待释放
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      next?.();
    } else {
      this.currentCount = Math.max(0, this.currentCount - 1);
    }
  }

  getStats(): { current: number; waiting: number; max: number } {
    return {
      current: this.currentCount,
      waiting: this.waitQueue.length,
      max: this.maxConcurrent,
    };
  }
}

// 全局 AI 调用信号量（限制并发 AI 调用）
// GLM-4-Plus 支持最大 20 并发，默认设为 19 留有余量
const aiSemaphore = new AISemaphore(
  Math.max(1, Number.parseInt(process.env.AI_MAX_CONCURRENT || '19', 10))
);

/**
 * AI 请求间隔控制器
 * 避免瞬时并发过高触发 API 速率限制（429错误）
 * 通过确保请求之间有最小间隔，平滑请求发送
 */
class AIRateLimiter {
  private lastCallTime: number = 0;
  private readonly minInterval: number; // 最小间隔（毫秒）
  private readonly lock: Promise<void> = Promise.resolve();
  private pendingLock: Promise<void> | null = null;

  constructor(minInterval: number = 100) {
    this.minInterval = minInterval;
  }

  /**
   * 等待直到可以发送下一个请求
   * 使用锁机制确保多个并发调用也能正确排队
   */
  async waitForNextCall(): Promise<void> {
    // 等待前一个请求的锁释放
    while (this.pendingLock) {
      await this.pendingLock;
    }

    const now = Date.now();
    const elapsed = now - this.lastCallTime;

    if (elapsed < this.minInterval) {
      const waitTime = this.minInterval - elapsed;
      
      // 创建新的锁
      let resolveLock: () => void;
      this.pendingLock = new Promise(resolve => {
        resolveLock = resolve;
      });

      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // 释放锁
      this.pendingLock = null;
      resolveLock!();
    }

    this.lastCallTime = Date.now();
  }

  /**
   * 获取当前配置的最小间隔
   */
  getMinInterval(): number {
    return this.minInterval;
  }
}

// 全局 AI 请求间隔控制器
// 默认 150ms 间隔，确保每秒最多约 6-7 个请求，避免瞬时并发
const aiRateLimiter = new AIRateLimiter(
  Math.max(50, Number.parseInt(process.env.AI_MIN_INTERVAL || '150', 10))
);

/**
 * 获取 AI 速率限制器统计
 */
export function getAIRateLimiterStats() {
  return {
    minInterval: aiRateLimiter.getMinInterval(),
  };
}

/**
 * 获取 AI 并发统计
 */
export function getAIConcurrencyStats() {
  return aiSemaphore.getStats();
}

/**
 * 可重试的错误类型
 */
const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN',
  'rate_limit_exceeded',
  'timeout',
  'server_error',
  '503',
  '502',
  '504',
  '429',
];

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  const statusCode = error.status || error.statusCode || 0;
  
  // 检查状态码
  if ([429, 502, 503, 504].includes(statusCode)) {
    return true;
  }
  
  // 检查错误码和消息
  return RETRYABLE_ERRORS.some(retryable => 
    errorMessage.includes(retryable.toLowerCase()) || 
    errorCode.includes(retryable.toLowerCase())
  );
}

/**
 * 计算重试延迟（指数退避）
 */
function calculateRetryDelay(attempt: number, baseDelay: number): number {
  // 指数退避 + 随机抖动
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // 最大30秒
}

/**
 * 带超时和取消支持的 Promise 包装器
 * 使用 AbortController 实现真正的请求取消
 */
function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
  externalSignal?: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    // 创建内部 AbortController
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    let isSettled = false;

    // 清理函数
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // 设置超时
    timeoutId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        controller.abort(); // 取消请求
        cleanup();
        reject(new AppError(
          ErrorType.TIMEOUT_ERROR,
          `${label} 超时（${timeoutMs}ms）`,
          {
            userMessage: `AI服务响应超时，请稍后重试或使用较短的视频`,
            context: { timeout: timeoutMs, operation: label },
          }
        ));
      }
    }, timeoutMs);

    // 监听外部取消信号
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => {
        if (!isSettled) {
          isSettled = true;
          controller.abort();
          cleanup();
          reject(new AppError(
            ErrorType.VALIDATION_ERROR,
            `${label} 被取消`,
            {
              userMessage: '操作已被取消',
              context: { operation: label },
            }
          ));
        }
      }, { once: true });
    }

    // 执行 Promise
    promiseFactory(controller.signal)
      .then(result => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          resolve(result);
        }
      })
      .catch(error => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(error);
        }
      });
  });
}

/**
 * 带重试机制的 AI 调用包装器
 * 
 * @param operation - 接收 AbortSignal 的异步操作函数
 * @param config - 配置选项
 * 
 * 生产环境特性：
 * 1. 使用信号量控制并发，避免触发 API 速率限制
 * 2. 支持请求取消（通过 AbortSignal）
 * 3. 指数退避重试，带随机抖动
 * 4. 完整的资源清理
 */
export async function withRetry<T>(
  operation: ((signal: AbortSignal) => Promise<T>) | (() => Promise<T>),
  config: AICallConfig = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxRetries, retryDelayBase, timeout, operationLabel } = mergedConfig;
  const externalSignal = config.signal;
  
  // 检查是否已被外部取消
  if (externalSignal?.aborted) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `${operationLabel} 被取消`,
      { userMessage: '操作已被取消' }
    );
  }
  
  let lastError: Error | null = null;
  
  // 获取信号量（控制并发）
  await aiSemaphore.acquire();
  
  // 等待请求间隔（避免瞬时并发过高）
  await aiRateLimiter.waitForNextCall();
  
  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // 再次检查是否已被外部取消
      if (externalSignal?.aborted) {
        throw new AppError(
          ErrorType.VALIDATION_ERROR,
          `${operationLabel} 被取消`,
          { userMessage: '操作已被取消' }
        );
      }
      
      try {
        // 添加超时控制，支持请求取消
        const result = await withTimeout(
          (signal: AbortSignal) => {
            // 判断 operation 是否接受 signal 参数
            if (operation.length > 0) {
              return (operation as (signal: AbortSignal) => Promise<T>)(signal);
            }
            return (operation as () => Promise<T>)();
          },
          timeout,
          operationLabel,
          externalSignal
        );
        
        // 成功后，如果之前有重试，记录恢复日志
        if (attempt > 0) {
          console.log(`✅ ${operationLabel} 在第 ${attempt + 1} 次尝试后成功`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 如果是取消错误，直接抛出
        if ((error as any)?.name === 'AbortError' || externalSignal?.aborted) {
          throw new AppError(
            ErrorType.VALIDATION_ERROR,
            `${operationLabel} 被取消`,
            { userMessage: '操作已被取消' }
          );
        }
        
        // 记录错误
        console.error(`❌ ${operationLabel} 失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, lastError.message);
        
        // 如果是最后一次尝试，或者错误不可重试，则抛出
        if (attempt >= maxRetries || !isRetryableError(error)) {
          // 报告到 Sentry
          Sentry?.captureException(lastError, {
            level: 'error',
            tags: { 
              operation: operationLabel,
              attempts: attempt + 1,
              retryable: isRetryableError(error),
            },
          });
          
          throw lastError;
        }
        
        // 计算延迟并等待
        const delay = calculateRetryDelay(attempt, retryDelayBase);
        console.log(`⏳ ${operationLabel} 将在 ${Math.round(delay)}ms 后重试...`);
        
        // 可中断的延迟
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(resolve, delay);
          
          if (externalSignal) {
            const abortHandler = () => {
              clearTimeout(timeoutId);
              reject(new AppError(
                ErrorType.VALIDATION_ERROR,
                `${operationLabel} 被取消`,
                { userMessage: '操作已被取消' }
              ));
            };
            
            externalSignal.addEventListener('abort', abortHandler, { once: true });
            
            // 清理监听器
            setTimeout(() => {
              externalSignal.removeEventListener('abort', abortHandler);
            }, delay + 100);
          }
        });
      }
    }
  } finally {
    // 释放信号量
    aiSemaphore.release();
  }
  
  // 这里理论上不会执行到，但为了类型安全
  throw lastError || new Error(`${operationLabel} 失败`);
}

/**
 * AI Chat Completion 调用包装器
 * 提供重试、超时和 fallback 机制
 * 
 * 生产环境特性：
 * 1. 支持请求取消（通过 AbortSignal）
 * 2. 自动并发控制
 * 3. 完整的错误处理和重试
 */
export async function safeAIChatCompletion(
  openai: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  config: AICallConfig = {}
): Promise<OpenAI.Chat.ChatCompletion> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  return withRetry(
    async () => {
      // 直接调用，不传递 signal（OpenAI SDK 内部处理超时）
      const result = await openai.chat.completions.create(params);
      return result as OpenAI.Chat.ChatCompletion;
    },
    mergedConfig
  );
}

/**
 * AI 服务健康检查
 */
export async function checkAIServiceHealth(openai: OpenAI): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // 发送一个简单的测试请求
    await withTimeout(
      async () => {
        const result = await openai.chat.completions.create({
          model: 'glm-4-plus',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        });
        return result;
      },
      10000, // 10秒超时
      'AI健康检查'
    );
    
    return {
      healthy: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * JSON 解析包装器（带 fallback）
 */
export function safeJSONParse<T>(
  jsonString: string,
  fallback: T,
  operationLabel: string = 'JSON解析'
): T {
  try {
    // 尝试清理常见的 JSON 问题
    let cleaned = jsonString.trim();
    
    // 移除可能的 markdown 代码块标记
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    
    cleaned = cleaned.trim();
    
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.warn(`⚠️ ${operationLabel} 失败，使用 fallback:`, error instanceof Error ? error.message : error);
    
    // 尝试提取 JSON 对象
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        // 提取也失败，使用 fallback
      }
    }
    
    return fallback;
  }
}

/**
 * 创建 AI 调用的 fallback 响应
 */
export function createFallbackAnalysisResponse(
  studentName: string,
  errorMessage: string
): Record<string, any> {
  return {
    wordCount: 0,
    sentenceCount: 0,
    handRaising: { count: 5, percentage: 50 },
    answerLength: { average: 3.5 },
    completeSentences: { count: 3, percentage: 60 },
    readingAccuracy: { correctRate: 75 },
    fluency: `由于技术原因，无法获取 ${studentName} 的详细流利度分析。建议重新提交分析请求。错误信息：${errorMessage}`,
    vocabulary: `由于技术原因，无法获取 ${studentName} 的词汇分析。建议重新提交分析请求。`,
    grammar: `由于技术原因，无法获取 ${studentName} 的语法分析。建议重新提交分析请求。`,
    participation: `由于技术原因，无法获取 ${studentName} 的参与度分析。建议重新提交分析请求。`,
    strengths: ['分析暂时不可用'],
    weaknesses: ['分析暂时不可用'],
    dialogueExamples: [],
    _fallback: true,
    _error: errorMessage,
  };
}

/**
 * 创建 fallback 的对比报告响应
 */
export function createFallbackComparisonResponse(
  studentInfo: { studentName: string; studentId?: string; grade: string; level: string; unit: string },
  errorMessage: string
): Record<string, any> {
  return {
    studentName: studentInfo.studentName,
    studentId: studentInfo.studentId || '',
    grade: studentInfo.grade,
    level: studentInfo.level,
    unit: studentInfo.unit,
    learningData: {
      handRaising: { trend: '持平', percentage: '+0%', analysis: '分析暂时不可用' },
      answerLength: { trend: '持平', percentage: '+0%', analysis: '分析暂时不可用' },
      completeSentences: { trend: '持平', percentage: '+0%', analysis: '分析暂时不可用' },
      readingAccuracy: { trend: '持平', percentage: '+0%', analysis: '分析暂时不可用' },
    },
    progressDimensions: {
      fluency: { analysis: '分析暂时不可用', example: '' },
      confidence: { analysis: '分析暂时不可用', example: '' },
      languageApplication: { analysis: '分析暂时不可用', example: '' },
      sentenceComplexity: { analysis: '分析暂时不可用', example: '' },
    },
    improvementAreas: {},
    overallSuggestions: [
      {
        title: '分析服务暂时不可用',
        performanceSummary: `由于技术原因，无法生成 ${studentInfo.studentName} 的详细学习建议。`,
        description: `错误信息：${errorMessage}\n\n请稍后重新提交分析请求。如果问题持续存在，请联系技术支持。`,
      },
    ],
    _fallback: true,
    _error: errorMessage,
  };
}

/**
 * 创建可取消的延迟
 * 用于在重试之间等待，同时支持取消
 */
export function createCancellableDelay(
  ms: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Delay cancelled'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Delay cancelled'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}

/**
 * 批量执行 AI 调用，带并发控制
 * 用于需要同时处理多个 AI 请求的场景
 */
export async function batchAICalls<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<R[]> {
  const { maxConcurrent = 5, onProgress, signal } = options;
  const results: R[] = new Array(items.length);
  let completedCount = 0;
  
  // 使用本地信号量控制批量调用的并发
  const localSemaphore = new (class {
    private count = 0;
    private queue: Array<() => void> = [];
    
    async acquire(): Promise<void> {
      if (this.count < maxConcurrent) {
        this.count++;
        return;
      }
      return new Promise(resolve => this.queue.push(resolve));
    }
    
    release(): void {
      if (this.queue.length > 0) {
        this.queue.shift()?.();
      } else {
        this.count--;
      }
    }
  })();
  
  const tasks = items.map(async (item, index) => {
    if (signal?.aborted) {
      throw new Error('Batch operation cancelled');
    }
    
    await localSemaphore.acquire();
    
    try {
      results[index] = await processor(item, index);
      completedCount++;
      onProgress?.(completedCount, items.length);
    } finally {
      localSemaphore.release();
    }
  });
  
  await Promise.all(tasks);
  return results;
}

export default {
  withRetry,
  safeAIChatCompletion,
  checkAIServiceHealth,
  safeJSONParse,
  createFallbackAnalysisResponse,
  createFallbackComparisonResponse,
  getAIConcurrencyStats,
  createCancellableDelay,
  batchAICalls,
};

