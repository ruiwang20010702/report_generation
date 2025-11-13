import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ⚠️ 必须先加载环境变量，再导入其他模块
// 因为 tingwuTranscriptionService 等服务在模块加载时就会初始化
dotenv.config();

// 初始化 Sentry（必须在其他导入之前）
import { initSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } from './config/sentry.js';
const sentryEnabled = initSentry();

import analysisRouter from './routes/analysis.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import healthRouter from './routes/health.js';
import { testConnection } from './config/database.js';
import { testEmailService } from './services/emailService.js';
import { testAlertSystem } from './services/alertService.js';
import { errorHandler, AppError, ErrorType } from './utils/errors.js';
import { setupGracefulShutdown } from './utils/gracefulShutdown.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;
// 计算当前文件目录（ESM 环境下无 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Vite 默认输出到项目根的 dist 目录，运行时位于 build/server
const DIST_PATH = path.resolve(__dirname, '../../dist');

// Sentry 中间件（必须在其他中间件之前）
if (sentryEnabled) {
  app.use(sentryRequestHandler);
  app.use(sentryTracingHandler);
}

// 中间件
app.use(cors({
  origin: true, // 开发环境允许所有来源
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 全局限流：防止滥用
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200, // 每个IP最多200个请求（已放宽：原100）
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 分析接口专用限流：控制并发和成本
const analysisLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10分钟窗口
  max: 15, // 每10分钟最多15个分析请求（已大幅放宽：原5次）
  message: '视频分析请求过于频繁，请等待10分钟后再试。每10分钟限制15次分析。',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // 即使成功也计数
});

// 认证接口限流：防止暴力破解
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次登录尝试
  message: '登录尝试次数过多，请15分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 应用限流
app.use('/api/', globalLimiter);
app.use('/api/analysis/analyze', analysisLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/login', authLimiter);

// 请求日志中间件 - 结构化日志
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // 记录请求开始
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    type: 'http_request',
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  };
  
  // 在开发环境输出详细日志，生产环境使用JSON格式
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${logEntry.timestamp}] ${logEntry.method} ${logEntry.path} - ${logEntry.ip}`);
  } else {
    console.log(JSON.stringify(logEntry));
  }
  
  // 记录响应时间
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseLog = {
      ...logEntry,
      type: 'http_response',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${responseLog.timestamp}] ${responseLog.method} ${responseLog.path} ${responseLog.statusCode} - ${responseLog.duration}`);
    } else {
      console.log(JSON.stringify(responseLog));
    }
  });
  
  next();
});

// 路由
app.use('/api/analysis', analysisRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api', healthRouter); // 健康检查路由（/api/health/*）

// 测试告警端点（仅开发环境）
if (process.env.NODE_ENV === 'development') {
  app.post('/api/test-alert', async (req: Request, res: Response) => {
    try {
      const success = await testAlertSystem();
      res.json({ 
        success, 
        message: success 
          ? '告警测试邮件已发送，请检查收件箱' 
          : '告警系统未配置或发送失败' 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: '发送测试告警失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

// 静态托管前端构建产物
app.use(express.static(DIST_PATH));

// SPA 回退：非 /api 路由均回退到前端 index.html
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    // API路由不存在，抛出404错误
    return next(new AppError(
      ErrorType.NOT_FOUND,
      `API endpoint not found: ${req.method} ${req.path}`,
      {
        userMessage: '请求的接口不存在',
        context: { path: req.path, method: req.method },
      }
    ));
  }
  return res.sendFile(path.join(DIST_PATH, 'index.html'));
});

// Sentry 错误处理中间件（必须在自定义错误处理器之前）
if (sentryEnabled) {
  app.use(sentryErrorHandler);
}

// 错误处理 - 使用统一的错误处理系统（必须在所有路由之后）
app.use(errorHandler);

// 启动服务器
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api/analysis`);
  console.log(`🖥️  Frontend static dir: ${DIST_PATH}`);
  console.log(`🔧 Mock mode: ${process.env.USE_MOCK_ANALYSIS === 'true' ? 'ON' : 'OFF'}`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'SET (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'NOT SET'}`);
  console.log(`🔑 通义听悟 AccessKey: ${process.env.ALIYUN_ACCESS_KEY_ID ? 'SET' : 'NOT SET'}`);
  console.log(`🔑 通义听悟 AppKey: ${process.env.ALIYUN_TINGWU_APP_KEY ? 'SET' : 'NOT SET (可选，某些API版本可能需要)'}`);
  
  // 测试数据库连接
  if (process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING || process.env.DB_HOST) {
    await testConnection();
  } else {
    console.log('⚠️  数据库配置未设置，跳过连接测试');
  }
  
  // 测试邮件服务配置
  await testEmailService();
  
  // 显示告警系统配置状态
  const alertEmail = process.env.ALERT_EMAIL;
  if (alertEmail) {
    console.log(`🚨 告警系统已启用，接收邮箱: ${alertEmail}`);
  } else {
    console.log('ℹ️  告警系统未配置 (设置 ALERT_EMAIL 以启用)');
  }
});

// 设置优雅关闭
setupGracefulShutdown(server);

export default app;