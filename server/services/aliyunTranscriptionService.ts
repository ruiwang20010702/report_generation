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

// ⚠️ 必须先加载环境变量，再初始化服务
import dotenv from 'dotenv';
dotenv.config();

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
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

    // 配置 HTTPS Agent，优化 TLS 连接
    // ⚠️ 重要：阿里云是中国服务，不应该使用VPN代理
    // 如果VPN设置了系统代理，可能会导致TLS握手失败
    let httpsAgent: https.Agent | any;
    
    // 检查是否有代理配置
    const proxyUrl = process.env.ALIYUN_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const allowProxy = process.env.ALIYUN_ALLOW_PROXY === 'true';
    const rejectUnauthorized = process.env.ALIYUN_REJECT_UNAUTHORIZED !== 'false';
    
    if (proxyUrl && allowProxy) {
      console.log('🌐 阿里云服务将通过代理连接');
      httpsAgent = new HttpsProxyAgent(proxyUrl);
    } else {
      if (proxyUrl && !allowProxy) {
        console.warn('⚠️  检测到代理配置，但已设置为强制直连阿里云（ALIYUN_ALLOW_PROXY!=true）');
        console.warn('   如果遇到连接问题，可以设置环境变量 ALIYUN_ALLOW_PROXY=true 以启用代理');
      }
      
      // 强制使用直连配置（不使用代理）
      httpsAgent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000, // 连接超时60秒
        // TLS 配置 - 使用更宽松的设置以提高兼容性
        rejectUnauthorized, // 验证证书（生产环境应保持 true，除非显式禁用）
        minVersion: 'TLSv1.2', // 最低 TLS 1.2
        maxVersion: 'TLSv1.3', // 最高 TLS 1.3
        // 移除限制性的 cipher 列表，让 Node.js 使用默认的兼容 cipher 套件
      });
      
      console.log('🌐 阿里云服务将使用直连（不使用代理）');
      if (!rejectUnauthorized) {
        console.warn('⚠️  已禁用 TLS 证书校验（ALIYUN_REJECT_UNAUTHORIZED=false），仅建议在调试环境使用');
      }
    }

    this.client = axios.create({
      baseURL: this.API_ENDPOINT,
      timeout: 300000, // 5分钟超时
      // 优化网络连接配置
      httpsAgent: httpsAgent,
      // 增加重试配置
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // 不抛出4xx错误，只抛出5xx
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
   * 带重试的网络请求
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 2000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        // 检查是否是网络错误（TLS连接失败、超时等）
        // axios 错误可能在不同位置：error.code, error.message, error.request
        const errorMessage = error.message || error.toString() || '';
        const errorCode = error.code || '';
        
        const isNetworkError = 
          errorCode === 'ECONNRESET' ||
          errorCode === 'ETIMEDOUT' ||
          errorCode === 'ENOTFOUND' ||
          errorCode === 'ECONNREFUSED' ||
          errorCode === 'ESOCKETTIMEDOUT' ||
          errorCode === 'ECONNABORTED' ||
          errorCode === 'EPROTO' || // TLS 协议错误
          errorCode === 'ERR_TLS_HANDSHAKE_TIMEOUT' || // TLS 握手超时
          errorMessage.includes('socket disconnected') ||
          errorMessage.includes('TLS connection') ||
          errorMessage.includes('secure TLS connection') ||
          errorMessage.includes('TLS handshake') ||
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('before secure TLS') ||
          // axios 特定错误：没有响应（网络问题）
          (error.request && !error.response);
        
        if (isNetworkError && attempt < maxRetries) {
          const delay = retryDelay * attempt; // 指数退避
          console.log(`⚠️  网络连接失败（尝试 ${attempt}/${maxRetries}），${delay}ms 后重试...`);
          console.log(`   错误信息: ${errorMessage || errorCode}`);
          
          // 如果是TLS握手失败，提供VPN相关提示
          if (errorMessage.includes('before secure TLS') || errorMessage.includes('TLS handshake') || errorCode === 'EPROTO') {
            console.log('   💡 提示: 如果使用了VPN，TLS握手失败可能是VPN代理导致的');
            console.log('      阿里云是中国服务，建议关闭VPN或配置NO_PROXY排除阿里云域名');
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 如果不是网络错误，或者已经达到最大重试次数，直接抛出
        throw error;
      }
    }
    
    throw lastError;
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
      // 使用重试机制提交任务
      const response = await this.retryRequest(
        () => this.client.post('/', null, { params }),
        5, // 最多重试5次（TLS连接问题可能需要更多重试）
        3000 // 初始延迟3秒（给网络更多时间恢复）
      );
      
      if (response.data.StatusCode !== 21050000) {
        throw new Error(`提交任务失败: ${response.data.StatusText}`);
      }

      const taskId = response.data.TaskId;
      console.log(`✅ 阿里云转录任务已提交，TaskId: ${taskId}`);
      
      return taskId;
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || '未知错误';
      const errorCode = error.code || '';
      
      console.error('❌ 提交阿里云转录任务失败:', errorMessage);
      console.error('   错误代码:', errorCode);
        
      // 如果是 TLS 连接问题，提供更详细的诊断信息
      if (errorMessage.includes('TLS') || errorMessage.includes('socket disconnected') || errorCode === 'EPROTO' || errorMessage.includes('before secure TLS')) {
        console.error('💡 TLS 连接问题诊断:');
        console.error('   1. 检查网络连接是否稳定');
      console.error('   2. 如果需要通过代理访问，请设置 ALIYUN_ALLOW_PROXY=true 并配置 HTTPS_PROXY/HTTP_PROXY');
      console.error('   3. 检查VPN是否设置了系统代理，可能干扰了连接');
      console.error('   4. 如果使用直连，可尝试设置 NO_PROXY 环境变量排除阿里云域名:');
      console.error('      export NO_PROXY="*.aliyuncs.com,*.aliyun.com"');
      console.error('   5. 如果必须使用VPN，请确保VPN配置了正确的DNS解析');
      }
      
      throw new Error(`提交转录任务失败: ${errorMessage}`);
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

    // 查询任务状态也使用重试机制
    const response = await this.retryRequest(
      () => this.client.get('/', { params }),
      2, // 查询状态最多重试2次
      1000 // 初始延迟1秒
    );
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

