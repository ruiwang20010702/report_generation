/**
 * 通义听悟语音转录服务
 * 文档：https://help.aliyun.com/zh/tingwu/offline-transcribe-of-audio-and-video-files
 * 语音转写参数文档：https://help.aliyun.com/zh/tingwu/voice-transcription
 * 
 * 优势：
 * - ✅ 价格便宜：¥0.01/分钟（比NLS便宜25倍）
 * - ✅ 免费额度高：每天2小时（比NLS多50倍）
 * - ✅ 支持直接传URL（FileUrl参数）
 * - ✅ 支持说话人分离
 * - ✅ 支持多种音视频格式
 * - ✅ 支持领域专属模型（提升特定领域识别准确率）
 *   - domain-education: 教育领域网课场景（仅离线转写）
 *   - domain-automotive: 汽车领域销售对话（实时和离线）
 * - ✅ 国内访问速度快，无需VPN
 */

// ⚠️ 必须先加载环境变量，再初始化服务
import dotenv from 'dotenv';
dotenv.config();

import Tingwu20230930 from '@alicloud/tingwu20230930';
import * as $Tingwu20230930 from '@alicloud/tingwu20230930';
import * as $OpenApi from '@alicloud/openapi-client';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { alertQuotaWarning } from './alertService.js';
import { createLogger } from '../utils/logger.js';

// 创建模块专用日志器
const log = createLogger('Tingwu');

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
  cost?: {
    durationSeconds: number;  // 视频时长（秒）
    durationMinutes: number;  // 视频时长（分钟，向上取整）
    unitPrice: number;        // 单价（元/分钟）
    totalCost: number;        // 总成本（元）
    currency: string;         // 货币单位
    service: string;          // 服务名称
  };
}

interface TranscriptionProgress {
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
}

class TingwuTranscriptionService {
  private config: {
    accessKeyId: string;
    accessKeySecret: string;
    appKey?: string;
  } | null = null;
  // 使用 SDK 的默认导出创建客户端实例，但类型定义以 any 处理，避免 TS2709 "Cannot use namespace as a type" 错误
  private client: any | null = null;
  private readonly API_ENDPOINT = 'tingwu.cn-shanghai.aliyuncs.com';
  private readonly REGION = 'cn-shanghai';
  private readonly POLL_INTERVAL_MS = parseInt(process.env.TINGWU_POLL_INTERVAL_MS || '5000', 10);
  private readonly MAX_WAIT_MINUTES = Math.max(
    10,
    parseInt(process.env.TINGWU_MAX_WAIT_MINUTES || '30', 10)
  );
  
  // 使用量追踪
  // 通义听悟：每天免费2小时 = 120分钟/天
  private stats = {
    freeMinutesLimit: 120, // 每天2小时
    totalMinutesUsed: 0,
    remainingMinutes: 120,
    resetDate: new Date(), // 每天重置
  };

  constructor() {
    // 从环境变量读取配置
    const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
    const appKey = process.env.ALIYUN_TINGWU_APP_KEY; // 通义听悟项目AppKey

    if (accessKeyId && accessKeySecret) {
      this.config = { 
        accessKeyId, 
        accessKeySecret,
        ...(appKey && { appKey }), // 可选：如果提供了AppKey则添加
      };
      
      // 配置 HTTPS Agent（与NLS服务相同的配置）
      let httpsAgent: https.Agent | any;
      const proxyUrl = process.env.ALIYUN_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      const allowProxy = process.env.ALIYUN_ALLOW_PROXY === 'true';
      const rejectUnauthorized = process.env.ALIYUN_REJECT_UNAUTHORIZED !== 'false';
      
      if (proxyUrl && allowProxy) {
        console.log('🌐 通义听悟服务将通过代理连接');
        httpsAgent = new HttpsProxyAgent(proxyUrl);
      } else {
        httpsAgent = new https.Agent({
          keepAlive: true,
          keepAliveMsecs: 1000,
          maxSockets: 50,
          maxFreeSockets: 10,
          timeout: 60000,
          rejectUnauthorized,
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.3',
        });
        console.log('🌐 通义听悟服务将使用直连（不使用代理）');
      }

      // 初始化SDK客户端
      const config = new $OpenApi.Config({
        accessKeyId: this.config.accessKeyId,
        accessKeySecret: this.config.accessKeySecret,
        endpoint: this.API_ENDPOINT,
        regionId: this.REGION,
        // 配置超时时间（单位：毫秒）
        readTimeout: 60000, // 读取超时60秒
        connectTimeout: 30000, // 连接超时30秒
      });
      
      // 配置请求代理（如果需要）
      if (httpsAgent) {
        // SDK内部使用axios，需要通过环境变量或自定义配置来设置代理
        // 这里我们通过OpenAPI的配置来处理
        config.httpOptions = {
          agent: httpsAgent,
          timeout: 60000, // axios超时60秒
        };
      } else {
        config.httpOptions = {
          timeout: 60000, // axios超时60秒
        };
      }

      this.client = new (Tingwu20230930 as any).default(config);
      
      console.log('✅ 通义听悟服务已初始化');
      if (this.config.appKey) {
        console.log(`🔑 项目AppKey: ${this.config.appKey.substring(0, 10)}...`);
      } else {
        console.log('⚠️  未配置项目AppKey（某些API版本可能需要）');
      }
      console.log(`💰 当前剩余免费额度: ${this.stats.remainingMinutes} 分钟/天`);
    } else {
      console.log('⚠️  通义听悟服务未配置（将使用其他服务备用）');
    }
  }

