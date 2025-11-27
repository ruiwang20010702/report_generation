import { v4 as uuidv4 } from 'uuid';
import { AppError, ErrorType } from '../utils/errors.js';
import { interpretationService, SpeechContent, ReportDataForInterpretation, InterpretationCost } from './interpretationService.js';
import { reportRecordService } from './reportRecordService.js';
import { createLogger } from '../utils/logger.js';

// 创建模块专用日志器
const log = createLogger('InterpretationJobQueue');

export type InterpretationJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface InterpretationJobState {
  jobId: string;
  status: InterpretationJobStatus;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  position: number;
  estimatedWaitSeconds: number;
  durationSeconds?: number;
  result?: {
    interpretation: SpeechContent;
    fromCache: boolean;
    cost?: InterpretationCost;
  };
  error?: {
    type?: ErrorType;
    message: string;
    userMessage?: string;
  };
}

interface InterpretationJobInternal {
  id: string;
  reportData: ReportDataForInterpretation;
  reportId?: string;
  forceRegenerate: boolean;
  status: InterpretationJobStatus;
  submittedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: InterpretationJobState['result'];
  error?: InterpretationJobState['error'];
}

// 默认并发数：解读报告生成相对较轻量，可以支持较高并发
const DEFAULT_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.INTERPRETATION_JOB_CONCURRENCY || '20', 10)
);

// 默认预估时长：解读报告生成通常需要30-60秒
const DEFAULT_ESTIMATED_DURATION_MS = Math.max(
  30_000,
  Number.parseInt(process.env.INTERPRETATION_JOB_ESTIMATE_MS || '45000', 10)
);

export class InterpretationJobQueue {
  private readonly jobs: Map<string, InterpretationJobInternal> = new Map();
  private readonly jobOrder: string[] = [];
  private activeCount = 0;
  private readonly concurrency: number;
  private recentDurations: number[] = [];
  // Promise 链用于串行化 processQueue 调用
  private processQueueChain: Promise<void> = Promise.resolve();

  constructor(concurrency: number = DEFAULT_CONCURRENCY) {
    this.concurrency = concurrency;
    this.logEvent('queue_initialized', {
      concurrency: this.concurrency,
      estimateMs: DEFAULT_ESTIMATED_DURATION_MS
    });
  }

  /**
   * 将解读报告生成任务加入队列
   */
  async enqueue(
    reportData: ReportDataForInterpretation,
    options?: { reportId?: string; forceRegenerate?: boolean }
  ): Promise<{ job: InterpretationJobState; pollAfterSeconds: number }> {
    const reportId = options?.reportId;
    const forceRegenerate = options?.forceRegenerate === true;

    // 如果有 reportId 且不是强制重新生成，先检查缓存
    if (reportId && !forceRegenerate) {
      const cachedInterpretation = await reportRecordService.getInterpretation(reportId);
      if (cachedInterpretation) {
        console.log(`✅ [InterpretationJobQueue] 使用缓存的解读版数据`);
        // 直接返回已完成状态
        const jobId = uuidv4();
        return {
          job: {
            jobId,
            status: 'completed',
            submittedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            position: 0,
            estimatedWaitSeconds: 0,
            durationSeconds: 0,
            result: {
              interpretation: cachedInterpretation,
              fromCache: true,
            },
          },
          pollAfterSeconds: 0,
        };
      }
      console.log(`   [InterpretationJobQueue] 未找到缓存，将入队生成`);
    }

    const job: InterpretationJobInternal = {
      id: uuidv4(),
      reportData,
      reportId,
      forceRegenerate,
      status: 'queued',
      submittedAt: new Date()
    };

    this.jobs.set(job.id, job);
    this.jobOrder.push(job.id);

    this.logEvent('job_enqueued', {
      jobId: job.id,
      studentName: reportData.studentName,
      reportId,
      forceRegenerate,
      queueDepth: this.jobOrder.length,
    });

    // 触发队列处理
    void this.processQueue();

    const state = this.toPublicState(job.id);
    if (!state) {
      throw new Error('Failed to create job state');
    }

    // 计算建议的轮询间隔（15秒）
    const pollAfterSeconds = 15;

    return { job: state, pollAfterSeconds };
  }

