/**
 * 性能指标收集中间件
 * 收集和报告应用程序性能指标
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logging.js';
import os from 'os';

/**
 * 指标类型
 */
export interface Metric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp: number;
}

/**
 * 性能指标收集器
 */
class MetricsCollector {
  private metrics: Map<string, Metric[]>;
  private readonly maxMetricsPerType = 1000; // 每种指标最多保留1000条
  private reportInterval: NodeJS.Timeout | null = null;
  
  // 请求统计
  private requestCount = 0;
  private requestErrors = 0;
  private requestDurations: number[] = [];
  
  // 端点统计
  private endpointStats = new Map<string, {
    count: number;
    totalDuration: number;
    errors: number;
    minDuration: number;
    maxDuration: number;
  }>();
  
  constructor() {
    this.metrics = new Map();
  }
  
  /**
   * 记录指标
   */
  record(name: string, value: number, unit: string = '', tags?: Record<string, string>) {
    const metric: Metric = {
      name,
      value,
      unit,
      tags,
      timestamp: Date.now(),
    };
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricsArray = this.metrics.get(name)!;
    metricsArray.push(metric);
    
    // 限制每种指标的数量
    if (metricsArray.length > this.maxMetricsPerType) {
      metricsArray.shift();
    }
  }
  
  /**
   * 记录请求指标
   */
  recordRequest(method: string, path: string, statusCode: number, duration: number) {
    this.requestCount++;
    this.requestDurations.push(duration);
    
    if (statusCode >= 500) {
      this.requestErrors++;
    }
    
    // 记录端点统计
    const endpoint = `${method} ${path}`;
    if (!this.endpointStats.has(endpoint)) {
      this.endpointStats.set(endpoint, {
        count: 0,
        totalDuration: 0,
        errors: 0,
        minDuration: Infinity,
        maxDuration: 0,
      });
    }
    
    const stats = this.endpointStats.get(endpoint)!;
    stats.count++;
    stats.totalDuration += duration;
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    
    if (statusCode >= 500) {
      stats.errors++;
    }
    
    // 保留最近1000个请求时长
    if (this.requestDurations.length > 1000) {
      this.requestDurations.shift();
    }
  }
  
  /**
   * 获取指标统计
   */
  getMetrics(name: string): Metric[] {
    return this.metrics.get(name) || [];
  }
  
  /**
   * 获取所有指标
   */
  getAllMetrics(): Map<string, Metric[]> {
    return this.metrics;
  }
  
  /**
   * 清除指标
   */
  clear(name?: string) {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
  
  /**
   * 获取请求统计
   */
  getRequestStats() {
    const durations = this.requestDurations;
    const sorted = [...durations].sort((a, b) => a - b);
    
    const percentile = (p: number) => {
      if (sorted.length === 0) return 0;
      const index = Math.ceil((sorted.length * p) / 100) - 1;
      return sorted[Math.max(0, index)];
    };
    
    return {
      total: this.requestCount,
      errors: this.requestErrors,
      errorRate: this.requestCount > 0 ? (this.requestErrors / this.requestCount) * 100 : 0,
      avgDuration: durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      minDuration: sorted.length > 0 ? sorted[0] : 0,
      maxDuration: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    };
  }
  
  /**
   * 获取端点统计（前10个最慢的端点）
   */
  getTopSlowEndpoints(limit: number = 10) {
    const endpoints = Array.from(this.endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
        minDuration: stats.minDuration,
        maxDuration: stats.maxDuration,
        errors: stats.errors,
        errorRate: (stats.errors / stats.count) * 100,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
    
    return endpoints;
  }
  
  /**
   * 获取系统资源使用情况
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      cpu: {
        user: cpuUsage.user / 1000, // 转换为毫秒
        system: cpuUsage.system / 1000,
      },
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        cpuCores: os.cpus().length,
        loadAverage: os.loadavg(),
        uptime: os.uptime(),
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
      },
    };
  }
  
  /**
   * 生成完整的性能报告
   */
  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      requests: this.getRequestStats(),
      endpoints: this.getTopSlowEndpoints(10),
      system: this.getSystemMetrics(),
    };
  }
  
  /**
   * 启动定期报告
   */
  startPeriodicReporting(intervalMinutes: number = 15) {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
    
    this.reportInterval = setInterval(() => {
      const report = this.generateReport();
      logger.info('metrics', 'Periodic performance report', report);
      
      // 检查异常情况并告警
      this.checkAndAlert(report);
    }, intervalMinutes * 60 * 1000);
    
    logger.info('metrics', `Started periodic reporting every ${intervalMinutes} minutes`);
  }
  