  /**
   * 检查服务是否可用
   * 注意：免费额度用完后会自动使用付费额度，不影响服务可用性
   */
  isAvailable(): boolean {
    return this.config !== null && this.client !== null;
  }

  /**
   * 检查是否还有剩余额度
   */
  hasRemainingQuota(): boolean {
    // 检查是否需要重置（每天重置）
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastReset = new Date(this.stats.resetDate.getFullYear(), this.stats.resetDate.getMonth(), this.stats.resetDate.getDate());
    
    if (today.getTime() > lastReset.getTime()) {
      // 新的一天，重置额度
      this.stats.totalMinutesUsed = 0;
      this.stats.remainingMinutes = this.stats.freeMinutesLimit;
      this.stats.resetDate = now;
      console.log('🔄 通义听悟免费额度已重置（每天2小时）');
    }
    
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
   * 创建文件转写任务（使用2023-09-30版本的CreateTask API）
   * 文档：https://help.aliyun.com/zh/tingwu/api-tingwu-2023-09-30-createtask
   * 语音转写参数文档：https://help.aliyun.com/zh/tingwu/voice-transcription
   */
  private async createFileTrans(fileUrl: string, options: {
    language?: string;
    enableSpeakerDiarization?: boolean;
    speakerCount?: number; // 说话人数量，默认2
    transcriptionModel?: string; // 领域专属模型，如 'domain-education', 'domain-automotive'
    identityRecognitionEnabled?: boolean;
    identitySceneIntroduction?: string;
    identityContents?: Array<{ Name: string; Description: string }>;
  }): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('通义听悟配置未初始化');
    }

