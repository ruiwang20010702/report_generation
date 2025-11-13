import { Router, Request, Response } from 'express';
import { VideoAnalysisService } from '../services/videoAnalysisService.js';
import { VideoAnalysisRequest } from '../types/index.js';
import { tingwuTranscriptionService } from '../services/tingwuTranscriptionService.js';
import { AppError, ErrorType, asyncHandler, createErrorContext } from '../utils/errors.js';
import { isValidVideoUrl, isValidStudentName, isValidStudentId, safeSubstring } from '../utils/validation.js';

const router = Router();

/**
 * POST /api/analysis/transcribe-test
 * 使用通义听悟对单个视频进行转写调试，返回说话人统计与片段
 */
router.post('/transcribe-test', asyncHandler(async (req: Request, res: Response) => {
  const { video, language = (process.env.TINGWU_LANGUAGE || 'en'), speakerCount = 3 } = req.body || {};
  
  if (!video || typeof video !== 'string') {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing or invalid video URL',
      {
        userMessage: '请提供可访问的视频链接字段：video',
        context: createErrorContext(req),
      }
    );
  }

  if (!tingwuTranscriptionService.isAvailable()) {
    const reason = !tingwuTranscriptionService.hasRemainingQuota()
      ? '免费额度已用完（每天2小时，请等待第二天重置）'
      : '未配置 AccessKey（需要 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET）';
    
    throw new AppError(
      ErrorType.SERVICE_UNAVAILABLE,
      `通义听悟服务不可用：${reason}`,
      {
        userMessage: `转录服务不可用：${reason}`,
        context: createErrorContext(req),
      }
    );
  }

  const start = Date.now();
  const transcription = await tingwuTranscriptionService.transcribeFromURL(video, {
    language,
    speakerLabels: true,
    speakerCount,
    transcriptionModel: 'domain-education',
    identityRecognitionEnabled: true,
    identitySceneIntroduction: 'One-on-one online English class scenario',
    identityContents: [
      { Name: 'Teacher', Description: 'Asks questions, guides learning, explains key points, corrects mistakes, provides feedback and encouragement' },
      { Name: 'Student', Description: 'Answers questions, repeats or retells, asks questions, practices learned content' }
    ]
  });
  const elapsed = Math.round((Date.now() - start) / 1000);

  // 统计唯一说话人
  const uniqueSpeakers = new Set<string>();
  (transcription.utterances || []).forEach(u => uniqueSpeakers.add(u.speaker));

  // 返回关键信息与样例
  res.json({
    ok: true,
    elapsedSeconds: elapsed,
    language: transcription.language,
    durationSeconds: transcription.duration,
    speakersDetected: uniqueSpeakers.size,
    speakers: Array.from(uniqueSpeakers),
    utteranceCount: transcription.utterances?.length || 0,
    sampleUtterances: (transcription.utterances || []).slice(0, 12), // 返回前12条片段
    textPreview: safeSubstring(transcription.text, 0, 400)
  });
}));

// 延迟初始化，确保环境变量已加载
let analysisService: VideoAnalysisService | null = null;
const getAnalysisService = () => {
  if (!analysisService) {
    analysisService = new VideoAnalysisService();
  }
  return analysisService;
};

/**
 * POST /api/analysis/analyze
 * 分析两个视频并生成学习报告
 */
