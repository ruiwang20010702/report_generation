import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VideoAnalysisService } from '../../server/services/videoAnalysisService.js';
import { VideoAnalysisRequest } from '../../server/types/index.js';

// Rate limiting 配置（基于内存，生产环境建议使用 Redis）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // 每分钟 10 次请求
const RATE_WINDOW = 60 * 1000; // 1 分钟

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// 清理过期的 rate limit 记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 1000);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 处理
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // CORS 预检
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   (req.headers['x-real-ip'] as string) || 
                   'unknown';
  
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ 
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }

  try {
    console.log(`[${new Date().toISOString()}] Analysis request from ${clientIp}`);
    console.log('📋 Environment variables check:');
    console.log(`   - GLM_API_KEY: ${process.env.GLM_API_KEY ? 'Set (' + process.env.GLM_API_KEY.substring(0, 20) + '...)' : 'Not set'}`);
    console.log(`   - ALIYUN_ACCESS_KEY_ID: ${process.env.ALIYUN_ACCESS_KEY_ID ? 'Set' : 'Not set'}`);
    console.log(`   - ALIYUN_ACCESS_KEY_SECRET: ${process.env.ALIYUN_ACCESS_KEY_SECRET ? 'Set' : 'Not set'}`);
    console.log(`   - ALIYUN_TINGWU_APP_KEY: ${process.env.ALIYUN_TINGWU_APP_KEY ? 'Set' : 'Not set (可选)'}`);
    console.log(`   - USE_MOCK_ANALYSIS: ${process.env.USE_MOCK_ANALYSIS || 'Not set'}`);

    const service = new VideoAnalysisService();
    
    // 解析 JSON body
    const requestData: VideoAnalysisRequest = req.body;

    // 验证必需字段
    if (!requestData.video1 || !requestData.video2) {
      console.log('❌ Validation failed: Missing video URLs');
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Both video1 and video2 URLs are required' 
      });
    }

    if (!requestData.studentName) {
      console.log('❌ Validation failed: Missing student name');
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'Student name is required' 
      });
    }

    console.log('📝 Request data:');
    console.log(`   - Student: ${requestData.studentName}`);
    console.log(`   - Video 1: ${requestData.video1.substring(0, 50)}...`);
    console.log(`   - Video 2: ${requestData.video2.substring(0, 50)}...`);
    console.log(`   - Use Mock: ${requestData.useMockData ?? 'undefined'}`);
    console.log(`   - API Key provided: ${requestData.apiKey ? 'Yes' : 'No'}`);

    // 确定是否使用 Mock 模式
    const useMock = requestData.useMockData ?? (process.env.USE_MOCK_ANALYSIS === 'true');
    
    // 如果不使用 Mock 且没有 API Key（前端传入或环境变量），返回错误
    // 注意：系统使用智谱 GLM 模型，不是 OpenAI
    const hasApiKey = requestData.apiKey || process.env.GLM_API_KEY;
    if (!useMock && !hasApiKey) {
      console.log('❌ Missing API key for real AI analysis');
      return res.status(400).json({ 
        error: 'Missing API Key',
        message: '使用真实AI分析需要提供 GLM API Key（智谱AI）'
      });
    }

    console.log(`🎬 Starting ${useMock ? 'MOCK' : 'REAL'} analysis...`);

    // 执行分析
    const result = await service.analyzeVideos(requestData);

    console.log('✅ Analysis completed successfully');
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('❌ Analysis error:', error);
    
    // 根据错误类型返回适当的状态码
    if (error.message?.includes('API key') || error.message?.includes('No OpenAI API key') || error.message?.includes('GLM API Key')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: '使用真实AI分析需要提供 GLM API Key（智谱AI）'
      });
    }

    if (error.message?.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Gateway timeout',
        message: 'Request timeout. Please try again or use a shorter video.'
      });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