  /**
   * 停止定期报告
   */
  stopPeriodicReporting() {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
      logger.info('metrics', 'Stopped periodic reporting');
    }
  }
  
  /**
   * 检查指标并发送告警
   */
  private checkAndAlert(report: ReturnType<typeof this.generateReport>) {
    const { requests, system } = report;
    
    // 检查错误率
    if (requests.errorRate > 5) {
      logger.warn('metrics_alert', `High error rate detected: ${requests.errorRate.toFixed(2)}%`, {
        errorRate: requests.errorRate,
        totalRequests: requests.total,
        errors: requests.errors,
      });
    }
    
    // 检查慢请求
    if (requests.p95 > 5000) {
      logger.warn('metrics_alert', `Slow requests detected (p95: ${requests.p95}ms)`, {
        p95: requests.p95,
        p99: requests.p99,
        avgDuration: requests.avgDuration,
      });
    }
    
    // 检查内存使用
    if (system.memory.heapUsedPercent > 90) {
      logger.warn('metrics_alert', `High memory usage: ${system.memory.heapUsedPercent.toFixed(2)}%`, {
        heapUsed: system.memory.heapUsed,
        heapTotal: system.memory.heapTotal,
      });
    }
    
    // 检查系统内存
    if (system.system.memoryUsagePercent > 90) {
      logger.warn('metrics_alert', `High system memory usage: ${system.system.memoryUsagePercent.toFixed(2)}%`, {
        totalMemory: system.system.totalMemory,
        freeMemory: system.system.freeMemory,
      });
    }
  }
  
  /**
   * 重置统计
   */
  reset() {
    this.requestCount = 0;
    this.requestErrors = 0;
    this.requestDurations = [];
    this.endpointStats.clear();
    this.metrics.clear();
  }
}

// 导出单例
export const metricsCollector = new MetricsCollector();

/**
 * 性能指标收集中间件
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // 记录请求指标
    metricsCollector.recordRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      duration
    );
  });
  
  next();
}

/**
 * 性能指标端点
 */
export function createMetricsEndpoint() {
  return (req: Request, res: Response) => {
    const format = req.query.format as string || 'json';
    
    if (format === 'prometheus') {
      // Prometheus 格式
      const report = metricsCollector.generateReport();
      const promMetrics = [
        `# HELP http_requests_total Total number of HTTP requests`,
        `# TYPE http_requests_total counter`,
        `http_requests_total ${report.requests.total}`,
        ``,
        `# HELP http_request_errors_total Total number of HTTP request errors`,
        `# TYPE http_request_errors_total counter`,
        `http_request_errors_total ${report.requests.errors}`,
        ``,
        `# HELP http_request_duration_ms HTTP request duration in milliseconds`,
        `# TYPE http_request_duration_ms summary`,
        `http_request_duration_ms{quantile="0.5"} ${report.requests.p50}`,
        `http_request_duration_ms{quantile="0.95"} ${report.requests.p95}`,
        `http_request_duration_ms{quantile="0.99"} ${report.requests.p99}`,
        ``,
        `# HELP process_heap_bytes Process heap size in bytes`,
        `# TYPE process_heap_bytes gauge`,
        `process_heap_bytes ${report.system.memory.heapUsed}`,
        ``,
        `# HELP system_memory_usage_percent System memory usage percentage`,
        `# TYPE system_memory_usage_percent gauge`,
        `system_memory_usage_percent ${report.system.system.memoryUsagePercent}`,
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(promMetrics);
    } else {
      // JSON 格式
      const report = metricsCollector.generateReport();
      res.json(report);
    }
  };
}

/**
 * 启用性能监控
 */
export function enablePerformanceMonitoring(reportIntervalMinutes: number = 15) {
  metricsCollector.startPeriodicReporting(reportIntervalMinutes);
  
  // 记录系统指标
  setInterval(() => {
    const sysMetrics = metricsCollector.getSystemMetrics();
    
    metricsCollector.record('memory_heap_used', sysMetrics.memory.heapUsed, 'bytes');
    metricsCollector.record('memory_heap_total', sysMetrics.memory.heapTotal, 'bytes');
    metricsCollector.record('memory_heap_used_percent', sysMetrics.memory.heapUsedPercent, '%');
    metricsCollector.record('system_memory_usage_percent', sysMetrics.system.memoryUsagePercent, '%');
    metricsCollector.record('cpu_user', sysMetrics.cpu.user, 'ms');
    metricsCollector.record('cpu_system', sysMetrics.cpu.system, 'ms');
  }, 60 * 1000); // 每分钟记录一次
  
  logger.info('metrics', 'Performance monitoring enabled', {
    reportInterval: `${reportIntervalMinutes} minutes`,
  });
}

/**
 * 禁用性能监控
 */
export function disablePerformanceMonitoring() {
  metricsCollector.stopPeriodicReporting();
  logger.info('metrics', 'Performance monitoring disabled');
}

