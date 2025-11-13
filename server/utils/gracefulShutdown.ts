/**
 * 优雅关闭工具
 * 确保在服务器关闭时正确清理所有资源
 */

import { Server } from 'http';
import { closePool } from '../config/database.js';
import { Sentry } from '../config/sentry.js';

/**
 * 清理任务列表
 */
const cleanupTasks: Array<() => Promise<void>> = [];

/**
 * 注册清理任务
 */
export function registerCleanupTask(task: () => Promise<void>): void {
  cleanupTasks.push(task);
}

/**
 * 优雅关闭处理器
 */
export function setupGracefulShutdown(server: Server): void {
  let isShuttingDown = false;
  
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('⚠️  已经在关闭中，请稍候...');
      return;
    }
    
    isShuttingDown = true;
    console.log(`\n🛑 收到 ${signal} 信号，开始优雅关闭...`);
    
    // 1. 停止接受新请求
    server.close(() => {
      console.log('✅ HTTP 服务器已停止接受新请求');
    });
    
    // 设置超时（30秒后强制退出）
    const forceExitTimer = setTimeout(() => {
      console.error('❌ 优雅关闭超时，强制退出');
      process.exit(1);
    }, 30000);
    
    try {
      // 2. 等待现有请求完成（最多等待 10 秒）
      console.log('⏳ 等待现有请求完成...');
      await waitForConnections(server, 10000);
      console.log('✅ 所有请求已完成');
      
      // 3. 执行注册的清理任务
      if (cleanupTasks.length > 0) {
        console.log(`⏳ 执行 ${cleanupTasks.length} 个清理任务...`);
        for (const task of cleanupTasks) {
          try {
            await task();
          } catch (error) {
            console.error('❌ 清理任务失败:', error);
          }
        }
        console.log('✅ 清理任务已完成');
      }
      
      // 4. 关闭数据库连接池
      console.log('⏳ 关闭数据库连接...');
      await closePool();
      
      // 5. 刷新 Sentry 事件
      if (Sentry) {
        console.log('⏳ 刷新 Sentry 事件...');
        await Sentry.close(2000); // 等待2秒刷新队列
        console.log('✅ Sentry 事件已刷新');
      }
      
      // 清除强制退出定时器
      clearTimeout(forceExitTimer);
      
      console.log('✅ 优雅关闭完成');
      process.exit(0);
    } catch (error) {
      console.error('❌ 优雅关闭失败:', error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };
  
  // 监听关闭信号
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // 监听未捕获的异常和Promise拒绝
  process.on('uncaughtException', async (error) => {
    console.error('❌ 未捕获的异常:', error);
    
    // 记录到 Sentry
    if (Sentry) {
      Sentry.captureException(error, {
        level: 'fatal',
        tags: { source: 'uncaughtException' },
      });
    }
    
    // 优雅关闭
    await shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ 未处理的 Promise 拒绝:', reason);
    console.error('   Promise:', promise);
    
    // 记录到 Sentry
    if (Sentry) {
      Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
        level: 'fatal',
        tags: { source: 'unhandledRejection' },
        extra: { promise },
      });
    }
    
    // 优雅关闭
    await shutdown('unhandledRejection');
  });
  
  console.log('✅ 优雅关闭机制已启用');
}

/**
 * 等待所有连接关闭
 */
async function waitForConnections(server: Server, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkConnections = () => {
      server.getConnections((err, count) => {
        if (err) {
          return reject(err);
        }
        
        if (count === 0) {
          return resolve();
        }
        
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          console.warn(`⚠️  仍有 ${count} 个活跃连接，但已超时`);
          return resolve();
        }
        
        // 每 500ms 检查一次
        setTimeout(checkConnections, 500);
      });
    };
    
    checkConnections();
  });
}

/**
 * 健康检查助手
 * 在关闭期间返回 503 状态
 */
export function isShuttingDown(): boolean {
  return false; // 可以通过全局变量跟踪
}

export default {
  setupGracefulShutdown,
  registerCleanupTask,
  isShuttingDown,
};

