import { v4 as uuidv4 } from 'uuid';
import { VideoAnalysisRequest, VideoAnalysisResponse } from '../types/index.js';
import { AppError, ErrorType } from '../utils/errors.js';
import { VideoAnalysisService } from './videoAnalysisService.js';
import { pool } from '../config/database.js';
import { alertDatabaseError } from './alertService.js';

export type AnalysisJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface AnalysisJobState {
  jobId: string;
  status: AnalysisJobStatus;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  position: number;
  estimatedWaitSeconds: number;
  durationSeconds?: number;
  result?: VideoAnalysisResponse;
  error?: {
    type?: ErrorType;
    message: string;
    userMessage?: string;
    context?: Record<string, unknown>;
  };
}

interface AnalysisJobInternal {
  id: string;
  request: VideoAnalysisRequest;
  status: AnalysisJobStatus;
  useMock: boolean;
  submittedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: VideoAnalysisResponse;
  error?: AnalysisJobState['error'];
}

interface EnqueueOptions {
  useMock: boolean;
}

// 默认并发数：支持100个任务同时处理
// 可通过环境变量 ANALYSIS_JOB_CONCURRENCY 调整（建议范围：10-200）
// 注意：过高的并发数可能导致外部API限流和成本增加
const DEFAULT_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.ANALYSIS_JOB_CONCURRENCY || '100', 10)
);

const DEFAULT_ESTIMATED_DURATION_MS = Math.max(
  60_000,
  Number.parseInt(process.env.ANALYSIS_JOB_ESTIMATE_MS || '240000', 10)
);

export class AnalysisJobQueue {
  private readonly jobs: Map<string, AnalysisJobInternal> = new Map();
  private readonly jobOrder: string[] = [];
  private activeCount = 0;
  private readonly concurrency: number;
  private readonly analysisService: VideoAnalysisService;
  private recentDurations: number[] = [];
  // Promise 链用于串行化 processQueue 调用，解决竞态条件
  private processQueueChain: Promise<void> = Promise.resolve();
  // 数据库持久化开关（如果数据库不可用，降级到内存模式）
  private persistenceEnabled = false;
  // 数据库操作失败计数器（用于追踪连续失败，如果失败太多则禁用持久化）
  private databaseFailureCount = 0;
  private readonly MAX_DATABASE_FAILURES = 10; // 连续失败10次后禁用持久化

  constructor(concurrency: number = DEFAULT_CONCURRENCY) {
    this.concurrency = concurrency;
    this.analysisService = new VideoAnalysisService();
    this.logEvent('queue_initialized', {
      concurrency: this.concurrency,
      estimateMs: DEFAULT_ESTIMATED_DURATION_MS
    });
    // 检查数据库是否可用（异步，不阻塞构造函数）
    this.checkPersistenceAvailability().catch((error) => {
      console.error('[AnalysisJobQueue] Failed to check persistence availability:', error);
    });
  }

