import { v4 as uuidv4 } from 'uuid';
import { VideoAnalysisRequest, VideoAnalysisResponse } from '../types/index.js';
import { AppError, ErrorType } from '../utils/errors.js';
import { VideoAnalysisService } from './videoAnalysisService.js';

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

const DEFAULT_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.ANALYSIS_JOB_CONCURRENCY || '1', 10)
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

  constructor(concurrency: number = DEFAULT_CONCURRENCY) {
    this.concurrency = concurrency;
    this.analysisService = new VideoAnalysisService();
    this.logEvent('queue_initialized', {
      concurrency: this.concurrency,
      estimateMs: DEFAULT_ESTIMATED_DURATION_MS
    });
  }

  enqueue(request: VideoAnalysisRequest, options: EnqueueOptions): AnalysisJobState {
    const job: AnalysisJobInternal = {
      id: uuidv4(),
      request,
      useMock: options.useMock,
      status: 'queued',
      submittedAt: new Date()
    };

    this.jobs.set(job.id, job);
    this.jobOrder.push(job.id);
    this.logEvent('job_enqueued', {
      jobId: job.id,
      studentName: request.studentName,
      queueDepth: this.jobOrder.length,
      useMock: job.useMock
    });
    this.processQueue();
    const state = this.toPublicState(job.id);
    if (!state) {
      throw new Error('Failed to create job state');
    }
    return state;
  }

  getJob(jobId: string) {
    return this.toPublicState(jobId);
  }

  getQueueSize() {
    return this.jobOrder.length;
  }

  getActiveCount() {
    return this.activeCount;
  }

  private async processQueue() {
    if (this.activeCount >= this.concurrency) {
      this.logEvent('worker_saturated', {
        activeCount: this.activeCount,
        concurrency: this.concurrency
      });
      return;
    }

    const nextJobId = this.jobOrder.shift();
    if (!nextJobId) {
      return;
    }

    const job = this.jobs.get(nextJobId);
    if (!job) {
      this.logEvent('job_missing', { jobId: nextJobId });
      this.processQueue();
      return;
    }

    this.activeCount += 1;
    job.status = 'processing';
    job.startedAt = new Date();
    this.logEvent('job_started', {
      jobId: job.id,
      queueDepth: this.jobOrder.length,
      activeCount: this.activeCount,
      useMock: job.useMock
    });

    try {
      job.result = job.useMock
        ? await this.analysisService.analyzeMock(job.request)
        : await this.analysisService.analyzeVideos(job.request);
      job.status = 'completed';
      this.logEvent('job_completed', {
        jobId: job.id,
        durationMs: job.startedAt && job.completedAt
          ? job.completedAt.getTime() - job.startedAt.getTime()
          : undefined
      });
    } catch (error) {
      job.status = 'failed';
      job.error = this.serializeError(error);
      this.logEvent('job_failed', {
        jobId: job.id,
        error: job.error?.message,
        errorType: job.error?.type
      });
    } finally {
      job.completedAt = new Date();
      this.activeCount -= 1;
      this.trackDuration(job);
      this.scheduleCleanup(job.id);
      this.processQueue();
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

    return {
      jobId: job.id,
      status: job.status,
      submittedAt: job.submittedAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      position: this.getPosition(job.id),
      estimatedWaitSeconds: this.getEstimatedWaitSeconds(job.id),
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
    console.log(`📊 [AnalysisJobQueue] ${JSON.stringify(payload)}`);
  }
}

export const analysisJobQueue = new AnalysisJobQueue();