router.post('/analyze', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const context = createErrorContext(req);
  
  // 字段映射：前端使用 date/date2，后端使用 video1Time/video2Time
  const rawData = req.body;
  const requestData: VideoAnalysisRequest = {
    ...rawData,
    video1Time: rawData.video1Time || rawData.date,
    video2Time: rawData.video2Time || rawData.date2
  };

  // 验证请求数据
  if (!requestData.video1 || !requestData.video2) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing video URLs',
      {
        userMessage: '请提供两个视频链接',
        context: { ...context, studentName: requestData.studentName },
      }
    );
  }

  // 验证视频URL格式
  if (!isValidVideoUrl(requestData.video1)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Invalid video1 URL format',
      {
        userMessage: '第一个视频链接格式不正确，请提供有效的视频链接',
        context: { ...context, videoUrl: safeSubstring(requestData.video1, 0, 100) },
      }
    );
  }

  if (!isValidVideoUrl(requestData.video2)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Invalid video2 URL format',
      {
        userMessage: '第二个视频链接格式不正确，请提供有效的视频链接',
        context: { ...context, videoUrl: safeSubstring(requestData.video2, 0, 100) },
      }
    );
  }

  if (!requestData.studentName) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing student name',
      {
        userMessage: '请提供学生姓名',
        context,
      }
    );
  }

  // 验证学生姓名格式
  if (!isValidStudentName(requestData.studentName)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Invalid student name format',
      {
        userMessage: '学生姓名格式不正确，应为2-50个字符（支持中文、英文、数字）',
        context: { ...context, studentName: safeSubstring(requestData.studentName, 0, 50) },
      }
    );
  }

  // 验证学生ID格式（如果提供）
  if (requestData.studentId && !isValidStudentId(requestData.studentId)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Invalid student ID format',
      {
        userMessage: '学生ID格式不正确，应为2-50个字符（仅支持字母、数字、下划线和短横线）',
        context: { ...context, studentId: safeSubstring(requestData.studentId, 0, 50) },
      }
    );
  }

  console.log('📝 Received analysis request:');
  console.log('   Student:', requestData.studentName);
  if (requestData.studentId) console.log('   Student ID:', requestData.studentId);
  console.log('   Video 1:', safeSubstring(requestData.video1, 0, 50) + '...');
  console.log('   Video 2:', safeSubstring(requestData.video2, 0, 50) + '...');
  if (requestData.video1Time) console.log('   Video 1 Time:', requestData.video1Time);
  if (requestData.video2Time) console.log('   Video 2 Time:', requestData.video2Time);

  // 检查是否使用mock模式（优先使用请求参数，其次使用环境变量）
  const useMock = requestData.useMockData ?? (process.env.USE_MOCK_ANALYSIS === 'true');

  const service = getAnalysisService();
  
  let result;
  if (useMock) {
    console.log('🎭 Using MOCK analysis mode');
    result = await service.analyzeMock(requestData);
    console.log('✅ Mock analysis completed');
  } else {
    console.log('🤖 Using REAL AI analysis mode');
    
    // 检查是否有可用的 API Key（用户提供的或服务器配置的）
    // 注意：系统使用智谱 GLM 模型，不是 OpenAI
    const hasServerKey = !!process.env.GLM_API_KEY;
    const hasUserKey = !!requestData.apiKey;
    
    if (!hasServerKey && !hasUserKey) {
      throw new AppError(
        ErrorType.API_KEY_ERROR,
        'No GLM API key available (neither server nor user provided)',
        {
          userMessage: '使用真实AI分析需要提供 GLM API Key（智谱AI）',
          context: { ...context, studentName: requestData.studentName },
        }
      );
    }
    
    if (hasUserKey) {
      console.log('   Using user-provided GLM API Key: ' + safeSubstring(requestData.apiKey, 0, 10) + '...');
    } else {
      console.log('   Using server-configured GLM API Key');
    }
    
    try {
      result = await service.analyzeVideos(requestData);
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Real AI analysis completed in ${elapsedTime}s`);
    } catch (analysisError) {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ Analysis failed after ${elapsedTime}s:`, analysisError);
      
      // 将错误转换为AppError（如果还不是）
      if (analysisError instanceof AppError) {
        // context是只读的，不能直接修改，直接抛出
        throw analysisError;
      }
      
      // 根据错误消息推断错误类型
      const errorMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
      let errorType = ErrorType.INTERNAL_ERROR;
      
      if (errorMessage.includes('transcribe') || errorMessage.includes('转录')) {
        errorType = ErrorType.TRANSCRIPTION_ERROR;
      } else if (errorMessage.includes('API key') || errorMessage.includes('API Key') || errorMessage.includes('GLM')) {
        errorType = ErrorType.API_KEY_ERROR;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
        errorType = ErrorType.TIMEOUT_ERROR;
      } else if (errorMessage.includes('quota') || errorMessage.includes('额度')) {
        errorType = ErrorType.QUOTA_EXCEEDED;
      }
      
      throw new AppError(
        errorType,
        errorMessage,
        {
          originalError: analysisError instanceof Error ? analysisError : undefined,
          context: { ...context, elapsedTime: `${elapsedTime}秒`, studentName: requestData.studentName },
        }
      );
    }
  }

  res.json(result);
}));

/**
 * GET /api/analysis/health
 * 健康检查端点
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    useMock: process.env.USE_MOCK_ANALYSIS === 'true'
  });
});

/**
 * GET /api/analysis/quota
 * 获取通义听悟使用量统计
 */
router.get('/quota', asyncHandler(async (req: Request, res: Response) => {
  const stats = tingwuTranscriptionService.getStats();
  const isAvailable = tingwuTranscriptionService.isAvailable();
  
  res.json({
    service: '通义听悟 (Tingwu)',
    available: isAvailable,
    quota: {
      totalMinutes: stats.freeMinutesLimit,
      usedMinutes: stats.totalMinutesUsed,
      remainingMinutes: stats.remainingMinutes,
      usagePercentage: Math.round((stats.totalMinutesUsed / stats.freeMinutesLimit) * 100)
    },
    period: {
      startDate: stats.resetDate,
      resetFrequency: 'daily',
      description: '每天0点自动重置免费额度'
    },
    costSavings: {
      estimatedSavings: `¥${(stats.totalMinutesUsed * 0.01).toFixed(2)}`,
      description: '超出免费额度后按 ¥0.01/分钟计费'
    }
  });
}));

export default router;