    try {
      // 根据文档，SourceLanguage支持：cn, en, fspk, ja, yue
      const sourceLanguage = options.language === 'en' ? 'en' : 'cn';
      
      // 构建Parameters参数（根据语音转写文档）
      // 文档：https://help.aliyun.com/zh/tingwu/voice-transcription
      const parameters: any = {};
      
      // 配置语音转写参数
      if (options.enableSpeakerDiarization || options.transcriptionModel) {
        parameters.Transcription = {};
        
        // 说话人分离功能
        if (options.enableSpeakerDiarization) {
          parameters.Transcription.DiarizationEnabled = true;
          const speakerCount = options.speakerCount || 2; // 默认2个说话人（老师+学生）
          parameters.Transcription.Diarization = {
            SpeakerCount: speakerCount,
          };
          console.log(`👥 说话人分离：${speakerCount} 个说话人`);
        }
        
        // 领域专属模型（提升特定领域识别准确率）
        // domain-education: 教育领域网课场景（仅离线转写）
        // domain-automotive: 汽车领域销售对话（实时和离线）
        if (options.transcriptionModel) {
          parameters.Transcription.Model = options.transcriptionModel;
          console.log(`🎯 使用领域专属模型: ${options.transcriptionModel}`);
        }
      }

      // 身份识别（老师/学生），需先开启说话人分离
      // 文档：https://help.aliyun.com/zh/tingwu/identity-recognition
      if (options.identityRecognitionEnabled) {
        parameters.IdentityRecognitionEnabled = true;
        parameters.IdentityRecognition = {
          SceneIntroduction: options.identitySceneIntroduction || 'One-on-one online English class scenario',
          IdentityContents: options.identityContents && options.identityContents.length > 0
            ? options.identityContents
            : [
                { Name: 'Teacher', Description: 'Asks questions, guides learning, explains key points, corrects mistakes, provides feedback and encouragement' },
                { Name: 'Student', Description: 'Answers questions, repeats or retells, asks questions, practices learned content' }
              ]
        };
        console.log('🪪 Identity recognition enabled (Teacher/Student)');
        try {
          const identities = parameters.IdentityRecognition.IdentityContents.map((i: any) => i.Name).join(', ');
          console.log(`🪪 Identity recognition - SceneIntroduction: ${parameters.IdentityRecognition.SceneIntroduction}`);
          console.log(`🪪 Identity recognition - IdentityContents: ${identities}`);
        } catch {}
      }
      
      // 使用新的CreateTask API
      // 根据SDK类型定义，CreateTaskRequest结构：
      // - type: 必需参数，例如 'offline'
      // - appKey: 可选，在顶层
      // - input: 包含 fileUrl 和 sourceLanguage
      // - parameters: 可选参数（包含Transcription配置）
      const createTaskRequest = new $Tingwu20230930.CreateTaskRequest({
        type: 'offline', // 离线转写任务（必需）
        appKey: this.config?.appKey, // AppKey在顶层
        input: {
          fileUrl: fileUrl, // 文件URL
          sourceLanguage: sourceLanguage, // 源语言（必需）
        },
        ...(Object.keys(parameters).length > 0 && { parameters }), // 如果有参数则添加
      });
      
      // 调试：打印请求参数（隐藏敏感信息）
      console.log('🔍 转写请求参数:', {
        type: 'offline',
        fileUrl: fileUrl.substring(0, 50) + '...',
        sourceLanguage: sourceLanguage,
        enableSpeakerDiarization: options.enableSpeakerDiarization || false,
        transcriptionModel: options.transcriptionModel || 'default',
        hasAppKey: !!this.config?.appKey,
        hasParameters: Object.keys(parameters).length > 0,
      });
      
      const response = await this.client.createTask(createTaskRequest);
      
      // 调试：打印完整响应结构
      console.log('🔍 API响应结构:', {
        statusCode: response.statusCode,
        bodyKeys: response.body ? Object.keys(response.body) : [],
        code: response.body?.Code,
        message: response.body?.Message,
        hasData: !!response.body?.Data,
        dataKeys: response.body?.Data ? Object.keys(response.body.Data) : [],
      });
      
      // 新API返回格式：实际响应是小写格式
      // { code: "0", data: { taskId, taskStatus }, message: "success", requestId }
      const code = response.body?.code || response.body?.Code;
      const message = response.body?.message || response.body?.Message;
      
      // 检查是否有错误（code为"0"表示成功）
      if (code !== undefined && code !== 0 && code !== '0') {
        // 特殊处理常见的错误码
        let errorHint = '';
        if (message?.includes('Audio file link') || message?.includes('file link invalid')) {
          errorHint = '\n💡 提示: 请确保文件URL是公开可访问的，且格式正确（支持HTTP/HTTPS链接或OSS链接）';
        }
        throw new Error(`创建转写任务失败: ${message || '未知错误'} (Code: ${code})${errorHint}`);
      }
      
      // 提取TaskId（响应是小写格式：data.taskId）
      const taskId = response.body?.data?.taskId || response.body?.Data?.TaskId;
      
      if (!taskId) {
        // 如果Code是0或success，但没有TaskId，可能是响应格式不同
        console.warn('⚠️ 响应中没有找到TaskId，完整响应:', JSON.stringify(response.body, null, 2));
        throw new Error(`创建转写任务失败: 响应中未找到TaskId。Message: ${message || '未知错误'}`);
      }

      const timestamp = new Date().toISOString().substring(11, 19);
      console.log(`✅ [${timestamp}] 通义听悟转写任务已创建，TaskId: ${taskId}`);
      
      return taskId;
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || '未知错误';
      console.error('❌ 创建通义听悟转写任务失败:', errorMessage);
      throw new Error(`创建转写任务失败: ${errorMessage}`);
    }
  }

  /**
   * 查询文件转写任务状态（使用2023-09-30版本的GetTaskInfo API）
   * 文档：https://help.aliyun.com/zh/tingwu/api-tingwu-2023-09-30-gettaskinfo
   */
  private async getFileTrans(taskId: string): Promise<any> {
    if (!this.client || !this.config) {
      throw new Error('通义听悟配置未初始化');
    }

    try {
      // GetTaskInfo 方法根据SDK类型定义，应该接受字符串参数
      // 但为了兼容性，先尝试字符串，再尝试对象
      let response: any;
      try {
        // 方式1: 尝试字符串参数格式（根据SDK类型定义）
        response = await this.client.getTaskInfo(taskId);
      } catch (e: any) {
        // 方式2: 如果失败，尝试对象参数格式（某些版本可能支持）
        if (e.message?.includes('400') || e.code === 400 || e.message?.includes('参数')) {
          console.log('💡 尝试使用对象参数格式...');
          response = await (this.client as any).getTaskInfo({ taskId });
        } else {
          throw e;
        }
      }
      
      // 调试：打印查询响应结构（仅在第一次查询或失败时打印）
      const data = response.body?.data || response.body?.Data || response.body;
      if (!data || data.taskStatus === 'FAILED' || data.TaskStatus === 'FAILED') {
        console.log('🔍 查询任务响应结构:', {
          statusCode: response.statusCode,
          bodyKeys: response.body ? Object.keys(response.body) : [],
          code: response.body?.code,
          message: response.body?.message,
          hasData: !!response.body?.data,
          dataKeys: response.body?.data ? Object.keys(response.body.data) : [],
          fullData: JSON.stringify(data, null, 2),
        });
      }
      
      // 新API返回格式：实际响应是小写格式
      // { code: "0", data: { taskId, taskStatus, ... }, message: "success", requestId }
      const code = response.body?.code || response.body?.Code;
      const message = response.body?.message || response.body?.Message;
      
      // 检查是否有错误
      if (code !== undefined && code !== 0 && code !== '0') {
        throw new Error(`查询转写任务失败: ${message || '未知错误'} (Code: ${code})`);
      }
      
      // 返回数据（小写格式：data）
      return response.body?.data || response.body?.Data || response.body;
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || '未知错误';
      const errorCode = error.code || error.statusCode;
      const errorBody = error.body || error.data;
      
      console.error('❌ 查询通义听悟转写任务失败:', errorMessage);
      console.error('❌ 错误代码:', errorCode);
      if (errorBody) {
        console.error('❌ 错误响应体:', JSON.stringify(errorBody, null, 2));
      }
      
      throw new Error(`查询转写任务失败: ${errorMessage}`);
    }
  }

  /**
   * 轮询等待转写完成
   */
  private async pollTaskCompletion(
    taskId: string,
    onProgress?: (progress: TranscriptionProgress) => void
  ): Promise<any> {
    const maxAttempts = Math.ceil((this.MAX_WAIT_MINUTES * 60 * 1000) / this.POLL_INTERVAL_MS);
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));

      try {
        const result = await this.getFileTrans(taskId);
        
        // 调试：打印查询结果（仅在第一次或失败时）
        if (attempts === 0 || !result?.taskStatus) {
          console.log('🔍 查询任务结果（第', attempts + 1, '次）:');
          console.log('  - 结果对象的所有键:', Object.keys(result || {}));
          console.log('  - 完整结果:', JSON.stringify(result, null, 2));
        }
        
        // 新API状态字段：根据实际响应是小写格式 taskStatus
        // 根据文档，状态可能是：ONGOING, COMPLETED, FAILED, INVALID
        const status = result?.taskStatus || result?.TaskStatus || result?.status;
        
        console.log('📊 任务状态:', status || '(未找到状态字段)');
        
        // 如果有错误信息，先打印出来
        if (result?.errorCode || result?.errorMessage) {
          console.log('⚠️ 任务状态信息:', {
            status,
            errorCode: result?.errorCode,
            errorMessage: result?.errorMessage,
          });
        }
        
        // 如果result为空或没有status字段，可能是查询失败
        if (!result || (!status && attempts > 0)) {
          console.warn('⚠️  查询结果异常，result:', result);
          attempts++;
          continue;
        }

      // 任务运行中（ONGOING 对应运行中，RUNNING/QUEUED 是旧版本的状态）
      if (status === 'ONGOING' || status === 'RUNNING' || status === 'QUEUED') {
        attempts++;
        const progress = Math.min(Math.round((attempts / maxAttempts) * 100), 95);
        const elapsedSeconds = Math.round((attempts * this.POLL_INTERVAL_MS) / 1000);
        
        if (onProgress) {
          onProgress({
            status: status === 'QUEUED' ? 'queued' : 'processing',
            progress,
          });
        }
        
        console.log(`⏳ [TaskId: ${taskId.substring(0, 8)}...] 转写进行中... (${progress}%, 已等待 ${elapsedSeconds}秒)`);
        continue;
      }

      // 任务成功（新API使用 COMPLETED，旧版本可能使用 SUCCESS）
      if (status === 'COMPLETED' || status === 'SUCCESS') {
        const elapsedSeconds = Math.round((attempts * this.POLL_INTERVAL_MS) / 1000);
        const timestamp = new Date().toISOString().substring(11, 19);
        console.log(`✅ [${timestamp}] [TaskId: ${taskId.substring(0, 8)}...] 转写任务完成！总耗时: ${elapsedSeconds}秒`);
        
        if (onProgress) {
          onProgress({
            status: 'completed',
            progress: 100,
          });
        }
        
        return result;
      }

      // 任务失败
      if (status === 'FAILED' || status === 'INVALID') {
        const errorMessage = result?.errorMessage || result?.message || '转写任务失败';
        const errorCode = result?.errorCode || result?.error_code;
        
        // 根据错误码提供更详细的错误信息和建议
        let errorHint = '';
        if (errorCode === 'TSC.AudioFileLink' || errorMessage?.includes('Audio file link')) {
          errorHint = '\n💡 解决方案:\n' +
            '   1. 确保文件URL是公开可访问的（无需登录或认证）\n' +
            '   2. 使用 curl 或浏览器测试URL是否可以正常访问\n' +
            '   3. 确保URL指向的是直接的音频/视频文件（不是播放页面）\n' +
            '   4. 支持的格式: HTTP/HTTPS链接或阿里云OSS链接\n' +
            '   5. 如果使用OSS，确保Bucket是公开读权限';
        } else if (errorCode === 'PRE.AudioDurationQuotaLimit' || errorMessage?.includes('quota limit')) {
          const stats = this.getStats();
          errorHint = '\n💡 解决方案:\n' +
            `   1. 当前剩余免费额度: ${stats.remainingMinutes} 分钟/天\n` +
            `   2. 已使用额度: ${stats.totalMinutesUsed} 分钟\n` +
            '   3. 视频时长可能超过了单次任务限制或剩余额度\n' +
            '   4. 建议：\n' +
            '      - 使用更短的视频（建议单次不超过30分钟）\n' +
            '      - 等待明天额度重置（每天120分钟免费额度）\n' +
            '      - 或者升级到付费套餐以获得更多额度';
        }
        
        console.error(`❌ 转写任务失败: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ''}${errorHint}`);
        throw new Error(`转写失败: ${errorMessage}${errorHint}`);
      }

      // 未知状态
      console.warn(`⚠️  未知任务状态: ${status}`);
      console.warn('🔍 完整结果数据:', JSON.stringify(result, null, 2));
      attempts++;
      } catch (error: any) {
        // 如果查询失败，记录错误但继续重试（可能是网络问题）
        console.error('❌ 查询任务状态失败（将重试）:', error.message);
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        continue;
      }
    }

    throw new Error(`转写任务超时（${this.MAX_WAIT_MINUTES}分钟）`);
  }

  /**
   * 解析通义听悟返回的转写结果
   * 根据GetTaskInfo文档：https://help.aliyun.com/zh/tingwu/api-tingwu-2023-09-30-gettaskinfo
   * 返回结构：{ Code, Message, Data: { TaskId, TaskStatus, Result: { Transcription: "url" } } }
   * 实际响应可能是小写格式：{ code, message, data: { taskId, taskStatus, result: { transcription: "url" } } }
   */
  private async parseTranscriptionResult(result: any, requestedLanguage?: string): Promise<TranscriptionResult> {
    try {
      // 调试：打印完整的结果结构
      console.log('🔍 解析转写结果，输入数据结构:');
      console.log(JSON.stringify(result, null, 2));
      console.log('🔍 输入对象的所有键:', Object.keys(result || {}));
      
      // 根据API文档，转写结果URL在 Data.Result.Transcription 中
      // 尝试多种可能的字段路径（支持大小写变体）
      const transcriptionUrl = 
        // 标准格式：Data.Result.Transcription
        result?.result?.Transcription
        // 小写格式：data.result.transcription
        || result?.result?.transcription
        // 混合格式
        || result?.Result?.Transcription
        || result?.Result?.transcription
        // 直接访问（如果result已经是Result对象）
        || result?.transcription 
        || result?.Transcription
        // 其他可能的字段名
        || result?.result?.transcriptionUrl
        || result?.Result?.transcriptionUrl
        || result?.transcriptionUrl;
      
      // 身份识别结果URL（如果已开启）
      let identityUrl: any =
        result?.result?.IdentityRecognition
        || result?.Result?.IdentityRecognition
        || result?.identityRecognition
        || result?.IdentityRecognition
        // 某些返回可能直接给出 URL 字段
        || result?.result?.IdentityRecognitionUrl
        || result?.Result?.IdentityRecognitionUrl
        || result?.identityRecognitionUrl
        || result?.IdentityRecognitionUrl;
      
      console.log('🔍 提取的转写结果URL:', transcriptionUrl);
      
      if (!transcriptionUrl) {
        console.error('❌ 转写结果URL为空');
        console.error('🔍 尝试查找所有可能的字段:');
        console.error('  - result.result:', result?.result);
        console.error('  - result.Result:', result?.Result);
        console.error('  - result的所有键:', Object.keys(result || {}));
        if (result?.result) {
          console.error('  - result.result的所有键:', Object.keys(result.result));
        }
        if (result?.Result) {
          console.error('  - result.Result的所有键:', Object.keys(result.Result));
        }
        
        // 检查是否结果直接包含在result中（某些API可能直接返回JSON而不是URL）
        if (result?.result && typeof result.result === 'object' && !result.result.transcription) {
          console.log('💡 发现result.result是对象，可能直接包含转写数据，尝试直接解析...');
          return this.parseTranscriptionData(result.result);
        }
        if (result?.Result && typeof result.Result === 'object' && !result.Result.Transcription) {
          console.log('💡 发现result.Result是对象，可能直接包含转写数据，尝试直接解析...');
          return this.parseTranscriptionData(result.Result);
        }
        
        throw new Error('转写结果URL为空');
      }

      // 从URL下载转写结果JSON（外层结果）
      console.log('📥 正在下载转写结果...');
      const response = await fetch(transcriptionUrl);
      if (!response.ok) {
        throw new Error(`下载转写结果失败: ${response.status} ${response.statusText}`);
      }
      const outerTranscriptionJson = await response.json();
      console.log('✅ 转写结果下载完成');
      
      // 解析真正的转写负载（可能在 Transcription 字段中，且可能是 URL/JSON字符串/对象）
      let transcriptionResult: any = outerTranscriptionJson;
      
      if (!transcriptionResult) {
        throw new Error('转写结果为空');
      }
      
      // 检查Transcription字段（可能是URL或JSON字符串）
      const transcriptionData = outerTranscriptionJson.Transcription || outerTranscriptionJson.transcription;
      if (transcriptionData) {
        console.log('📥 发现Transcription字段，类型:', typeof transcriptionData);
        console.log('📥 Transcription内容预览:',
          typeof transcriptionData === 'string'
            ? transcriptionData.substring(0, 200)
            : JSON.stringify(transcriptionData).substring(0, 200));
        
        if (typeof transcriptionData === 'string' && transcriptionData.startsWith('http')) {
          console.log('📥 Transcription是URL，正在下载...');
          const nestedResponse = await fetch(transcriptionData);
          if (!nestedResponse.ok) {
            throw new Error(`下载嵌套转写结果失败: ${nestedResponse.status} ${nestedResponse.statusText}`);
          }
          transcriptionResult = await nestedResponse.json();
          console.log('📥 嵌套转写结果结构:');
          console.log(JSON.stringify(transcriptionResult, null, 2));
        } else if (typeof transcriptionData === 'string' && (transcriptionData.startsWith('{') || transcriptionData.startsWith('['))) {
          console.log('📥 Transcription是JSON字符串，正在解析...');
          transcriptionResult = JSON.parse(transcriptionData);
          console.log('📥 解析后的数据结构:');
          console.log(JSON.stringify(transcriptionResult, null, 2));
        } else if (typeof transcriptionData === 'object') {
          console.log('📥 Transcription是对象，直接使用');
          transcriptionResult = transcriptionData;
        }
      }
      
      // 打点：统计段落中检测到的说话人ID
      try {
        const paragraphs = transcriptionResult?.Paragraphs || transcriptionResult?.paragraphs;
        if (Array.isArray(paragraphs)) {
          const uniqueSpeakers = new Set<string>();
          for (const p of paragraphs) {
            const sid = (p?.SpeakerId ?? p?.speakerId);
            if (sid !== undefined && sid !== null) uniqueSpeakers.add(String(sid));
          }
          console.log(`👥 解析到的唯一说话人数量: ${uniqueSpeakers.size}`, uniqueSpeakers.size > 0 ? `=> [${[...uniqueSpeakers].slice(0, 10).join(', ')}]` : '');
        }
      } catch (e: any) {
        console.warn('⚠️ 统计唯一说话人ID时出错:', e?.message || e);
      }
      
      // 如存在身份识别结果，尝试下载并解析映射（SpeakerId -> Identity）
      let speakerIdentityMap: Record<string, string> | undefined;
      // 兼容对象形态：{ url: '...' } 或 { Url: '...' }
      let identityUrlString: string | undefined;
      if (identityUrl && typeof identityUrl === 'object') {
        identityUrlString =
          identityUrl.url
          || identityUrl.Url
          || identityUrl.identityUrl
          || identityUrl.identityRecognitionUrl
          || identityUrl.transcription
          || identityUrl.Transcription;
      } else if (typeof identityUrl === 'string') {
        identityUrlString = identityUrl;
      }
      
      if (identityUrlString && typeof identityUrlString === 'string') {
        console.log('🪪 身份识别结果URL存在:', identityUrl);
        try {
          console.log('📥 正在下载身份识别结果...');
          const idResp = await fetch(identityUrlString);
          if (idResp.ok) {
            const idJson = await idResp.json();
            // 仅打印关键字段，避免日志过大
            const keys = Object.keys(idJson || {});
            console.log('📥 身份识别JSON顶级键:', keys);
            const identityResults =
              idJson?.IdentityRecognition?.IdentityResults
              || idJson?.identityRecognition?.identityResults
              || idJson?.IdentityResults
              || idJson?.identityResults;
            if (Array.isArray(identityResults)) {
              speakerIdentityMap = {};
              console.log(`🪪 身份识别结果条数: ${identityResults.length}`);
              identityResults.forEach((r: any) => {
                const sid = (r.SpeakerId || r.speakerId || '').toString();
                const identity = r.Identity || r.identity;
                if (sid && identity) {
                  speakerIdentityMap![sid] = identity;
                }
              });
              if (Object.keys(speakerIdentityMap).length > 0) {
                console.log('🪪 构建身份映射成功（前若干项）:', Object.entries(speakerIdentityMap).slice(0, 10));
              }
            } else {
              console.warn('⚠️ 未发现 IdentityResults 数组，无法构建映射');
            }
          } else {
            console.warn('⚠️ 下载身份识别结果失败:', idResp.status, idResp.statusText);
          }
        } catch (e: any) {
          console.warn('⚠️ 解析身份识别结果失败:', e.message);
        }
      } else {
        console.log('🪪 未提供身份识别结果URL，可能未开启或服务未返回该部分');
      }

      // 解析并注入身份映射
      const parsed = this.parseTranscriptionData(transcriptionResult, result, requestedLanguage);
      if (speakerIdentityMap && (parsed.words || parsed.utterances)) {
        // 替换 utterances 中的 speaker 标签
        if (parsed.utterances) {
          parsed.utterances = parsed.utterances.map(u => {
            const match = (u.speaker || '').match(/Speaker\s+(\d+)/i);
            if (match && speakerIdentityMap![match[1]]) {
              return { ...u, speaker: speakerIdentityMap![match[1]] };
            }
            return u;
          });
        }
        // 替换 words 中的 speaker 标签
        if (parsed.words) {
          parsed.words = parsed.words.map(w => {
            const match = (w.speaker || '').match(/Speaker\s+(\d+)/i);
            if (match && speakerIdentityMap![match[1]]) {
              return { ...w, speaker: speakerIdentityMap![match[1]] };
            }
            return w;
          });
        }
        console.log('🪪 已将身份映射应用到结果中');
      } else {
        console.log('🪪 未应用身份映射（可能无映射或无可替换字段）');
      }
      return parsed;
    } catch (error: any) {
      console.error('❌ 解析转写结果失败:', error);
      console.error('❌ 错误堆栈:', error.stack);
      throw new Error(`解析转写结果失败: ${error.message}`);
    }
  }

  /**
   * 解析转写数据（从JSON对象中提取文本和时间戳信息）
   */
  private parseTranscriptionData(transcriptionResult: any, originalResult?: any, requestedLanguage?: string): TranscriptionResult {
    console.log('🔍 开始解析转写数据...');
    console.log('🔍 数据对象的所有键:', Object.keys(transcriptionResult || {}));
    
    // 尝试多种可能的字段名来提取文本
    let fullText = '';
    const words: any[] = [];
    const utterances: any[] = [];
    
    // 方式0: 通义听悟格式 - Paragraphs数组（包含Words）
    if (transcriptionResult.Paragraphs && Array.isArray(transcriptionResult.Paragraphs)) {
      console.log('📝 找到Paragraphs数组（通义听悟格式），长度:', transcriptionResult.Paragraphs.length);
      
      // 统计信息
      const speakerStats: { [key: string]: { paragraphs: number; words: number } } = {};
      
      transcriptionResult.Paragraphs.forEach((paragraph: any, pIdx: number) => {
        const speakerId = paragraph.SpeakerId || paragraph.speakerId || 'Unknown';
        const paragraphWords = paragraph.Words || paragraph.words || [];
        
        // 统计每个speaker的段落数和词数
        if (!speakerStats[speakerId]) {
          speakerStats[speakerId] = { paragraphs: 0, words: 0 };
        }
        speakerStats[speakerId].paragraphs += 1;
        speakerStats[speakerId].words += paragraphWords.length;
        
        // 从Words数组中提取文本
        const paragraphText = paragraphWords
          .map((w: any) => w.Word || w.word || w.Text || w.text || '')
          .filter((t: string) => t.trim().length > 0)
          .join(' ');
        
        if (paragraphText) {
          fullText += (fullText ? ' ' : '') + paragraphText;
          
          // 构建utterance（段落级别）
          const startTime = paragraphWords[0]?.Start || paragraphWords[0]?.start || 0;
          const endTime = paragraphWords[paragraphWords.length - 1]?.End || paragraphWords[paragraphWords.length - 1]?.end || 0;
          
          utterances.push({
            text: paragraphText,
            start: startTime / 1000, // 转换为秒
            end: endTime / 1000,
            speaker: `Speaker ${speakerId}`,
          });
          
          // 构建词级别信息
          paragraphWords.forEach((w: any) => {
            const wordText = w.Word || w.word || w.Text || w.text || '';
            if (wordText) {
              words.push({
                text: wordText,
                start: (w.Start || w.start || 0) / 1000, // 转换为秒
                end: (w.End || w.end || 0) / 1000,
                confidence: w.Confidence || w.confidence || 0.95,
                speaker: `Speaker ${speakerId}`,
              });
            }
          });
        }
      });
      
      // 输出统计信息
      const speakerCount = Object.keys(speakerStats).length;
      console.log(`📊 统计信息: 共 ${speakerCount} 个 Speaker`);
      Object.entries(speakerStats).forEach(([speakerId, stats]) => {
        console.log(`  - Speaker ${speakerId}: ${stats.paragraphs} 段, ${stats.words} 个词`);
      });
    }
    
    // 方式1: sentences数组
    if (!fullText && transcriptionResult.sentences && Array.isArray(transcriptionResult.sentences)) {
      console.log('📝 找到sentences数组，长度:', transcriptionResult.sentences.length);
      fullText = transcriptionResult.sentences
        .map((s: any) => {
          const text = s.text || s.content || s.Text || s.Content || s.word || s.Word || '';
          console.log('  - 句子:', text.substring(0, 50));
          return text;
        })
        .filter((t: string) => t.trim().length > 0)
        .join(' ');
    }
    
    // 方式2: 直接text字段
    if (!fullText && transcriptionResult.text) {
      console.log('📝 找到text字段');
      fullText = transcriptionResult.text;
    }
    
    // 方式3: content字段
    if (!fullText && transcriptionResult.content) {
      console.log('📝 找到content字段');
      fullText = transcriptionResult.content;
    }
    
    // 方式4: result字段（嵌套结构）
    if (!fullText && transcriptionResult.result) {
      console.log('📝 找到嵌套的result字段');
      if (typeof transcriptionResult.result === 'string') {
        fullText = transcriptionResult.result;
      } else if (transcriptionResult.result.text) {
        fullText = transcriptionResult.result.text;
      } else if (transcriptionResult.result.sentences) {
        fullText = transcriptionResult.result.sentences
          .map((s: any) => s.text || s.content || s.Text || s.Content || '')
          .filter((t: string) => t.trim().length > 0)
          .join(' ');
      }
    }
    
    // 方式5: data字段
    if (!fullText && transcriptionResult.data) {
      console.log('📝 找到data字段');
      if (typeof transcriptionResult.data === 'string') {
        fullText = transcriptionResult.data;
      } else if (transcriptionResult.data.text) {
        fullText = transcriptionResult.data.text;
      }
    }
    
    // 如果还没有提取到文本，继续尝试其他格式
    if (!fullText) {
      // 处理词级别时间戳（通用格式）
      const wordsData = transcriptionResult.words 
        || transcriptionResult.Words 
        || transcriptionResult.wordList
        || transcriptionResult.result?.words
        || transcriptionResult.data?.words;
        
      if (wordsData && Array.isArray(wordsData)) {
        console.log('🔤 找到words数组，长度:', wordsData.length);
        wordsData.forEach((word: any) => {
          const wordText = word.word || word.text || word.Word || word.Text || '';
          if (wordText) {
            words.push({
              text: wordText,
              start: (word.beginTime || word.startTime || word.begin_time || word.start || 0) / 1000,
              end: (word.endTime || word.end_time || word.end || 0) / 1000,
              confidence: word.confidence || word.Confidence || 0.95,
              speaker: word.speakerId || word.speaker_id || word.SpeakerId ? `Speaker ${word.speakerId || word.speaker_id || word.SpeakerId}` : undefined,
            });
            fullText += (fullText ? ' ' : '') + wordText;
          }
        });
      }

      // 处理语句级别结果（含说话人标签）
      const sentencesData = transcriptionResult.sentences 
        || transcriptionResult.Sentences 
        || transcriptionResult.sentenceList
        || transcriptionResult.result?.sentences
        || transcriptionResult.data?.sentences;
        
      if (sentencesData && Array.isArray(sentencesData) && !fullText) {
        console.log('💬 找到sentences数组，长度:', sentencesData.length);
        sentencesData.forEach((sentence: any) => {
          const text = sentence.text || sentence.content || sentence.Text || sentence.Content || '';
          if (text) {
            fullText += (fullText ? ' ' : '') + text;
            utterances.push({
              text: text,
              start: (sentence.beginTime || sentence.startTime || sentence.begin_time || sentence.start || 0) / 1000,
              end: (sentence.endTime || sentence.end_time || sentence.end || 0) / 1000,
              speaker: sentence.speakerId || sentence.speaker_id || sentence.SpeakerId 
                ? `Speaker ${sentence.speakerId || sentence.speaker_id || sentence.SpeakerId}` 
                : 'Unknown',
            });
          }
        });
      }
    }
    
    console.log('📝 提取的完整文本长度:', fullText.length);
    console.log('📝 文本预览:', fullText.substring(0, 200));
    
    if (!fullText) {
      console.warn('⚠️  未能提取到文本内容，可能的原因：');
      console.warn('  1. 视频中没有语音内容');
      console.warn('  2. 转写结果格式与预期不符');
      console.warn('  3. 转写任务可能未完全完成');
      console.warn('🔍 完整数据结构:', JSON.stringify(transcriptionResult, null, 2));
    }

    // 更新使用量统计
    // 从AudioInfo中获取时长（通义听悟格式）
    const audioInfo = transcriptionResult.AudioInfo || transcriptionResult.audioInfo;
    const duration = audioInfo?.Duration 
      || audioInfo?.duration 
      || originalResult?.duration 
      || transcriptionResult.duration 
      || transcriptionResult.Duration
      || transcriptionResult.audioDuration
      || transcriptionResult.audio_duration;
      
    if (duration) {
      const rawDuration = typeof duration === 'number' ? duration : parseFloat(duration);
      if (!isNaN(rawDuration) && rawDuration > 0) {
        // 通义听悟的 AudioInfo.Duration 通常为毫秒，这里规范化为秒
        const normalizedSeconds = rawDuration > 100000 ? Math.round(rawDuration / 1000) : rawDuration;
        console.log('⏱️  音频时长(秒):', normalizedSeconds, `(原始: ${rawDuration})`);
        this.updateStats(normalizedSeconds);
        // 将规范化后的秒写回，供后续结果返回使用
        (transcriptionResult as any).duration = normalizedSeconds;
      }
    }

    // 计算成本
    const durationSeconds = duration
        ? (() => {
            const v = typeof duration === 'number' ? duration : parseFloat(duration);
          if (isNaN(v)) return 0;
            return v > 100000 ? Math.round(v / 1000) : v;
          })()
      : 0;
    
    const durationMinutes = Math.ceil(durationSeconds / 60);
    const unitPrice = 0.01; // 通义听悟：¥0.01/分钟
    const totalCost = durationMinutes * unitPrice;

    const result: TranscriptionResult = {
      text: fullText,
      words: words.length > 0 ? words : undefined,
      utterances: utterances.length > 0 ? utterances : undefined,
      duration: durationSeconds || undefined,
      language: requestedLanguage || originalResult?.language || transcriptionResult.language || 'en',
      cost: durationSeconds > 0 ? {
        durationSeconds,
        durationMinutes,
        unitPrice,
        totalCost,
        currency: 'CNY',
        service: 'tingwu'
      } : undefined,
    };
    
    console.log('✅ 解析完成，结果摘要:');
    console.log('  - 文本长度:', result.text.length);
    console.log('  - 词数量:', result.words?.length || 0);
    console.log('  - 语句数量:', result.utterances?.length || 0);
    console.log('  - 时长:', result.duration, '秒');
    if (result.cost) {
      console.log(`  - 成本: ¥${result.cost.totalCost.toFixed(2)} (${result.cost.durationMinutes}分钟 × ¥${result.cost.unitPrice}/分钟)`);
    }
    
    return result;
  }

  /**
   * 从URL转写视频（主入口方法）
   */
  async transcribeFromURL(
    videoUrl: string,
    options: {
      language?: string;
      speakerLabels?: boolean;
      speakerCount?: number; // 说话人数量，默认2（适用于老师+学生场景）
      transcriptionModel?: string; // 领域专属模型：'domain-education'（教育网课）或 'domain-automotive'（汽车销售）
      identityRecognitionEnabled?: boolean;
      identitySceneIntroduction?: string;
      identityContents?: Array<{ Name: string; Description: string }>;
      onProgress?: (progress: TranscriptionProgress) => void;
    } = {}
  ): Promise<TranscriptionResult> {
    if (!this.isAvailable()) {
      throw new Error('通义听悟服务不可用（未配置或额度已用完）');
    }

    try {
      console.log('🎯 使用通义听悟服务转写:', videoUrl);
      console.log(`💰 当前剩余免费额度: ${this.stats.remainingMinutes} 分钟/天`);

      // 1. 创建转写任务
      const taskId = await this.createFileTrans(videoUrl, {
        language: options.language || 'en',
        enableSpeakerDiarization: options.speakerLabels || false,
        speakerCount: options.speakerCount || 2, // 默认2个说话人（老师+学生）
        transcriptionModel: options.transcriptionModel, // 领域专属模型（可选）
        identityRecognitionEnabled: options.identityRecognitionEnabled,
        identitySceneIntroduction: options.identitySceneIntroduction,
        identityContents: options.identityContents,
      });

      // 2. 轮询等待完成
      const result = await this.pollTaskCompletion(taskId, options.onProgress);

      // 3. 解析结果
      const transcription = await this.parseTranscriptionResult(result, options.language);

      console.log('✅ 通义听悟转写成功！');
      console.log(`💰 更新后剩余额度: ${this.stats.remainingMinutes} 分钟/天`);

      // 检查额度并发送告警
      await this.checkAndAlertQuota();

      return transcription;
    } catch (error: any) {
      console.error('❌ 通义听悟转写失败:', error);
      
      // 检查是否是额度错误
      if (error.message?.includes('quota') || error.message?.includes('额度')) {
        this.stats.remainingMinutes = 0;
      }
      
      throw new Error(`通义听悟转写失败: ${error.message}`);
    }
  }

  /**
   * 带进度回调的转写（支持实时进度更新）
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

  /**
   * 检查额度并发送告警（如果需要）
   */
  private async checkAndAlertQuota(): Promise<void> {
    try {
      await alertQuotaWarning(
        '通义听悟',
        this.stats.remainingMinutes,
        this.stats.freeMinutesLimit
      );
    } catch (error) {
      console.error('发送额度告警失败:', error);
      // 不影响主流程
    }
  }
}

// 导出单例
export const tingwuTranscriptionService = new TingwuTranscriptionService();

