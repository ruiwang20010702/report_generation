/**
 * 阿里云语音转录服务
 * 文档：https://help.aliyun.com/document_detail/90727.html
 * 
 * 优势：
 * - ✅ 国内访问速度快，无需VPN
 * - ✅ 每月免费额度：2小时（120分钟）
 * - ✅ 支持说话人分离（区分老师和学生）
 * - ✅ 价格便宜：¥0.25/分钟（约$0.035）
 * - ✅ 支持英语识别
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface TranscriptionResult {
  text: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: string;
  }>;
  utterances?: Array<{
    text: string;
    start: number;
    end: number;
    speaker: string;
  }>;
  duration?: number;
  language?: string;
}

interface AliyunConfig {
  accessKeyId: string;
  accessKeySecret: string;
  appKey: string;
}

interface TranscriptionProgress {
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
}

class AliyunTranscriptionService {
  private config: AliyunConfig | null = null;
  private client: AxiosInstance;
  private readonly API_ENDPOINT = 'https://nls-filetrans.cn-shanghai.aliyuncs.com';
  
  // 使用量追踪
  private stats = {
    freeMinutesLimit: 120, // 每月2小时
    totalMinutesUsed: 0,
    remainingMinutes: 120,
    resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), // 下月1号
  };

  constructor() {
    // 从环境变量读取配置
    const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
    const appKey = process.env.ALIYUN_NLS_APP_KEY;

    if (accessKeyId && accessKeySecret && appKey) {
      this.config = { accessKeyId, accessKeySecret, appKey };
      console.log('✅ 阿里云语音服务已初始化');
      console.log(`💰 当前剩余免费额度: ${this.stats.remainingMinutes} 分钟`);
    } else {
      console.log('⚠️  阿里云语音服务未配置（将使用 Whisper 备用）');
    }

    this.client = axios.create({
      baseURL: this.API_ENDPOINT,
      timeout: 300000, // 5分钟超时
    });
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.config !== null && this.hasRemainingQuota();
  }

  /**
   * 检查是否还有剩余额度
   */
  hasRemainingQuota(): boolean {
    return this.stats.remainingMinutes > 0;
  }

  /**
   * 获取使用量统计
   */
  getStats() {
    return {
      ...this.stats,
      usagePercentage: Math.round(
        (this.stats.totalMinutesUsed / this.stats.freeMinutesLimit) * 100
      ),
    };
  }

  /**
   * 更新使用量统计
   */
  private updateStats(durationInSeconds: number) {
    const minutes = Math.ceil(durationInSeconds / 60);
    this.stats.totalMinutesUsed += minutes;
    this.stats.remainingMinutes = Math.max(
      0,
      this.stats.freeMinutesLimit - this.stats.totalMinutesUsed
    );
  }

  /**
   * 生成阿里云API签名
   */
  private generateSignature(params: Record<string, string>): string {
    if (!this.config) {
      throw new Error('阿里云配置未初始化');
    }

    // 1. 按字典序排序参数
    const sortedKeys = Object.keys(params).sort();
    const canonicalizedQueryString = sortedKeys
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    // 2. 构造待签名字符串
    const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(canonicalizedQueryString)}`;

    // 3. 计算签名
    const hmac = crypto.createHmac('sha1', this.config.accessKeySecret + '&');
    const signature = hmac.update(stringToSign).digest('base64');

    return signature;
  }

  /**
   * 提交转录任务
   */
  private async submitTask(fileUrl: string, options: {
    language?: string;
    enableSpeakerDiarization?: boolean;
  }): Promise<string> {
    if (!this.config) {
      throw new Error('阿里云配置未初始化');
    }

    const timestamp = new Date().toISOString();
    const nonce = uuidv4();

    const params: Record<string, string> = {
      AccessKeyId: this.config.accessKeyId,
      Action: 'SubmitTask',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: nonce,
      SignatureVersion: '1.0',
      Timestamp: timestamp,
      Version: '2018-08-17',
      
      // 转录参数
      AppKey: this.config.appKey,
      FileLink: fileUrl,
      
      // 英语识别
      ...(options.language === 'en' && { 
        Task: JSON.stringify({
          language: 'en-US',
          ...(options.enableSpeakerDiarization && {
            auto_split: true, // 自动分句
            max_num_speaker: 2, // 最多2个说话人（老师+学生）
          })
        })
      }),
    };

    // 生成签名
    const signature = this.generateSignature(params);
    params.Signature = signature;

    try {
      const response = await this.client.post('/', null, { params });
      
      if (response.data.StatusCode !== 21050000) {
        throw new Error(`提交任务失败: ${response.data.StatusText}`);
      }

      const taskId = response.data.TaskId;
      console.log(`✅ 阿里云转录任务已提交，TaskId: ${taskId}`);
      
      return taskId;
    } catch (error: any) {
      console.error('❌ 提交阿里云转录任务失败:', error.message);
      throw new Error(`提交转录任务失败: ${error.message}`);
    }
  }

  /**
   * 查询任务状态
   */
  private async queryTaskStatus(taskId: string): Promise<any> {
    if (!this.config) {
      throw new Error('阿里云配置未初始化');
    }

    const timestamp = new Date().toISOString();
    const nonce = uuidv4();

    const params: Record<string, string> = {
      AccessKeyId: this.config.accessKeyId,
      Action: 'GetTaskResult',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: nonce,
      SignatureVersion: '1.0',
      Timestamp: timestamp,
      Version: '2018-08-17',
      TaskId: taskId,
    };

    const signature = this.generateSignature(params);
    params.Signature = signature;

    const response = await this.client.get('/', { params });
    return response.data;
  }

  /**
   * 轮询等待转录完成
   */
  private async pollTaskCompletion(
    taskId: string,
    onProgress?: (progress: TranscriptionProgress) => void
  ): Promise<any> {
    const maxAttempts = 60; // 最多等待5分钟（每5秒查询一次）
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒

      const result = await this.queryTaskStatus(taskId);
      const statusCode = result.StatusCode;

      // 21050002: 任务运行中
      if (statusCode === 21050002) {
        attempts++;
        const progress = Math.min(Math.round((attempts / maxAttempts) * 100), 95);
        
        if (onProgress) {
          onProgress({
            status: 'processing',
            progress,
          });
        }
        
        console.log(`⏳ 转录进行中... (${progress}%)`);
        continue;
      }

      // 21050000: 任务成功
      if (statusCode === 21050000) {
        console.log('✅ 转录任务完成！');
        
        if (onProgress) {
          onProgress({
            status: 'completed',
            progress: 100,
          });
        }
        
        return result;
      }

      // 其他状态码：任务失败
      console.error(`❌ 转录任务失败，状态码: ${statusCode}，消息: ${result.StatusText}`);
      throw new Error(`转录失败: ${result.StatusText}`);
    }

    throw new Error('转录任务超时（5分钟）');
  }

  /**
   * 解析阿里云返回的转录结果
   */
  private parseTranscriptionResult(result: any): TranscriptionResult {
    try {
      const resultData = JSON.parse(result.Result);
      const sentences = resultData.Sentences || [];
      
      // 组合完整文本
      const fullText = sentences
        .map((s: any) => s.Text)
        .join(' ');

      // 解析词级别信息
      const words: any[] = [];
      const utterances: any[] = [];
      
      sentences.forEach((sentence: any) => {
        const sentenceWords = sentence.Words || [];
        
        sentenceWords.forEach((word: any) => {
          words.push({
            text: word.Word,
            start: word.BeginTime / 1000, // 转换为秒
            end: word.EndTime / 1000,
            confidence: 0.95, // 阿里云不提供置信度，给个默认值
            speaker: word.ChannelId ? `Speaker ${word.ChannelId}` : undefined,
          });
        });

        // 构建utterances（按说话人分组的句子）
        if (sentence.ChannelId !== undefined) {
          utterances.push({
            text: sentence.Text,
            start: sentence.BeginTime / 1000,
            end: sentence.EndTime / 1000,
            speaker: `Speaker ${sentence.ChannelId}`,
          });
        }
      });

      // 更新使用量统计
      const duration = resultData.StatusText?.match(/\d+/)?.[0];
      if (duration) {
        this.updateStats(parseFloat(duration));
      }

      return {
        text: fullText,
        words: words.length > 0 ? words : undefined,
        utterances: utterances.length > 0 ? utterances : undefined,
        duration: duration ? parseFloat(duration) : undefined,
        language: 'en',
      };
    } catch (error: any) {
      console.error('❌ 解析转录结果失败:', error);
      throw new Error(`解析转录结果失败: ${error.message}`);
    }
  }

  /**
   * 从URL转录视频（主入口方法）
   */
  async transcribeFromURL(
    videoUrl: string,
    options: {
      language?: string;
      speakerLabels?: boolean;
      onProgress?: (progress: TranscriptionProgress) => void;
    } = {}
  ): Promise<TranscriptionResult> {
    if (!this.isAvailable()) {
      throw new Error('阿里云语音服务不可用（未配置或额度已用完）');
    }

    try {
      console.log('🎯 使用阿里云语音服务转录:', videoUrl);
      console.log(`💰 当前剩余免费额度: ${this.stats.remainingMinutes} 分钟`);

      // 1. 提交转录任务
      const taskId = await this.submitTask(videoUrl, {
        language: options.language || 'en',
        enableSpeakerDiarization: options.speakerLabels || false,
      });

      // 2. 轮询等待完成
      const result = await this.pollTaskCompletion(taskId, options.onProgress);

      // 3. 解析结果
      const transcription = this.parseTranscriptionResult(result);

      console.log('✅ 阿里云转录成功！');
      console.log(`💰 更新后剩余额度: ${this.stats.remainingMinutes} 分钟`);

      return transcription;
    } catch (error: any) {
      console.error('❌ 阿里云转录失败:', error);
      
      // 检查是否是额度错误
      if (error.message?.includes('quota') || error.message?.includes('额度')) {
        this.stats.remainingMinutes = 0;
      }
      
      throw new Error(`阿里云转录失败: ${error.message}`);
    }
  }

  /**
   * 带进度回调的转录（支持实时进度更新）
   */
  async transcribeWithProgress(
    videoUrl: string,
    onProgress: (progress: TranscriptionProgress) => void
  ): Promise<TranscriptionResult> {
    return this.transcribeFromURL(videoUrl, {
      language: 'en',
      speakerLabels: true,
      onProgress,
    });
  }
}

// 导出单例
export const aliyunTranscriptionService = new AliyunTranscriptionService();