  /**
   * 检查数据库持久化是否可用
   */
  private async checkPersistenceAvailability(): Promise<void> {
    try {
      await pool.query('SELECT 1');
      this.persistenceEnabled = true;
      this.logEvent('persistence_enabled', { enabled: true });
    } catch (error) {
      this.persistenceEnabled = false;
      this.logEvent('persistence_disabled', {
        enabled: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 手动启用持久化（在数据库连接确认后调用）
   */
  enablePersistence(): void {
    this.persistenceEnabled = true;
    this.logEvent('persistence_manually_enabled', { enabled: true });
  }

  async enqueue(request: VideoAnalysisRequest, options: EnqueueOptions): Promise<AnalysisJobState> {
    const job: AnalysisJobInternal = {
      id: uuidv4(),
      request,
      useMock: options.useMock,
      status: 'queued',
      submittedAt: new Date()
    };

    this.jobs.set(job.id, job);
    this.jobOrder.push(job.id);
    
    // 持久化到数据库（异步，不阻塞）
    // 注意：即使数据库操作失败，任务仍然会入队（降级到内存模式）
    if (this.persistenceEnabled) {
      this.persistJobToDatabase(job).catch((error) => {
        // 错误已在 persistJobToDatabase 中记录和追踪
        // 这里只记录额外的上下文信息
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logEvent('persist_failed_at_enqueue', {
          jobId: job.id,
          error: errorMessage,
          note: 'Job still enqueued in memory mode'
        });
        // 数据库失败不影响任务入队，任务队列仍能正常工作
      });
    }

    this.logEvent('job_enqueued', {
      jobId: job.id,
      studentName: request.studentName,
      queueDepth: this.jobOrder.length,
      useMock: job.useMock,
      persisted: this.persistenceEnabled
    });
    
    // 触发队列处理（异步，不阻塞）
    void this.processQueue();
    const state = this.toPublicState(job.id);
    if (!state) {
      throw new Error('Failed to create job state');
    }
    return state;
  }

  /**
   * 获取任务状态（从内存或数据库）
   * 如果内存中找不到，且持久化已启用，则从数据库读取已完成的任务
   */
  async getJob(jobId: string): Promise<AnalysisJobState | null> {
    // 先尝试从内存读取
    const memoryState = this.toPublicState(jobId);
    if (memoryState) {
      return memoryState;
    }

    // 如果内存中没有，且持久化已启用，尝试从数据库读取
    if (this.persistenceEnabled) {
      try {
        const result = await pool.query(
          `SELECT job_id, status, request_data, use_mock, result_data, error_data,
                  submitted_at, started_at, completed_at
           FROM analysis_jobs
           WHERE job_id = $1`,
          [jobId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          
          // 从数据库恢复任务状态
          const job: AnalysisJobInternal = {
            id: row.job_id,
            request: row.request_data as VideoAnalysisRequest,
            useMock: row.use_mock,
            status: row.status as AnalysisJobStatus,
            submittedAt: new Date(row.submitted_at),
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            result: row.result_data as VideoAnalysisResponse | undefined,
            error: row.error_data as AnalysisJobState['error'] | undefined
          };

          // 临时恢复到内存中（不加入队列），方便后续查询
          this.jobs.set(job.id, job);

          // 返回任务状态
          return this.toPublicState(job.id);
        }
      } catch (error) {
        console.error(`[AnalysisJobQueue] Failed to load job ${jobId} from database:`, error);
        // 数据库查询失败不影响，返回 null
      }
    }

    return null;
  }

  getQueueSize() {
    return this.jobOrder.length;
  }

  getActiveCount() {
    return this.activeCount;
  }

  /**
   * 处理队列中的任务
   * 使用 Promise 链确保串行执行，解决竞态条件：
   * 1. activeCount 的检查-修改竞态
   * 2. jobOrder.shift() 的并发问题
   * 3. enqueue 和 processQueue 的并发调用
   * 4. 递归调用的并发叠加
   */
  private processQueue(): Promise<void> {
    // 将新的处理加入 Promise 链，确保串行执行
    this.processQueueChain = this.processQueueChain.then(async () => {
      await this.processQueueInternal();
    }).catch((error) => {
      // 捕获错误，避免 Promise 链断裂
      console.error('[AnalysisJobQueue] processQueue error:', error);
    });
    return this.processQueueChain;
  }

  /**
   * 内部队列处理逻辑
   * 使用循环处理多个任务，而不是递归调用
   */
  private async processQueueInternal(): Promise<void> {
    // 循环处理任务，直到达到并发限制或队列为空
    while (this.activeCount < this.concurrency && this.jobOrder.length > 0) {
      // 原子操作：在串行化上下文中检查和修改
    const nextJobId = this.jobOrder.shift();
    if (!nextJobId) {
        break;
    }

    const job = this.jobs.get(nextJobId);
    if (!job) {
      this.logEvent('job_missing', { jobId: nextJobId });
        // 跳过缺失的任务，继续处理下一个
        continue;
    }

      // 在串行化上下文中安全地增加 activeCount
    this.activeCount += 1;
    job.status = 'processing';
    job.startedAt = new Date();
      
      // 更新数据库状态（异步，不阻塞）
      // 注意：即使数据库操作失败，任务处理仍会继续
      if (this.persistenceEnabled) {
        this.updateJobStatusInDatabase(job.id, 'processing', {
          startedAt: job.startedAt
        }).catch((error) => {
          // 错误已在 updateJobStatusInDatabase 中记录和追踪
          // 这里只记录额外的上下文信息
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logEvent('update_failed_at_start', {
            jobId: job.id,
            error: errorMessage,
            note: 'Job processing continues despite database update failure'
          });
        });
      }
      
    this.logEvent('job_started', {
      jobId: job.id,
      queueDepth: this.jobOrder.length,
      activeCount: this.activeCount,
      useMock: job.useMock
    });

      // 异步处理任务，不阻塞队列处理循环
      // 注意：processJob 内部已经处理了所有错误，这个 catch 是为了防止未处理的 Promise rejection
      this.processJob(job).catch((error) => {
        // 这种情况理论上不应该发生，因为 processJob 内部已经处理了所有错误
        // 但如果发生了，说明有未处理的错误，需要记录
        console.error(`[AnalysisJobQueue] Unexpected unhandled error in job ${job.id}:`, error);
        this.logEvent('unexpected_job_error', {
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }

    // 如果达到并发限制，记录日志
    if (this.activeCount >= this.concurrency && this.jobOrder.length > 0) {
      this.logEvent('worker_saturated', {
        activeCount: this.activeCount,
        concurrency: this.concurrency,
        queued: this.jobOrder.length
      });
    }
  }

  /**
   * 处理单个任务
   * 任务完成后会自动触发队列继续处理
   */
  private async processJob(job: AnalysisJobInternal): Promise<void> {
    try {
      job.result = job.useMock
        ? await this.analysisService.analyzeMock(job.request)
        : await this.analysisService.analyzeVideos(job.request);
      job.status = 'completed';
      job.completedAt = new Date();
      
      // 更新数据库状态（异步，不阻塞）
      // 注意：即使数据库操作失败，任务已完成状态已保存在内存中
      if (this.persistenceEnabled) {
        this.updateJobStatusInDatabase(job.id, 'completed', {
          completedAt: job.completedAt,
          result: job.result
        }).catch((error) => {
          // 错误已在 updateJobStatusInDatabase 中记录和追踪
          // 这里只记录额外的上下文信息
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logEvent('update_failed_at_completion', {
            jobId: job.id,
            error: errorMessage,
            note: 'Job completed in memory, but database update failed'
          });
        });
      }
      
      this.logEvent('job_completed', {
        jobId: job.id,
        durationMs: job.startedAt && job.completedAt
          ? job.completedAt.getTime() - job.startedAt.getTime()
          : undefined
      });
    } catch (error) {
      job.status = 'failed';
      job.error = this.serializeError(error);
      job.completedAt = new Date();
      
      // 更新数据库状态（异步，不阻塞）
      // 注意：即使数据库操作失败，任务失败状态已保存在内存中
      if (this.persistenceEnabled) {
        this.updateJobStatusInDatabase(job.id, 'failed', {
          completedAt: job.completedAt,
          error: job.error
        }).catch((error) => {
          // 错误已在 updateJobStatusInDatabase 中记录和追踪
          // 这里只记录额外的上下文信息
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logEvent('update_failed_at_failure', {
            jobId: job.id,
            error: errorMessage,
            note: 'Job failed in memory, but database update failed'
          });
        });
      }
      
      this.logEvent('job_failed', {
        jobId: job.id,
        error: job.error?.message,
        errorType: job.error?.type
      });
    } finally {
      // 减少活跃任务计数（JavaScript 单线程中这是原子操作）
      this.activeCount -= 1;
      this.trackDuration(job);
      this.scheduleCleanup(job.id);
      // 任务完成后触发队列继续处理（会加入 Promise 链，确保串行化）
      void this.processQueue();
    }
  }

  private serializeError(error: unknown): AnalysisJobState['error'] {
    if (error instanceof AppError) {
      return {
        type: error.type,
        message: error.technicalMessage,
        userMessage: error.userMessage,
        context: error.context
      };
    }

    if (error instanceof Error) {
      return {
        type: ErrorType.INTERNAL_ERROR,
        message: error.message
      };
    }

    return {
      type: ErrorType.INTERNAL_ERROR,
      message: 'Unknown error'
    };
  }

  private trackDuration(job: AnalysisJobInternal) {
    if (job.startedAt && job.completedAt) {
      const durationMs = job.completedAt.getTime() - job.startedAt.getTime();
      this.recentDurations = [...this.recentDurations, durationMs].slice(-20);
      this.logEvent('duration_tracked', {
        jobId: job.id,
        durationMs,
        averageMs: this.getAverageDurationMs()
      });
    }
  }

  private scheduleCleanup(jobId: string) {
    const ttlMs = Number.parseInt(process.env.ANALYSIS_JOB_TTL_MS || '86400000', 10);
    setTimeout(() => {
      this.jobs.delete(jobId);
      this.logEvent('job_cleaned', { jobId, ttlMs });
    }, ttlMs);
  }

  private getAverageDurationMs() {
    if (this.recentDurations.length === 0) {
      return DEFAULT_ESTIMATED_DURATION_MS;
    }
    const total = this.recentDurations.reduce((sum, ms) => sum + ms, 0);
    return Math.max(30_000, Math.round(total / this.recentDurations.length));
  }

  private getPosition(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return -1;
    }

    if (job.status === 'queued') {
      const index = this.jobOrder.indexOf(jobId);
      return index === -1 ? 0 : index + 1;
    }

    return 0;
  }

  private getEstimatedWaitSeconds(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'queued') {
      return 0;
    }

    const position = this.getPosition(jobId);
    const averageMs = this.getAverageDurationMs();
    const batches = Math.max(0, Math.ceil(position / this.concurrency));
    return Math.round((batches * averageMs) / 1000);
  }

  private getDurationSeconds(job: AnalysisJobInternal) {
    if (job.startedAt && job.completedAt) {
      return Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
    }
    return undefined;
  }

  private toPublicState(jobId: string): AnalysisJobState | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    // 对于已完成或失败的任务，position 和 estimatedWaitSeconds 应该为 0
    const isFinished = job.status === 'completed' || job.status === 'failed';
    const position = isFinished ? 0 : this.getPosition(job.id);
    const estimatedWaitSeconds = isFinished ? 0 : this.getEstimatedWaitSeconds(job.id);

    return {
      jobId: job.id,
      status: job.status,
      submittedAt: job.submittedAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      position,
      estimatedWaitSeconds,
      durationSeconds: this.getDurationSeconds(job),
      result: job.status === 'completed' ? job.result : undefined,
      error: job.status === 'failed' ? job.error : undefined
    };
  }

  /**
   * 判断错误是否可重试（临时性错误）
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;
    
    // 网络错误、超时、连接错误等可以重试
    return (
      errorCode === 'ECONNRESET' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ESOCKETTIMEDOUT' ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('network')
    );
  }

  /**
   * 将任务持久化到数据库（带重试机制）
   */
  private async persistJobToDatabase(job: AnalysisJobInternal, retries: number = 2): Promise<void> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await pool.query(
          `INSERT INTO analysis_jobs (job_id, status, request_data, use_mock, submitted_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (job_id) DO UPDATE SET
             status = EXCLUDED.status,
             request_data = EXCLUDED.request_data,
             use_mock = EXCLUDED.use_mock,
             updated_at = CURRENT_TIMESTAMP`,
          [
            job.id,
            job.status,
            JSON.stringify(job.request),
            job.useMock,
            job.submittedAt
          ]
        );
        
        // 成功时重置失败计数器
        if (this.databaseFailureCount > 0) {
          this.databaseFailureCount = 0;
          this.logEvent('database_recovered', { jobId: job.id });
        }
        
        return; // 成功，退出
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次尝试，或者错误不可重试，则不再重试
        if (attempt === retries || !this.isRetryableError(error)) {
          break;
        }
        
        // 等待后重试（指数退避）
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // 所有重试都失败了
    this.databaseFailureCount++;
    const error = lastError instanceof Error ? lastError : new Error(String(lastError));
    
    console.error(`[AnalysisJobQueue] Database persist error for job ${job.id} (attempts: ${retries + 1}, failures: ${this.databaseFailureCount}):`, error);
    
    // 记录错误事件
    this.logEvent('persist_failed', {
      jobId: job.id,
      error: error.message,
      failureCount: this.databaseFailureCount,
      retryable: this.isRetryableError(lastError)
    });
    
    // 如果连续失败太多次，禁用持久化
    if (this.databaseFailureCount >= this.MAX_DATABASE_FAILURES) {
      this.persistenceEnabled = false;
      this.logEvent('persistence_auto_disabled', {
        reason: 'too_many_failures',
        failureCount: this.databaseFailureCount
      });
      
      // 发送告警
      alertDatabaseError(error, `任务持久化失败（已禁用持久化）`).catch((alertError) => {
        console.error('[AnalysisJobQueue] Failed to send database error alert:', alertError);
      });
    } else if (this.databaseFailureCount >= 5) {
      // 失败5次以上时发送告警
      alertDatabaseError(error, `任务持久化失败（连续失败${this.databaseFailureCount}次）`).catch((alertError) => {
        console.error('[AnalysisJobQueue] Failed to send database error alert:', alertError);
      });
    }
    
    // 抛出错误，让调用者知道操作失败
    throw error;
  }

  /**
   * 更新数据库中的任务状态（带重试机制）
   */
  private async updateJobStatusInDatabase(
    jobId: string,
    status: AnalysisJobStatus,
    updates: {
      startedAt?: Date;
      completedAt?: Date;
      result?: VideoAnalysisResponse;
      error?: AnalysisJobState['error'];
    },
    retries: number = 2
  ): Promise<void> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const updateFields: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
        const values: any[] = [jobId, status];
        let paramIndex = 3;

        if (updates.startedAt) {
          updateFields.push(`started_at = $${paramIndex}`);
          values.push(updates.startedAt);
          paramIndex++;
        }

        if (updates.completedAt) {
          updateFields.push(`completed_at = $${paramIndex}`);
          values.push(updates.completedAt);
          paramIndex++;
        }

        if (updates.result) {
          updateFields.push(`result_data = $${paramIndex}`);
          values.push(JSON.stringify(updates.result));
          paramIndex++;
        }

        if (updates.error) {
          updateFields.push(`error_data = $${paramIndex}`);
          values.push(JSON.stringify(updates.error));
          paramIndex++;
        }

        await pool.query(
          `UPDATE analysis_jobs SET ${updateFields.join(', ')} WHERE job_id = $1`,
          values
        );
        
        // 成功时重置失败计数器
        if (this.databaseFailureCount > 0) {
          this.databaseFailureCount = 0;
          this.logEvent('database_recovered', { jobId });
        }
        
        return; // 成功，退出
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次尝试，或者错误不可重试，则不再重试
        if (attempt === retries || !this.isRetryableError(error)) {
          break;
        }
        
        // 等待后重试（指数退避）
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // 所有重试都失败了
    this.databaseFailureCount++;
    const error = lastError instanceof Error ? lastError : new Error(String(lastError));
    
    console.error(`[AnalysisJobQueue] Database update error for job ${jobId} (attempts: ${retries + 1}, failures: ${this.databaseFailureCount}):`, error);
    
    // 记录错误事件
    this.logEvent('update_failed', {
      jobId,
      status,
      error: error.message,
      failureCount: this.databaseFailureCount,
      retryable: this.isRetryableError(lastError)
    });
    
    // 如果连续失败太多次，禁用持久化
    if (this.databaseFailureCount >= this.MAX_DATABASE_FAILURES) {
      this.persistenceEnabled = false;
      this.logEvent('persistence_auto_disabled', {
        reason: 'too_many_failures',
        failureCount: this.databaseFailureCount
      });
      
      // 发送告警
      alertDatabaseError(error, `任务状态更新失败（已禁用持久化）`).catch((alertError) => {
        console.error('[AnalysisJobQueue] Failed to send database error alert:', alertError);
      });
    } else if (this.databaseFailureCount >= 5) {
      // 失败5次以上时发送告警
      alertDatabaseError(error, `任务状态更新失败（连续失败${this.databaseFailureCount}次）`).catch((alertError) => {
        console.error('[AnalysisJobQueue] Failed to send database error alert:', alertError);
      });
    }
    
    // 抛出错误，让调用者知道操作失败
    throw error;
  }

  /**
   * 从数据库恢复未完成的任务
   * 在服务器启动时调用
   */
  async recoverPendingJobs(): Promise<number> {
    if (!this.persistenceEnabled) {
      this.logEvent('recovery_skipped', { reason: 'persistence_disabled' });
      return 0;
    }

    try {
      // 查询所有未完成的任务（queued 或 processing）
      const result = await pool.query(
        `SELECT job_id, status, request_data, use_mock, submitted_at, started_at
         FROM analysis_jobs
         WHERE status IN ('queued', 'processing')
         ORDER BY submitted_at ASC`
      );

      const recoveredCount = result.rows.length;
      if (recoveredCount === 0) {
        this.logEvent('recovery_completed', { recovered: 0 });
        return 0;
      }

      this.logEvent('recovery_started', { pending: recoveredCount });

      // 恢复每个任务到内存
      for (const row of result.rows) {
        try {
          const job: AnalysisJobInternal = {
            id: row.job_id,
            request: row.request_data as VideoAnalysisRequest,
            useMock: row.use_mock,
            status: row.status as AnalysisJobStatus,
            submittedAt: new Date(row.submitted_at),
            startedAt: row.started_at ? new Date(row.started_at) : undefined
          };

          // 如果任务状态是 processing，重置为 queued（因为服务器重启了）
          if (job.status === 'processing') {
            job.status = 'queued';
            job.startedAt = undefined;
            // 更新数据库状态
            await pool.query(
              `UPDATE analysis_jobs SET status = 'queued', started_at = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE job_id = $1`,
              [job.id]
            );
          }

          this.jobs.set(job.id, job);
          this.jobOrder.push(job.id);

          this.logEvent('job_recovered', {
            jobId: job.id,
            originalStatus: row.status,
            newStatus: job.status
          });
        } catch (error) {
          console.error(`[AnalysisJobQueue] Failed to recover job ${row.job_id}:`, error);
          this.logEvent('job_recovery_failed', {
            jobId: row.job_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      this.logEvent('recovery_completed', {
        recovered: this.jobOrder.length,
        totalPending: recoveredCount
      });

      // 恢复后触发队列处理
      if (this.jobOrder.length > 0) {
        void this.processQueue();
      }

      return this.jobOrder.length;
    } catch (error) {
      console.error('[AnalysisJobQueue] Recovery failed:', error);
      this.logEvent('recovery_failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  private logEvent(event: string, details: Record<string, unknown> = {}) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      activeCount: this.activeCount,
      queued: this.jobOrder.length,
      concurrency: this.concurrency,
      ...details
    };
    console.log(`📊 [AnalysisJobQueue] ${JSON.stringify(payload)}`);
  }
}

export const analysisJobQueue = new AnalysisJobQueue();

