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

import analysisRouter from './routes/analysis.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { testConnection } from './config/database.js';
import { testEmailService } from './services/emailService.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;
// 计算当前文件目录（ESM 环境下无 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Vite 默认输出到项目根的 dist 目录，运行时位于 build/server
const DIST_PATH = path.resolve(__dirname, '../../dist');

// 中间件
app.use(cors({
  origin: true, // 开发环境允许所有来源
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 全局限流：防止滥用
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 分析接口专用限流：控制并发和成本
const analysisLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10分钟窗口
  max: 2, // 每10分钟最多2个分析请求
  message: '视频分析请求过于频繁，请等待10分钟后再试。每10分钟限制2次分析。',
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

// 请求日志
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/analysis', analysisRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// 静态托管前端构建产物
app.use(express.static(DIST_PATH));

// SPA 回退：非 /api 路由均回退到前端 index.html
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(DIST_PATH, 'index.html'));
});

// 错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404处理
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// 启动服务器
app.listen(PORT, async () => {
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
});

export default app;

