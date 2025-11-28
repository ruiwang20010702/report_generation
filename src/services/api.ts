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
  waitedSeconds?: number;  // 实际排队等待时长（秒），任务开始处理后才有值
  durationSeconds?: number;
  result?: VideoAnalysisResponse;
  error?: AnalysisJobError;
}

export interface AnalysisJobEnqueueResponse {
  message: string;
  job: AnalysisJobState;
  pollAfterSeconds: number;
}

// 解读报告任务状态
export type InterpretationJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface InterpretationJobError {
  type?: string;
  message: string;
  userMessage?: string;
}

export interface InterpretationJobResult {
  interpretation: SpeechContent;
  fromCache: boolean;
  cost?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    model: string;
    currency: string;
  };
}

export interface InterpretationJobState {
  jobId: string;
  status: InterpretationJobStatus;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  position: number;
  estimatedWaitSeconds: number;
  durationSeconds?: number;
  result?: InterpretationJobResult;
  error?: InterpretationJobError;
}

export interface InterpretationJobEnqueueResponse {
  success: boolean;
  message: string;
  job: InterpretationJobState;
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
  performanceSummary?: string;
}

// 学习建议结构（完整段落形式）
export interface LearningRecommendation {
  content: string;            // 完整的建议段落，由AI直接生成
}

export interface SpeechContent {
  title: string;
  estimatedDuration: number;  // 仅统计 sections 的时长，不包含学习建议
  sections: {
    title: string;
    content: string;
    duration: number;
    notes?: string;
  }[];
  learningRecommendations?: LearningRecommendation[];  // 学习建议（独立模块）
  keyPoints: string[];
  cautions: string[];
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
  overallSuggestions: Suggestion[];  // 3条综合性的整体学习建议
  costBreakdown?: CostBreakdown;  // 成本详情（可选）
  reportId?: string;
  generatedAt?: string;
}

export interface SavedReportSummary {
  id: string;
  studentId?: string | null;
  studentName?: string | null;
  grade?: string | null;
  level?: string | null;
  unit?: string | null;
  costDetail?: CostBreakdown | null;
  createdAt: string;
}

export interface ReportListResponse {
  success: boolean;
  data: SavedReportSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class VideoAnalysisAPI {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private getAuthHeaders() {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const token = window.localStorage.getItem('auth_token');
      return token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {};
    } catch (error) {
      console.warn('Failed to read auth token from storage:', error);
      return {};
    }
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
  async getReport(id: string): Promise<VideoAnalysisResponse> {
    try {
      const response = await axios.get<{
        success: boolean;
        data?: { report: VideoAnalysisResponse };
      }>(
        `${this.baseURL}/api/analysis/report/${id}`,
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
          timeout: 10000, // 10秒超时
        }
      );

      if (response.data.success && response.data.data?.report) {
        return response.data.data.report;
      }

        throw new Error('报告数据格式错误');
    } catch (error) {
      console.error('Get report request failed:', error);
      return this.handleAxiosError(error, '获取报告失败', {
        statusMessageOverrides: {
          404: '未找到该报告，请确认链接是否正确',
        },
      });
    }
  }

  /**
   * 获取历史报告列表
   */
  async listReports(params: { page?: number; limit?: number; studentId?: string } = {}): Promise<ReportListResponse> {
    try {
      const response = await axios.get<ReportListResponse>(
        `${this.baseURL}/api/analysis/reports`,
        {
          params,
          headers: this.getAuthHeaders(),
          withCredentials: true,
          timeout: 10000,
        }
      );

      if (!response.data.success) {
        throw new Error('获取历史报告失败');
      }

      return response.data;
    } catch (error) {
      console.error('List reports request failed:', error);
      return this.handleAxiosError(error, '获取历史报告失败', {
        statusMessageOverrides: {
          401: '登录状态已失效，请重新登录后再试',
        },
      });
    }
  }

