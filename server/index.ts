import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// ⚠️ 必须先加载环境变量，再导入其他模块
// 因为 assemblyAIService 等服务在模块加载时就会初始化
dotenv.config();

import analysisRouter from './routes/analysis';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: true, // 开发环境允许所有来源
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/analysis', analysisRouter);

// 根路由
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: '51Talk Video Analysis API',
    version: '1.0.0',
    endpoints: {
      analyze: 'POST /api/analysis/analyze',
      health: 'GET /api/analysis/health'
    }
  });
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
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api/analysis`);
  console.log(`🔧 Mock mode: ${process.env.USE_MOCK_ANALYSIS === 'true' ? 'ON' : 'OFF'}`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'SET (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'NOT SET'}`);
  console.log(`🔑 AssemblyAI API Key: ${process.env.ASSEMBLYAI_API_KEY ? 'SET' : 'NOT SET'}`);
});

export default app;

