import { Router, Request, Response } from 'express';
import { VideoAnalysisRequest } from '../types/index.js';
import { tingwuTranscriptionService } from '../services/tingwuTranscriptionService.js';
import { AppError, ErrorType, asyncHandler, createErrorContext } from '../utils/errors.js';
import { isValidVideoUrl, isValidStudentName, isValidStudentId, safeSubstring } from '../utils/validation.js';
import { analysisJobQueue } from '../services/analysisJobQueue.js';
import { reportRecordService } from '../services/reportRecordService.js';
import { getCurrentUser } from '../services/authService.js';

const router = Router();

function extractAuthToken(req: Request): string | null {
  const headerValue = req.headers.authorization;
  if (headerValue?.startsWith('Bearer ')) {
    return headerValue.slice(7);
  }
  if (headerValue) {
    return headerValue;
  }

  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies?.auth_token) {
    return cookies.auth_token;
  }

  return null;
}

async function requireAuthenticatedUser(req: Request) {
  const token = extractAuthToken(req);

  if (!token) {
    throw new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      'Authentication required',
      {
        userMessage: '请先登录后再查看报告',
        context: createErrorContext(req),
      }
    );
  }

  const { user } = await getCurrentUser(token);
  return user;
}

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

  // 验证学生ID（必填）
  if (!requestData.studentId) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing student ID',
      {
        userMessage: '请提供学生ID',
        context,
      }
    );
  }

  // 验证学生ID格式
  if (!isValidStudentId(requestData.studentId)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Invalid student ID format',
      {
        userMessage: '学生ID格式不正确，应为2-50个字符（仅支持字母、数字、下划线和短横线）',
        context: { ...context, studentId: safeSubstring(requestData.studentId, 0, 50) },
      }
    );
  }

  // 验证年级（必填）
  if (!requestData.grade) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing grade',
      {
        userMessage: '请提供年级',
        context,
      }
    );
  }

  // 验证级别（必填）
  if (!requestData.level) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing level',
      {
        userMessage: '请提供级别',
        context,
      }
    );
  }

  // 验证单元（必填）
  if (!requestData.unit) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing unit',
      {
        userMessage: '请提供单元',
        context,
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

  // 根据任务状态设置建议的轮询间隔，与客户端轮询逻辑保持一致：
  // - queued: 第一次轮询 1 秒后，之后每 10 秒轮询一次
  // - processing: 第一次轮询 1 秒后，之后前 4 次用 30 秒，之后用 10 秒
  let pollAfterSeconds: number;
  if (queuedJob.status === 'queued') {
    pollAfterSeconds = 10; // 第一次轮询后，每 10 秒轮询一次
  } else if (queuedJob.status === 'processing') {
    pollAfterSeconds = 30; // 第一次轮询后，前 4 次用 30 秒间隔
  } else {
    pollAfterSeconds = 10; // 其他状态默认 10 秒
  }

  res.status(202).json({
    message: '分析任务已排队，稍后通过 jobId 查询结果',
    job: queuedJob,
    pollAfterSeconds,
  });
}));

/**
 * GET /api/analysis/jobs/:jobId
 * 查询异步任务状态
 */
