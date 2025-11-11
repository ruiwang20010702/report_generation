import { Router, Request, Response } from 'express';
import { VideoAnalysisService } from '../services/videoAnalysisService.js';
import { VideoAnalysisRequest } from '../types/index.js';
import { tingwuTranscriptionService } from '../services/tingwuTranscriptionService.js';

const router = Router();

/**
 * POST /api/analysis/transcribe-test
 * 使用通义听悟对单个视频进行转写调试，返回说话人统计与片段
 */
router.post('/transcribe-test', async (req: Request, res: Response) => {
  try {
    const { video, language = (process.env.TINGWU_LANGUAGE || 'en'), speakerCount = 3 } = req.body || {};
    if (!video || typeof video !== 'string') {
      return res.status(400).json({ error: '请提供可访问的视频链接字段：video' });
    }

    if (!tingwuTranscriptionService.isAvailable()) {
      return res.status(400).json({
        error: '通义听悟服务不可用：请检查 ALIYUN_ACCESS_KEY_ID/ALIYUN_ACCESS_KEY_SECRET 或今日额度是否已用完'
      });
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
      textPreview: transcription.text.substring(0, 400)
    });
  } catch (error: any) {
    res.status(500).json({
      error: '转写调试失败',
      message: error?.message || 'Unknown error'
    });
  }
});

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
router.post('/analyze', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // 字段映射：前端使用 date/date2，后端使用 video1Time/video2Time
    const rawData = req.body;
    const requestData: VideoAnalysisRequest = {
      ...rawData,
      video1Time: rawData.video1Time || rawData.date,
      video2Time: rawData.video2Time || rawData.date2
    };

    // 验证请求数据
    if (!requestData.video1 || !requestData.video2) {
      console.log('❌ Validation failed: Missing video URLs');
      return res.status(400).json({
        error: '请提供两个视频链接'
      });
    }

    if (!requestData.studentName) {
      console.log('❌ Validation failed: Missing student name');
      return res.status(400).json({
        error: '请提供学生姓名'
      });
    }

    console.log('📝 Received analysis request:');
    console.log('   Student:', requestData.studentName);
    console.log('   Video 1:', requestData.video1.substring(0, 50) + '...');
    console.log('   Video 2:', requestData.video2.substring(0, 50) + '...');
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
        console.log('❌ No API key available (neither server nor user provided)');
        return res.status(400).json({
          error: '使用真实AI分析需要提供 GLM API Key（智谱AI）'
        });
      }
      
      if (hasUserKey) {
        console.log('   Using user-provided GLM API Key: ' + requestData.apiKey!.substring(0, 10) + '...');
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
        throw analysisError;
      }
    }

    res.json(result);
  } catch (error) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ Error in /analyze endpoint after ${elapsedTime}s:`, error);
    
    // 提供更详细的错误信息
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('timeout')) {
      errorMessage = '请求超时。视频下载或AI分析耗时过长，请尝试使用较短的视频（3-5分钟）。';
    }
    
    res.status(500).json({
      error: '分析视频时出错',
      message: errorMessage,
      elapsedTime: `${elapsedTime}秒`
    });
  }
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
router.get('/quota', (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error getting quota stats:', error);
    res.status(500).json({
      error: 'Failed to get quota statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

