/**
 * 📹 视频分析服务
 * 
 * 这是重构后的主入口文件，将原来 3600+ 行的代码拆分成多个模块：
 * - config.ts: AI配置、定价、报告字数配置
 * - aiClient.ts: AI客户端管理
 * - transcriptionAnalyzer.ts: 转录分析逻辑
 * - reportGenerator.ts: 对比报告生成
 * - dataValidator.ts: 数据验证和修复
 * - mockData.ts: Mock数据
 * - types.ts: 类型定义
 */

import OpenAI from 'openai';
import { VideoAnalysisRequest, VideoAnalysisResponse } from '../../types/index.js';
import { WhisperService } from '../whisperService.js';
import { tingwuTranscriptionService } from '../tingwuTranscriptionService.js';
import { reportRecordService } from '../reportRecordService.js';
import type { ReportRecordMeta } from '../reportRecordService.js';
import { AppError, ErrorType } from '../../utils/errors.js';

// 导入拆分的模块
import { detectAIProvider, createAIClient, getOpenAIClient } from './aiClient.js';
import { transcribeVideoSmart, analyzeTranscriptionWithGPT } from './transcriptionAnalyzer.js';
import { compareVideos } from './reportGenerator.js';
import { analyzeMock } from './mockData.js';

export class VideoAnalysisService {
  private defaultOpenai: OpenAI | null;
  private defaultUseMock: boolean;
  private whisperService: WhisperService;