router.get('/jobs/:jobId', asyncHandler(async (req: Request, res: Response) => {
  const job = await analysisJobQueue.getJob(req.params.jobId);
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

/**
 * GET /api/analysis/reports
 * 获取当前用户的历史报告（支持分页和按学生筛选）
 */
router.get('/reports', asyncHandler(async (req: Request, res: Response) => {
  const user = await requireAuthenticatedUser(req);
  const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const studentId = typeof req.query.studentId === 'string' && req.query.studentId.trim()
    ? req.query.studentId.trim()
    : undefined;

  const history = await reportRecordService.getUserReports(user.id, {
    limit,
    offset,
    studentId,
  });

  res.json({
    success: true,
    data: history.reports,
    pagination: {
      page,
      limit,
      total: history.total,
      totalPages: limit > 0 ? Math.ceil(history.total / limit) : 0,
    },
  });
}));

/**
 * GET /api/analysis/report/:reportId
 * 获取指定报告的完整内容（限当前用户）
 */
router.get('/report/:reportId', asyncHandler(async (req: Request, res: Response) => {
  const user = await requireAuthenticatedUser(req);
  const reportId = req.params.reportId;

  const record = await reportRecordService.getReportById(reportId, user.id);
  if (!record) {
    throw new AppError(
      ErrorType.NOT_FOUND,
      `Report ${reportId} not found`,
      {
        userMessage: '未找到该报告或无权限访问',
        context: createErrorContext(req),
      }
    );
  }

  const rawAnalysis = record.analysisData || record.analysis;
  let analysisData: unknown = rawAnalysis;

  if (typeof rawAnalysis === 'string') {
    try {
      analysisData = JSON.parse(rawAnalysis);
    } catch (error) {
      throw new AppError(
        ErrorType.INTERNAL_ERROR,
        `Failed to parse analysis data for report ${reportId}`,
        {
          userMessage: '报告内容解析失败，请稍后重试',
          context: createErrorContext(req),
        }
      );
    }
  }
  if (!analysisData) {
    throw new AppError(
      ErrorType.NOT_FOUND,
      `Report ${reportId} has no analysis payload`,
      {
        userMessage: '报告内容已过期或无法获取',
        context: createErrorContext(req),
      }
    );
  }

  const isoCreatedAt = record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString();
  const reportPayload: Record<string, unknown> = {
    ...(analysisData as Record<string, unknown>),
    reportId: record.id,
    generatedAt: isoCreatedAt,
  };

  if (!('studentName' in reportPayload) && record.studentName) {
    reportPayload['studentName'] = record.studentName;
  }
  if (!('studentId' in reportPayload) && record.studentId) {
    reportPayload['studentId'] = record.studentId;
  }

  res.json({
    success: true,
    data: {
      report: reportPayload,
    },
  });
}));

/**
 * PUT /api/analysis/report/:reportId
 * 更新报告的分析内容（限当前用户）
 */
router.put('/report/:reportId', asyncHandler(async (req: Request, res: Response) => {
  const user = await requireAuthenticatedUser(req);
  const reportId = req.params.reportId;
  const payload = req.body && typeof req.body === 'object' ? (req.body.report ?? req.body) : null;

  if (!payload || typeof payload !== 'object') {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing report payload',
      {
        userMessage: '请提供需要保存的报告内容',
        context: createErrorContext(req),
      }
    );
  }

  const updated = await reportRecordService.updateReportAnalysis(reportId, user.id, payload);

  if (!updated) {
    throw new AppError(
      ErrorType.NOT_FOUND,
      `Report ${reportId} not found or unauthorized`,
      {
        userMessage: '未找到该报告或无权限保存',
        context: createErrorContext(req),
      }
    );
  }

  res.json({
    success: true,
    data: {
      reportId,
      updatedAt: new Date().toISOString(),
    },
  });
}));

 /**
 * POST /api/analysis/generate-interpretation
 * 通过 GLM API 生成销售解读版内容
 * 支持缓存：如果 reportId 存在且有缓存数据，直接返回缓存
 * 可通过 forceRegenerate: true 强制重新生成
 * 
 * 花费统计：生成解读版会产生 AI 调用花费，会自动计入报告的总花费中
 */
router.post('/generate-interpretation', asyncHandler(async (req: Request, res: Response) => {
  const context = createErrorContext(req);
  
  const reportData = req.body?.reportData;
  const reportId = req.body?.reportId;
  const forceRegenerate = req.body?.forceRegenerate === true;
  
  if (!reportData || typeof reportData !== 'object') {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing or invalid reportData',
      {
        userMessage: '请提供报告数据',
        context,
      }
    );
  }
  
  if (!reportData.studentName) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Missing studentName in reportData',
      {
        userMessage: '报告数据中缺少学生姓名',
        context,
      }
    );
  }
  
  console.log(`\n📝 收到解读版生成请求 - 学生: ${reportData.studentName}`);
  if (reportId) {
    console.log(`   报告ID: ${reportId}`);
  }
  if (forceRegenerate) {
    console.log(`   强制重新生成: 是`);
  }
  
  // 如果有 reportId 且不是强制重新生成，尝试从缓存读取
  if (reportId && !forceRegenerate) {
    const cachedInterpretation = await reportRecordService.getInterpretation(reportId);
    if (cachedInterpretation) {
      console.log(`✅ 使用缓存的解读版数据`);
      return res.json({
        success: true,
        data: {
          interpretation: cachedInterpretation,
          fromCache: true,
        },
      });
    }
    console.log(`   未找到缓存，将重新生成`);
  }
  
  // 动态导入以避免循环依赖
  const { interpretationService } = await import('../services/interpretationService.js');
  
  const result = await interpretationService.generateInterpretation(reportData);
  
  // 如果有 reportId，保存到缓存并记录花费
  if (reportId) {
    await reportRecordService.saveInterpretation(reportId, result.content, result.cost);
  }
  
  res.json({
    success: true,
    data: {
      interpretation: result.content,
      fromCache: false,
      cost: result.cost,  // 返回花费信息给前端
    },
  });
}));

/**
 * PUT /api/analysis/interpretation/:reportId
 * 更新解读报告内容（用户编辑后保存）
 */
router.put('/interpretation/:reportId', asyncHandler(async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const { interpretation } = req.body;

  if (!reportId) {
    return res.status(400).json({
      success: false,
      error: '缺少报告ID',
    });
  }

  if (!interpretation) {
    return res.status(400).json({
      success: false,
      error: '缺少解读内容',
    });
  }

  // 使用已有的 saveInterpretation 方法更新（不传 costInfo，只更新内容）
  const success = await reportRecordService.saveInterpretation(reportId, interpretation);

  if (success) {
    res.json({
      success: true,
      message: '解读报告已保存',
    });
  } else {
    res.status(404).json({
      success: false,
      error: '未找到对应的报告记录',
    });
  }
}));

export default router;

