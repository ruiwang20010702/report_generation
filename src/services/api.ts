import axios, { AxiosError } from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

export type AnalysisJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface AnalysisJobError {
  type?: string;
  message: string;
  userMessage?: string;
  context?: Record<string, unknown>;
}

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
  error?: AnalysisJobError;
}

export interface AnalysisJobEnqueueResponse {
  message: string;
  job: AnalysisJobState;
  pollAfterSeconds: number;
}

export interface VideoAnalysisRequest {
  video1: string;
  video2: string;
  video1Time?: string; // 第一个视频的上课时间
  video2Time?: string; // 第二个视频的上课时间
  studentName: string;
  studentId: string; // 学生ID（必选）
  grade: string;
  level: string;
  unit: string; // 单元（必选）
  apiKey?: string;
  useMockData?: boolean;
  language?: string;
  speakerCount?: number; // 说话人数量（可选，默认3）
  userId?: string; // 用户ID（用于记录报告）
  // 前端特有字段，会在发送请求时映射到 video1Time/video2Time
  date?: string;
  date2?: string;
}

export interface LearningDataMetric {
  trend: "提升" | "下降" | "持平";
  percentage: string;
  analysis: string;
}

export interface ProgressDimension {
  analysis: string;
  example: string;
}

export interface PronunciationExample {
  word: string;
  incorrect: string;
  correct: string;
  type: string;
}

export interface GrammarExample {
  category: string;
  incorrect: string;
  correct: string;
  explanation: string;
}

export interface Suggestion {
  title: string;
  description: string;
}

export interface CostBreakdown {
  transcription: {
    service: string;           // 使用的转录服务（如 "tingwu"）
    video1Duration: number;    // 视频1时长（秒）
    video2Duration: number;    // 视频2时长（秒）
    totalMinutes: number;      // 总转录时长（分钟，向上取整）
    unitPrice: number;         // 单价（元/分钟）
    cost: number;              // 转录成本（元）
    currency: string;          // 货币单位
  };
  aiAnalysis: {
    provider: string;          // AI提供商（如 "GLM"）
    model: string;             // 使用的模型（如 "glm-4-plus"）
    video1Analysis: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
    };
    video2Analysis: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
    };
    comparison: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
    };
    totalTokens: number;       // 总token数
    totalCost: number;         // AI分析总成本（元）
    currency: string;          // 货币单位
  };
  total: {
    cost: number;              // 总成本（元）
    currency: string;          // 货币单位
    breakdown: string;         // 成本明细文本
  };
  timestamp: string;           // 成本计算时间
}

export interface VideoAnalysisResponse {
  studentName: string;
  studentId: string;
  grade: string;
  level: string;
  unit: string;
  learningData: {
    handRaising: LearningDataMetric;
    answerLength: LearningDataMetric;
    completeSentences: LearningDataMetric;
    readingAccuracy: LearningDataMetric;
  };
  progressDimensions: {
    fluency: ProgressDimension;
    confidence: ProgressDimension;
    languageApplication: ProgressDimension;
    sentenceComplexity: ProgressDimension;
  };
  improvementAreas: {
    pronunciation?: {
      overview: string;
      details: string;
      examples: PronunciationExample[];
      persistentIssues?: {
        title: string;
        items: string[];
      };
      suggestions: Suggestion[];
    };
    grammar?: {
      overview: string;
      details: string;
      examples: GrammarExample[];
      suggestions: Suggestion[];
    };
    intonation?: {
      overview: string;
      details: string;
      suggestions: Suggestion[];
    };
  };
  costBreakdown?: CostBreakdown;  // 成本详情（可选）
}