  /**
   * 更新已保存的报告内容
   */
  async updateReport(reportId: string, report: VideoAnalysisResponse): Promise<void> {
    try {
      await axios.put(
        `${this.baseURL}/api/analysis/report/${reportId}`,
        { report },
        {
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          withCredentials: true,
          timeout: 15000,
        }
      );
    } catch (error) {
      console.error(`Update report ${reportId} failed:`, error);
      return this.handleAxiosError(error, '保存报告失败，请稍后再试', {
        statusMessageOverrides: {
          401: '登录状态已失效，请重新登录后再试',
          404: '未找到报告或无权限保存该报告',
        },
      });
    }
  }
  /**
   * 生成解读版报告
   * @param reportData 报告数据
   * @param options.reportId 报告ID（用于缓存）
   * @param options.forceRegenerate 是否强制重新生成
   * @returns 解读版内容和是否来自缓存
   */
  async generateInterpretation(
    reportData: VideoAnalysisResponse,
    options?: { reportId?: string; forceRegenerate?: boolean }
  ): Promise<{ interpretation: SpeechContent; fromCache: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/analysis/generate-interpretation`,
        { 
          reportData,
          reportId: options?.reportId,
          forceRegenerate: options?.forceRegenerate,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          withCredentials: true,
          timeout: 120000, // AI 生成可能较慢，给 2 分钟超时
        }
      );

      if (response.data.success) {
        return {
          interpretation: response.data.data.interpretation,
          fromCache: response.data.data.fromCache ?? false,
        };
      }
      
      throw new Error('生成解读版失败');
    } catch (error) {
      console.error('Generate interpretation failed:', error);
      return this.handleAxiosError(error, '生成解读版报告失败，请稍后重试');
    }
  }

  /**
   * 保存编辑后的解读报告
   * @param reportId 报告ID
   * @param interpretation 编辑后的解读内容
   */
  async saveInterpretation(
    reportId: string,
    interpretation: SpeechContent
  ): Promise<void> {
    try {
      const response = await axios.put(
        `${this.baseURL}/api/analysis/interpretation/${reportId}`,
        { interpretation },
        {
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          withCredentials: true,
          timeout: 10000,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || '保存解读报告失败');
      }
    } catch (error) {
      console.error('Save interpretation failed:', error);
      return this.handleAxiosError(error, '保存解读报告失败，请稍后重试');
    }
  }

  /**
   * 异步生成解读报告 - 将任务加入队列
   * @param reportData 报告数据
   * @param options.reportId 报告ID（用于缓存）
   * @param options.forceRegenerate 是否强制重新生成
   * @returns 任务状态和建议的轮询间隔
   */
  async enqueueInterpretation(
    reportData: VideoAnalysisResponse,
    options?: { reportId?: string; forceRegenerate?: boolean }
  ): Promise<InterpretationJobEnqueueResponse> {
    try {
      const response = await axios.post<InterpretationJobEnqueueResponse>(
        `${this.baseURL}/api/analysis/interpretation/enqueue`,
        {
          reportData,
          reportId: options?.reportId,
          forceRegenerate: options?.forceRegenerate,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          withCredentials: true,
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Enqueue interpretation failed:', error);
      return this.handleAxiosError(error, '提交解读报告生成任务失败，请稍后重试');
    }
  }

  /**
   * 查询解读报告生成任务状态
   * @param jobId 任务ID
   * @returns 任务状态
   */
  async getInterpretationJob(jobId: string): Promise<InterpretationJobState> {
    try {
      const response = await axios.get<InterpretationJobState>(
        `${this.baseURL}/api/analysis/interpretation/jobs/${jobId}`,
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Get interpretation job failed:', error);
      return this.handleAxiosError(error, '查询解读报告任务状态失败');
    }
  }

  /**
   * 等待解读报告生成完成（轮询方式）
   * @param jobId 任务ID
   * @param options.pollIntervalMs 轮询间隔（默认15秒）
   * @param options.maxWaitMs 最大等待时间（默认5分钟）
   * @param options.signal AbortSignal 用于取消
   * @param options.onPoll 每次轮询时的回调
   */
  async waitForInterpretationResult(
    jobId: string,
    options?: {
      pollIntervalMs?: number;
      maxWaitMs?: number;
      signal?: AbortSignal;
      onPoll?: (state: InterpretationJobState) => void;
    }
  ): Promise<InterpretationJobResult> {
    const pollIntervalMs = options?.pollIntervalMs ?? 15000; // 默认15秒
    const maxWaitMs = options?.maxWaitMs ?? 300000; // 默认5分钟
    const startTime = Date.now();

    const delay = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('已取消'));
          });
        }
      });

    while (true) {
      if (options?.signal?.aborted) {
        throw new Error('已取消');
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > maxWaitMs) {
        throw new Error('等待超时，请稍后重试');
      }

      const state = await this.getInterpretationJob(jobId);
      options?.onPoll?.(state);

      if (state.status === 'completed' && state.result) {
        return state.result;
      }

      if (state.status === 'failed') {
        throw new Error(state.error?.userMessage || state.error?.message || '生成失败');
      }

      await delay(pollIntervalMs);
    }
  }
}

// 导出默认实例
export const videoAnalysisAPI = new VideoAnalysisAPI();

