import { Router, Request, Response } from 'express';
import { VideoAnalysisRequest } from '../types/index.js';
import { tingwuTranscriptionService } from '../services/tingwuTranscriptionService.js';
import { AppError, ErrorType, asyncHandler, createErrorContext } from '../utils/errors.js';
import { isValidVideoUrl, isValidStudentName, isValidStudentId, safeSubstring } from '../utils/validation.js';
import { analysisJobQueue } from '../services/analysisJobQueue.js';

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

  if (useMock) {
    console.log('🎭 使用 MOCK 分析模式');
  } else {
    console.log('🤖 使用真实 AI 分析模式');
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
      console.log('   使用用户提供的 GLM API Key: ' + safeSubstring(requestData.apiKey, 0, 10) + '...');
    } else {
      console.log('   使用服务器配置的 GLM API Key');
    }
  }

  console.log('📬 将分析任务加入异步队列');
  const queuedJob = await analysisJobQueue.enqueue(requestData, { useMock });

  res.status(202).json({
    message: '分析任务已排队，稍后通过 jobId 查询结果',
    job: queuedJob,
    pollAfterSeconds: Math.max(10, Math.min(60, Math.round((queuedJob.estimatedWaitSeconds || 30) / 3))),
  });
}));

/**
 * GET /api/analysis/jobs/:jobId
 * 查询异步任务状态
 */
router.get('/jobs/:jobId', (req: Request, res: Response) => {
  const job = analysisJobQueue.getJob(req.params.jobId);
  if (!job) {
      throw new AppError(
      ErrorType.NOT_FOUND,
      `Job ${req.params.jobId} not found`,
        {
        userMessage: '未找到对应的分析任务，请确认 jobId 是否正确',
        context: createErrorContext(req),
        }
      );
  }

  res.json(job);
});

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
      usagePercentage: Math.round((stats.totalMinutesUsed / stats.freeMinutesLimit) * 100),
      isFreeQuotaExhausted: stats.remainingMinutes <= 0
    },
    period: {
      startDate: stats.resetDate,
      resetFrequency: 'daily',
      description: '每天0点自动重置免费额度'
    },
    pricing: {
      freeQuota: '120分钟/天',
      paidRate: '¥0.01/分钟',
      currentStatus: stats.remainingMinutes > 0 ? '使用免费额度' : '使用付费额度',
      estimatedCost: stats.totalMinutesUsed > stats.freeMinutesLimit 
        ? `¥${((stats.totalMinutesUsed - stats.freeMinutesLimit) * 0.01).toFixed(2)}` 
        : '¥0.00',
      description: '免费额度用完后自动切换到付费模式，无需人工干预'
    }
  });
}));

export default router;

