import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

export interface VideoAnalysisRequest {
  video1: string;
  video2: string;
  studentName: string;
  grade: string;
  level: string;
  unit: string;
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
          timeout: 600000, // 10分钟超时（真实AI分析需要更长时间，包括视频下载、转录、分析）
        }
      );

      return response.data;
    } catch (error) {
      console.error('Analysis request failed:', error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNABORTED') {
          // 超时错误
          throw new Error('请求超时（超过10分钟）。可能原因：1) 视频文件太大（建议<50MB） 2) 网络速度慢 3) OpenAI API 响应慢。建议使用较短的视频（3-5分钟）。');
        } else if (axiosError.response) {
          // 服务器返回了错误响应
          const errorData = axiosError.response.data as { error?: string; message?: string; details?: string };
          const status = axiosError.response.status;
          
          // 根据HTTP状态码提供更具体的错误信息
          let errorMessage = errorData.message || errorData.error || '分析失败';
          
          if (status === 400) {
            errorMessage = errorData.message || errorData.error || '请求参数错误。请检查：1) 视频链接是否有效 2) 是否提供了所有必需字段 3) 是否提供了 OpenAI API Key（如需要）';
          } else if (status === 401) {
            errorMessage = 'API Key 无效或缺失。使用真实AI分析需要提供有效的 OpenAI API Key';
          } else if (status === 404) {
            errorMessage = 'API 端点未找到。请检查后端服务是否正常运行';
          } else if (status === 500) {
            // 服务器内部错误，尝试使用服务器返回的详细错误信息
            if (errorData.message && errorData.message !== '分析视频时出错') {
              errorMessage = errorData.message;
            } else {
              errorMessage = '服务器内部错误。可能原因：1) 视频下载失败 2) 视频转录失败 3) AI 分析失败。请查看服务器日志获取详细信息';
            }
          } else if (status === 504) {
            errorMessage = '请求超时。视频下载或AI分析耗时过长，请尝试使用较短的视频（3-5分钟）';
          }
          
          // 如果有详细信息，添加到错误消息中
          if (errorData.details && process.env.NODE_ENV === 'development') {
            errorMessage += `\n详细信息: ${errorData.details}`;
          }
          
          throw new Error(errorMessage);
        } else if (axiosError.request) {
          // 请求已发送但没有收到响应
          throw new Error('服务器无响应。请检查：1) 后端服务是否在运行 2) 端口3001是否可访问 3) 查看浏览器控制台和服务器日志获取详细信息');
        }
      }
      
      throw new Error('分析视频时出错，请稍后重试');
    }
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