  constructor() {
    this.whisperService = new WhisperService();
    
    // 🌟 强制使用 GLM 模型（固定配置）
    try {
      const aiProvider = detectAIProvider();
      if (aiProvider) {
        this.defaultOpenai = createAIClient(aiProvider);
        this.defaultUseMock = false;
      } else {
        // 检查是否强制使用 Mock
        if (process.env.USE_MOCK_ANALYSIS === 'true') {
          console.log('⚠️  Default mode: MOCK - using simulated data');
          console.log('💡 Users can provide their own API Key in the form for real AI analysis');
          this.defaultOpenai = null;
          this.defaultUseMock = true;
        } else {
          throw new Error('GLM API Key 未配置且未启用 Mock 模式');
        }
      }
    } catch (error) {
      console.error('❌ AI 服务初始化失败:', error instanceof Error ? error.message : error);
      // 转换为AppError
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorType.API_KEY_ERROR,
        error instanceof Error ? error.message : 'AI服务初始化失败',
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage: 'AI服务配置错误，请检查API密钥设置',
        }
      );
    }
  }

  /**
   * 主要的分析方法
   */
  async analyzeVideos(request: VideoAnalysisRequest): Promise<VideoAnalysisResponse> {
    // 判断是否使用模拟数据
    const useMock = request.useMockData !== false && (request.useMockData || (!request.apiKey && this.defaultUseMock));
    
    if (useMock) {
      console.log('📝 Using mock analysis for:', request.studentName);
      return analyzeMock(request);
    }

    // 获取 AI 客户端（GLM）
    const openai = getOpenAIClient(request.apiKey, this.defaultOpenai);
    if (!openai) {
      throw new AppError(
        ErrorType.API_KEY_ERROR,
        'No GLM API key available',
        {
          userMessage: '未提供GLM API密钥。请提供GLM API密钥或使用模拟数据模式。',
          context: { studentName: request.studentName },
        }
      );
    }

    try {
      console.log('🚀 Starting real AI video analysis for:', request.studentName);
      console.log('📹 Video 1:', request.video1);
      console.log('📹 Video 2:', request.video2);

      // 🚀 超级并行：让所有可并行的步骤都并行执行
      console.log('\n=== 🚀 超级并行分析：下载、转录、分析全部并行 ===');
      const overallStartTime = Date.now();
      
      // 视频处理状态跟踪
      const videoStatus = {
        video1: { transcribing: false, analyzing: false, completed: false },
        video2: { transcribing: false, analyzing: false, completed: false }
      };
      
      // 添加进度监控
      const progressInterval = setInterval(() => {
        const elapsed = ((Date.now() - overallStartTime) / 1000).toFixed(0);
        const v1Status = videoStatus.video1.completed ? '✅ 已完成' : 
                        videoStatus.video1.analyzing ? '🤖 分析中' :
                        videoStatus.video1.transcribing ? '📝 转录中' : '⏳ 等待中';
        const v2Status = videoStatus.video2.completed ? '✅ 已完成' : 
                        videoStatus.video2.analyzing ? '🤖 分析中' :
                        videoStatus.video2.transcribing ? '📝 转录中' : '⏳ 等待中';
        console.log(`⏳ 视频分析进行中... 已耗时: ${elapsed}秒 | 视频1: ${v1Status} | 视频2: ${v2Status}`);
      }, 15000);
      
      let video1Result, video2Result;
      try {
        console.log('\n🎯 [流水线] 转录和分析流水线执行...');
        const transcribeStartTime = Date.now();
        
        const transcriptionLanguage = request.language || process.env.TINGWU_LANGUAGE || 'en';
        console.log(`🌐 使用转录语言: ${transcriptionLanguage}`);
        const requestedSpeakerCount = request.speakerCount ?? 3;
        console.log(`👥 说话人数量: ${requestedSpeakerCount}`);

        const [result1, result2] = await Promise.all([
          (async () => {
            console.log('📥 [视频1] 开始转录...');
            videoStatus.video1.transcribing = true;
            const transcription1 = await transcribeVideoSmart(
              request.video1,
              'Video 1',
              transcriptionLanguage,
              requestedSpeakerCount
            );
            console.log('✅ [视频1] 转录完成');
            
            if (!transcription1.text || transcription1.text.trim().length === 0) {
              throw new AppError(
                ErrorType.TRANSCRIPTION_ERROR,
                '第一个视频转录失败：未提取到任何文本内容',
                {
                  userMessage: '第一个视频转录失败：未提取到任何文本内容。',
                  context: { studentName: request.studentName, videoNumber: 1 },
                }
              );
            }
            console.log(`📝 [视频1] 转录文本长度: ${transcription1.text.length} 字符`);
            
            videoStatus.video1.transcribing = false;
            videoStatus.video1.analyzing = true;
            console.log('🤖 [视频1] 开始分析...');
            const analysis1Text = await analyzeTranscriptionWithGPT(transcription1, openai, 'Video 1', this.whisperService);
            console.log('✅ [视频1] 分析完成');
            videoStatus.video1.analyzing = false;
            videoStatus.video1.completed = true;
            
            return { 
              transcription: transcription1, 
              analysis: analysis1Text.analysis,
              usage: analysis1Text.usage
            };
          })(),
          (async () => {
            console.log('📥 [视频2] 开始转录...');
            videoStatus.video2.transcribing = true;
            const transcription2 = await transcribeVideoSmart(
              request.video2,
              'Video 2',
              transcriptionLanguage,
              requestedSpeakerCount
            );
            console.log('✅ [视频2] 转录完成');
            
            if (!transcription2.text || transcription2.text.trim().length === 0) {
              throw new AppError(
                ErrorType.TRANSCRIPTION_ERROR,
                '第二个视频转录失败：未提取到任何文本内容',
                {
                  userMessage: '第二个视频转录失败：未提取到任何文本内容。',
                  context: { studentName: request.studentName, videoNumber: 2 },
                }
              );
            }
            console.log(`📝 [视频2] 转录文本长度: ${transcription2.text.length} 字符`);
            
            videoStatus.video2.transcribing = false;
            videoStatus.video2.analyzing = true;
            console.log('🤖 [视频2] 开始分析...');
            const analysis2Text = await analyzeTranscriptionWithGPT(transcription2, openai, 'Video 2', this.whisperService);
            console.log('✅ [视频2] 分析完成');
            videoStatus.video2.analyzing = false;
            videoStatus.video2.completed = true;
            
            return { 
              transcription: transcription2, 
              analysis: analysis2Text.analysis,
              usage: analysis2Text.usage
            };
          })()
        ]);
        
        video1Result = result1;
        video2Result = result2;
        
        const totalTime = ((Date.now() - overallStartTime) / 1000).toFixed(1);
        console.log(`✅ 所有视频转录和分析完成！总耗时: ${totalTime}秒`);
        console.log(`💰 当前通义听悟剩余免费额度: ${tingwuTranscriptionService.getStats().remainingMinutes} 分钟/天\n`);
        
        clearInterval(progressInterval);
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }

      // 3. 比较并生成报告
      console.log('\n=== 📊 生成对比报告 ===');
      const reportStartTime = Date.now();
      const report = await compareVideos(
        video1Result,
        video2Result,
        {
          studentName: request.studentName,
          studentId: request.studentId,
          grade: request.grade,
          level: request.level,
          unit: request.unit,
          video1Time: request.video1Time,
          video2Time: request.video2Time
        },
        openai
      );

      const reportTime = ((Date.now() - reportStartTime) / 1000).toFixed(1);
      console.log(`✅ 对比报告生成完成！耗时: ${reportTime}秒`);
      console.log('✅ 整体分析完成 for:', request.studentName);
      
      // 记录报告到数据库
      let savedReportMeta: ReportRecordMeta | null = null;

      if (report.costBreakdown) {
        const combinedTranscript = [
          `=== 第一个视频转录 (${request.video1Time || '未知时间'}) ===`,
          video1Result.transcription.text,
          '',
          `=== 第二个视频转录 (${request.video2Time || '未知时间'}) ===`,
          video2Result.transcription.text
        ].join('\n');
        
        const totalDuration = (video1Result.transcription.duration || 0) + (video2Result.transcription.duration || 0);
        
        try {
          savedReportMeta = await reportRecordService.recordReport({
            userId: request.userId,
            studentName: request.studentName,
            studentId: request.studentId,
            videoUrl: `${request.video1};${request.video2}`,
            transcript: combinedTranscript,
            audioDur: Math.round(totalDuration),
            fileName: `${request.studentName}_${new Date().toISOString().split('T')[0]}`,
            fileUrl: request.video1,
            costDetail: report.costBreakdown,
            analysisData: report
          });
        } catch (err) {
          console.error('⚠️ 报告记录保存失败（不影响主流程）:', err);
        }
      }
      
      const finalReport = savedReportMeta
        ? {
            ...report,
            reportId: savedReportMeta.id,
            generatedAt: savedReportMeta.createdAt,
          }
        : report;
      
      return finalReport;
    } catch (error) {
      console.error('❌ Error in analyzeVideos:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorType = ErrorType.INTERNAL_ERROR;
      let userMessage = '视频分析失败，请稍后重试';
      
      if (errorMessage.includes('transcribe') || errorMessage.includes('转录')) {
        errorType = ErrorType.TRANSCRIPTION_ERROR;
        userMessage = '视频转录失败，请确保视频链接可访问，且包含音频内容';
      } else if (errorMessage.includes('API key') || errorMessage.includes('API Key')) {
        errorType = ErrorType.API_KEY_ERROR;
        userMessage = 'API密钥无效或未配置，请检查配置';
      } else if (errorMessage.includes('download') || errorMessage.includes('下载')) {
        errorType = ErrorType.VIDEO_PROCESSING_ERROR;
        userMessage = '视频下载失败，请检查视频链接是否正确';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
        errorType = ErrorType.TIMEOUT_ERROR;
        userMessage = '请求超时，请尝试使用较短的视频（建议3-5分钟）';
      }
      
      throw new AppError(
        errorType,
        errorMessage,
        {
          originalError: error instanceof Error ? error : undefined,
          userMessage,
          context: { studentName: request.studentName },
        }
      );
    }
  }
}

// 导出服务实例（保持向后兼容）
export { VideoAnalysisService as default };