  /**
   * 获取任务状态
   */
  async getJob(jobId: string): Promise<InterpretationJobState | null> {
    return this.toPublicState(jobId);
  }

  getQueueSize() {
    return this.jobOrder.length;
  }

  getActiveCount() {
    return this.activeCount;
  }

  /**
   * 处理队列中的任务
   */
  private processQueue(): Promise<void> {
    this.processQueueChain = this.processQueueChain.then(async () => {
      await this.processQueueInternal();
    }).catch((error) => {
      console.error('[InterpretationJobQueue] processQueue error:', error);
    });
    return this.processQueueChain;
  }

  /**
   * 内部队列处理逻辑
   */
  private async processQueueInternal(): Promise<void> {
    while (this.activeCount < this.concurrency && this.jobOrder.length > 0) {
      const nextJobId = this.jobOrder.shift();
      if (!nextJobId) {
        break;
      }

      const job = this.jobs.get(nextJobId);
      if (!job) {
        this.logEvent('job_missing', { jobId: nextJobId });
        continue;
      }

      this.activeCount += 1;
      job.status = 'processing';
      job.startedAt = new Date();

      this.logEvent('job_started', {
        jobId: job.id,
        studentName: job.reportData.studentName,
        queueDepth: this.jobOrder.length,
        activeCount: this.activeCount,
      });

      // 异步处理任务
      this.processJob(job).catch((error) => {
        console.error(`[InterpretationJobQueue] Unexpected error in job ${job.id}:`, error);
      });
    }

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
   */
  private async processJob(job: InterpretationJobInternal): Promise<void> {
    try {
      const result = await interpretationService.generateInterpretation(job.reportData);

      job.result = {
        interpretation: result.content,
        fromCache: false,
        cost: result.cost,
      };
      job.status = 'completed';
      job.completedAt = new Date();

      // 如果有 reportId，保存到缓存
      if (job.reportId) {
        await reportRecordService.saveInterpretation(job.reportId, result.content, result.cost);
      }

      const durationMs = job.startedAt && job.completedAt
        ? job.completedAt.getTime() - job.startedAt.getTime()
        : undefined;
      const durationFormatted = durationMs !== undefined
        ? this.formatDuration(durationMs)
        : undefined;

      this.logEvent('job_completed', {
        jobId: job.id,
        studentName: job.reportData.studentName,
        durationMs,
        durationFormatted
      });

      console.log(`✅ [InterpretationJobQueue] 解读报告生成完成！总用时: ${durationFormatted || '未知'} (jobId: ${job.id})`);
    } catch (error) {
      job.status = 'failed';
      job.error = this.serializeError(error);
      job.completedAt = new Date();

      this.logEvent('job_failed', {
        jobId: job.id,
        studentName: job.reportData.studentName,
        error: job.error?.message,
        errorType: job.error?.type
      });
    } finally {
      this.activeCount -= 1;
      this.trackDuration(job);
      this.scheduleCleanup(job.id);
      void this.processQueue();
    }
  }

  private serializeError(error: unknown): InterpretationJobState['error'] {
    if (error instanceof AppError) {
      return {
        type: error.type,
        message: error.technicalMessage,
        userMessage: error.userMessage,
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

  private trackDuration(job: InterpretationJobInternal) {
    if (job.startedAt && job.completedAt) {
      const durationMs = job.completedAt.getTime() - job.startedAt.getTime();
      this.recentDurations = [...this.recentDurations, durationMs].slice(-20);
    }
  }

  private scheduleCleanup(jobId: string) {
    // 解读报告任务保留1小时
    const ttlMs = Number.parseInt(process.env.INTERPRETATION_JOB_TTL_MS || '3600000', 10);
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
    return Math.max(15_000, Math.round(total / this.recentDurations.length));
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

  private getDurationSeconds(job: InterpretationJobInternal) {
    if (job.startedAt && job.completedAt) {
      return Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
    }
    return undefined;
  }

  private toPublicState(jobId: string): InterpretationJobState | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

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

  private logEvent(event: string, details: Record<string, unknown> = {}) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      activeCount: this.activeCount,
      queued: this.jobOrder.length,
      concurrency: this.concurrency,
      ...details
    };
    console.log(`📊 [InterpretationJobQueue] ${JSON.stringify(payload)}`);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  }
}

export const interpretationJobQueue = new InterpretationJobQueue();

