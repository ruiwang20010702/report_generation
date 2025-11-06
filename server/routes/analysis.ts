import { Router, Request, Response } from 'express';
import { VideoAnalysisService } from '../services/videoAnalysisService';
import { VideoAnalysisRequest } from '../types';
import { assemblyAIService } from '../services/assemblyAIService';

const router = Router();
const analysisService = new VideoAnalysisService();

/**
 * POST /api/analysis/analyze
 * 分析两个视频并生成学习报告
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const requestData: VideoAnalysisRequest = req.body;

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

    // 检查是否使用mock模式（优先使用请求参数，其次使用环境变量）
    const useMock = requestData.useMockData ?? (process.env.USE_MOCK_ANALYSIS === 'true');

    let result;
    if (useMock) {
      console.log('🎭 Using MOCK analysis mode');
      result = await analysisService.analyzeMock(requestData);
      console.log('✅ Mock analysis completed');
    } else {
      console.log('🤖 Using REAL AI analysis mode');
      // 如果使用真实AI，需要API key
      if (!requestData.apiKey) {
        console.log('❌ Missing API key for real AI analysis');
        return res.status(400).json({
          error: '使用真实AI分析需要提供 OpenAI API Key'
        });
      }
      console.log('   API Key provided: ' + requestData.apiKey.substring(0, 10) + '...');
      
      try {
        result = await analysisService.analyzeVideos(requestData);
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
 * 获取 AssemblyAI 使用量统计
 */
router.get('/quota', (req: Request, res: Response) => {
  try {
    const stats = assemblyAIService.getStats();
    const isAvailable = assemblyAIService.isAvailable();
    
    res.json({
      service: 'AssemblyAI',
      available: isAvailable,
      quota: {
        totalMinutes: stats.freeMinutesLimit,
        usedMinutes: stats.totalMinutesUsed,
        remainingMinutes: stats.remainingMinutes,
        usagePercentage: Math.round((stats.totalMinutesUsed / stats.freeMinutesLimit) * 100)
      },
      period: {
        startDate: stats.lastReset,
        resetFrequency: 'monthly'
      },
      costSavings: {
        estimatedSavings: `$${(stats.totalMinutesUsed * 0.006).toFixed(2)}`,
        description: 'Compared to OpenAI Whisper ($0.006/minute)'
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

