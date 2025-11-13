/**
 * 健康检查端点
 * 用于监控服务状态、数据库连接、依赖服务等
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { tingwuTranscriptionService } from '../services/tingwuTranscriptionService.js';

const router = Router();

/**
 * 基础健康检查
 * 用于快速检查服务是否运行
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * 详细健康检查
 * 包含数据库、服务、资源使用情况等
 */
router.get('/health/详细', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // 1. 数据库健康检查
    const dbHealth = await checkDatabase();
    
    // 2. 转录服务健康检查
    const transcriptionHealth = checkTranscriptionServices();
    
    // 3. 系统资源检查
    const systemHealth = checkSystemResources();
    
    // 4. 依赖服务检查
    const servicesHealth = checkServices();
    
    const responseTime = Date.now() - startTime;
    
    // 判断整体健康状态
    const isHealthy = 
      dbHealth.status === 'healthy' &&
      transcriptionHealth.status !== 'unhealthy' &&
      systemHealth.status !== 'unhealthy';
    
    const overallStatus = isHealthy ? 'healthy' : 
                         (dbHealth.status === 'unhealthy' ? 'unhealthy' : 'degraded');
    
    res.status(isHealthy ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: {
        database: dbHealth,
        transcription: transcriptionHealth,
        system: systemHealth,
        services: servicesHealth,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 存活探针 (Liveness Probe)
 * 用于 Kubernetes 等容器编排系统
 * 检查进程是否存活（不检查依赖）
 */
router.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * 就绪探针 (Readiness Probe)
 * 检查服务是否准备好接受流量
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    // 检查数据库连接
    const dbHealth = await checkDatabase();
    
    if (dbHealth.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Database connection failed',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 检查数据库健康状态
 */
async function checkDatabase(): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: string;
  connectionCount?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // 执行简单查询
    await pool.query('SELECT 1');
    
    // 获取连接数
    const result = await pool.query(`
      SELECT count(*) AS connection_count
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    
    const connectionCount = parseInt(result.rows[0].connection_count);
    const responseTime = Date.now() - startTime;
    
    // 判断响应时间
    const status = responseTime > 1000 ? 'degraded' : 'healthy';
    
    return {
      status,
      responseTime: `${responseTime}ms`,
      connectionCount,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * 检查转录服务健康状态
 */
function checkTranscriptionServices(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  tingwu: {
    available: boolean;
    remainingQuota?: number;
    totalQuota?: number;
  };
} {
  const tingwu = {
    available: tingwuTranscriptionService.isAvailable(),
    ...(tingwuTranscriptionService.isAvailable() && {
      remainingQuota: tingwuTranscriptionService.getStats().remainingMinutes,
      totalQuota: tingwuTranscriptionService.getStats().freeMinutesLimit,
    }),
  };
  
  // 判断状态
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!tingwu.available) {
    status = 'unhealthy';
  } else if (tingwu.remainingQuota && tingwu.remainingQuota < 20) {
    status = 'degraded';
  }
  
  return {
    status,
    tingwu,
  };
}

/**
 * 检查系统资源
 */
function checkSystemResources(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  memory: {
    used: string;
    total: string;
    usagePercentage: number;
  };
  uptime: string;
  nodeVersion: string;
} {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const usagePercentage = Math.round((usedMemory / totalMemory) * 100);
  
  // 判断内存使用情况
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (usagePercentage > 90) {
    status = 'unhealthy';
  } else if (usagePercentage > 80) {
    status = 'degraded';
  }
  
  return {
    status,
    memory: {
      used: `${Math.round(usedMemory / 1024 / 1024)}MB`,
      total: `${Math.round(totalMemory / 1024 / 1024)}MB`,
      usagePercentage,
    },
    uptime: formatUptime(process.uptime()),
    nodeVersion: process.version,
  };
}

/**
 * 检查依赖服务配置
 */
function checkServices(): {
  openai: boolean;
  aliyun: boolean;
  sentry: boolean;
  email: boolean;
  alert: boolean;
} {
  return {
    openai: !!process.env.OPENAI_API_KEY,
    aliyun: !!(process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET),
    sentry: !!(process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN),
    email: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    alert: !!process.env.ALERT_EMAIL,
  };
}

/**
 * 格式化运行时间
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

export default router;

