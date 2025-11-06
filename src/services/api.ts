import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface VideoAnalysisRequest {
  video1: string;
  video2: string;
  studentName: string;
  grade: string;
  level: string;
  unit: string;
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
  sentence: string;
  error: string;
  correction: string;
  rule: string;
}

export interface IntonationExample {
  sentence: string;
  issue: string;
  improvement: string;
}

export interface Suggestion {
  title?: string;
  description?: string;
  point?: string;
}

export interface VideoAnalysisResponse {
  studentName: string;
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
      examples: IntonationExample[];
      suggestions: Suggestion[];
    };
  };
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
   * 分析视频
   */
  async analyzeVideos(request: VideoAnalysisRequest): Promise<VideoAnalysisResponse> {
    try {
      console.log('Sending analysis request to:', `${this.baseURL}/api/analysis/analyze`);
      
      const response = await axios.post<VideoAnalysisResponse>(
        `${this.baseURL}/api/analysis/analyze`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5分钟超时（真实AI分析需要更长时间）
        }
      );

      return response.data;
    } catch (error) {
      console.error('Analysis request failed:', error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNABORTED') {
          // 超时错误
          throw new Error('请求超时（超过5分钟）。可能原因：1) 视频文件太大 2) 网络速度慢 3) OpenAI API 响应慢。建议使用较短的视频（3-5分钟）。');
        } else if (axiosError.response) {
          // 服务器返回了错误响应
          const errorData = axiosError.response.data as { error?: string; message?: string };
          throw new Error(errorData.error || errorData.message || '分析失败');
        } else if (axiosError.request) {
          // 请求已发送但没有收到响应
          throw new Error('服务器无响应。请检查：1) 后端服务是否在运行 2) 端口3001是否可访问 3) 查看浏览器控制台和服务器日志获取详细信息');
        }
      }
      
      throw new Error('分析视频时出错，请稍后重试');
    }
  }
}

// 导出默认实例
export const videoAnalysisAPI = new VideoAnalysisAPI();

