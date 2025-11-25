import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ⚠️ 必须先加载环境变量，再导入其他模块
// 因为 tingwuTranscriptionService 等服务在模块加载时就会初始化
dotenv.config();

// 安装日志控制包装器（必须在其他模块导入之前）
// 生产环境会自动过滤调试日志，减少日志噪音
import { installConsoleWrapper } from './utils/logger.js';
installConsoleWrapper();

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
import { analysisJobQueue } from './services/analysisJobQueue.js';
import { errorHandler, AppError, ErrorType } from './utils/errors.js';
import { setupGracefulShutdown } from './utils/gracefulShutdown.js';
import { enableAllSecurityMiddleware } from './middleware/security.js';
import { enableStructuredLogging, logger } from './middleware/logging.js';
import { metricsMiddleware, enablePerformanceMonitoring, createMetricsEndpoint } from './middleware/metrics.js';
import { globalLimiter, analysisLimiter, authLimiter } from './middleware/rateLimiter.js';

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

// 结构化日志中间件（必须在其他中间件之前，以便追踪所有请求）
app.use(enableStructuredLogging());

// 性能指标收集中间件
app.use(metricsMiddleware);

// CORS 中间件（必须在安全中间件和其他中间件之前，以正确处理预检请求）
app.use(cors({
  origin: true, // 允许所有来源（如需限制，可改为具体域名数组如 ['https://yourdomain.com']）
  credentials: true
}));

// 安全中间件
app.use(enableAllSecurityMiddleware());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 应用限流
// 🔥 优化：使用基于用户ID的限流策略，支持真正的100并发
// 详见：docs/technical/100_CONCURRENT_ANALYSIS.md

// 先应用特定路径的限流器（必须在全局限流器之前）
app.use('/api/analysis/analyze', analysisLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/login', authLimiter);

// 全局限流器（跳过已经有专用限流器的路径）
app.use('/api/', (req, res, next) => {
  // 跳过已有专用限流器的路径
  if (req.path === '/analysis/analyze' || 
      req.path === '/auth/verify-otp' || 
      req.path === '/auth/login') {
    return next();
  }
  globalLimiter(req, res, next);
});

// 路由
app.use('/api/analysis', analysisRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api', healthRouter); // 健康检查路由（/api/health/*）

// 性能指标端点
app.get('/api/metrics', createMetricsEndpoint());

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
  
  logger.info('config', 'Service configuration', {
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    aliyunConfigured: !!process.env.ALIYUN_ACCESS_KEY_ID,
    tingwuConfigured: !!process.env.ALIYUN_TINGWU_APP_KEY,
    sentryEnabled,
  });
  
  const disableJobRecovery = process.env.DISABLE_ANALYSIS_JOB_RECOVERY === 'true';
  const jobRecoveryTimeWindowHours = parseInt(process.env.JOB_RECOVERY_TIME_WINDOW_HOURS || '2', 10);

  // 测试数据库连接
  if (process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING || process.env.DB_HOST) {
    const dbConnected = await testConnection();
    
    // 如果数据库连接成功，启用持久化并恢复未完成的任务
    if (dbConnected) {
      analysisJobQueue.enablePersistence();

      if (disableJobRecovery) {
        logger.warn(
          'queue',
          'Skipping pending job recovery because DISABLE_ANALYSIS_JOB_RECOVERY=true'
        );
      } else {
        try {
          const recoveredCount = await analysisJobQueue.recoverPendingJobs(jobRecoveryTimeWindowHours);
          if (recoveredCount > 0) {
            logger.info('queue', `Recovered ${recoveredCount} pending jobs from database (within ${jobRecoveryTimeWindowHours} hours)`);
          } else {
            logger.info('queue', `No pending jobs to recover (within ${jobRecoveryTimeWindowHours} hours)`);
          }
        } catch (error) {
          logger.error('queue', 'Failed to recover pending jobs', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  } else {
    logger.warn('database', 'Database configuration not set, skipping connection test');
  }
  
  // 测试邮件服务配置
  await testEmailService();
  
  // 显示告警系统配置状态
  const alertEmail = process.env.ALERT_EMAIL;
  if (alertEmail) {
    logger.info('alert', `Alert system enabled`, { alertEmail });
  } else {
    logger.info('alert', 'Alert system not configured (set ALERT_EMAIL to enable)');
  }
  
  // 启动性能监控（每15分钟报告一次）
  enablePerformanceMonitoring(15);
});

// 设置服务器超时时间为10分钟（视频分析需要较长时间）
// 注意：这需要与前端的axios timeout保持一致
server.timeout = 600000; // 10分钟 = 600,000毫秒
server.keepAliveTimeout = 610000; // 稍长于timeout，确保连接保持
server.headersTimeout = 615000; // 稍长于keepAliveTimeout

// 验证超时配置
logger.info('config', 'Server timeout configuration', {
  timeout: `${server.timeout}ms (${server.timeout / 1000}s)`,
  keepAliveTimeout: `${server.keepAliveTimeout}ms (${server.keepAliveTimeout / 1000}s)`,
  headersTimeout: `${server.headersTimeout}ms (${server.headersTimeout / 1000}s)`,
});

// 设置优雅关闭
setupGracefulShutdown(server);

export default app;