export class VideoAnalysisAPI {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * 检查API健康状态
   */
  async checkHealth(): Promise<{ status: string; timestamp: string; useMock: boolean }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/analysis/health`);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw new Error('无法连接到服务器');
    }
  }

  /**
   * 将分析任务加入后台队列
   */
  async enqueueAnalysis(request: VideoAnalysisRequest): Promise<AnalysisJobEnqueueResponse> {
    try {
      const response = await axios.post<AnalysisJobEnqueueResponse>(
        `${this.baseURL}/api/analysis/analyze`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120000
        }
      );
      return response.data;
    } catch (error) {
      console.error('Analysis enqueue failed:', error);
      return this.handleAxiosError(error, '分析任务排队失败，请稍后重试');
    }
  }

  /**
   * 查询任务状态
   */
  async getAnalysisJob(jobId: string): Promise<AnalysisJobState> {
    try {
      const response = await axios.get<AnalysisJobState>(
        `${this.baseURL}/api/analysis/jobs/${jobId}`,
        {
          timeout: 15000
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Fetch job ${jobId} failed:`, error);
      return this.handleAxiosError(error, '查询分析任务状态失败', {
        statusMessageOverrides: {
          404: '未找到对应的分析任务，请确认 jobId 是否正确或稍后再试'
        },
        timeoutMessage: '查询任务状态超时，请检查网络或稍后重试'
      });
    }
  }

  /**
   * 阻塞等待任务完成（兼容旧的同步调用方式）
   */
  async analyzeVideos(request: VideoAnalysisRequest): Promise<VideoAnalysisResponse> {
    const { job, pollAfterSeconds } = await this.enqueueAnalysis(request);
    if (job.status === 'completed' && job.result) {
      return job.result;
    }
    return this.waitForAnalysisResult(job.jobId, {
      initialDelayMs: Math.max(5000, (pollAfterSeconds || 10) * 1000)
    });
  }

  async waitForAnalysisResult(
    jobId: string,
    options?: {
      initialDelayMs?: number;
      maxDelayMs?: number;
      signal?: AbortSignal;
      onPoll?: (state: AnalysisJobState) => void;
    }
  ): Promise<VideoAnalysisResponse> {
    const delay = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (options?.signal) {
          options.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('分析任务已被取消'));
            },
            { once: true }
          );
        }
      });

    let interval = options?.initialDelayMs ?? 10000;
    const maxDelay = options?.maxDelayMs ?? 60000;

    while (true) {
      await delay(interval);
      const job = await this.getAnalysisJob(jobId);
      options?.onPoll?.(job);

      if (job.status === 'completed' && job.result) {
        return job.result;
      }
      if (job.status === 'failed') {
        throw new Error(job.error?.userMessage || job.error?.message || '分析任务失败，请稍后重试');
      }

      const estimatedMs =
        job.estimatedWaitSeconds > 0 ? job.estimatedWaitSeconds * 1000 : interval * 1.2;
      interval = Math.min(maxDelay, Math.max(5000, Math.round(estimatedMs / 2)));
    }
  }

  private handleAxiosError(
    error: unknown,
    defaultMessage: string,
    options?: {
      statusMessageOverrides?: Record<number, string>;
      timeoutMessage?: string;
    }
  ): never {
      if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string; details?: string }>;
        
        if (axiosError.code === 'ECONNABORTED') {
        throw new Error(
          options?.timeoutMessage ||
            '请求超时（超过10分钟）。可能原因：1) 视频文件太大（建议<50MB） 2) 网络速度慢 3) AI 服务响应慢。建议使用较短的视频（3-5分钟）。'
        );
        } else if (axiosError.response) {
        const errorData = axiosError.response.data || {};
          const status = axiosError.response.status;
          
        let errorMessage =
          options?.statusMessageOverrides?.[status] ||
          errorData.message ||
          errorData.error ||
          defaultMessage;
          
        if (status === 400 && !options?.statusMessageOverrides?.[status]) {
          errorMessage =
            errorData.message ||
            errorData.error ||
            '请求参数错误。请检查：1) 视频链接是否有效 2) 是否提供了所有必需字段 3) 是否提供了必要的 API Key（如需要）';
        } else if (status === 401 && !options?.statusMessageOverrides?.[status]) {
          errorMessage = 'API Key 无效或缺失。使用真实AI分析需要提供有效的 GLM API Key';
        } else if (status === 404 && !options?.statusMessageOverrides?.[status]) {
            errorMessage = 'API 端点未找到。请检查后端服务是否正常运行';
        } else if (status === 500 && !options?.statusMessageOverrides?.[status]) {
          errorMessage =
            errorData.message && errorData.message !== '分析视频时出错'
              ? errorData.message
              : '服务器内部错误。可能原因：1) 视频下载失败 2) 视频转录失败 3) AI 分析失败。请查看服务器日志获取详细信息';
        } else if (status === 504 && !options?.statusMessageOverrides?.[status]) {
            errorMessage = '请求超时。视频下载或AI分析耗时过长，请尝试使用较短的视频（3-5分钟）';
          }
          
        if (errorData.details && import.meta.env.DEV) {
            errorMessage += `\n详细信息: ${errorData.details}`;
          }
          
          throw new Error(errorMessage);
        } else if (axiosError.request) {
        throw new Error(
          '服务器无响应。请检查：1) 后端服务是否在运行 2) 端口3001是否可访问 3) 查看浏览器控制台和服务器日志获取详细信息'
        );
        }
      }
      
    throw new Error(defaultMessage);
  }

  /**
   * 通过 ID 获取保存的报告
   */
  async getReport(id: string): Promise<any> {
    try {
      console.log('Fetching report from:', `${this.baseURL}/api/analysis/report/${id}`);
      
      const response = await axios.get(
        `${this.baseURL}/api/analysis/report/${id}`,
        {
          timeout: 10000, // 10秒超时
        }
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      } else {
        throw new Error('报告数据格式错误');
      }
    } catch (error) {
      console.error('Get report request failed:', error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 404) {
          throw new Error('未找到该报告');
        } else if (axiosError.response) {
          const errorData = axiosError.response.data as { error?: string; message?: string };
          throw new Error(errorData.error || errorData.message || '获取报告失败');
        } else if (axiosError.request) {
          throw new Error('服务器无响应');
        }
      }
      
      throw new Error('获取报告时出错，请稍后重试');
    }
  }
}

// 导出默认实例
export const videoAnalysisAPI = new VideoAnalysisAPI();

