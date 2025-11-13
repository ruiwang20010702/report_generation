/**
 * 告警通知服务
 * 用于系统监控和异常告警
 */

import { sendEmail } from './emailService';
import { Sentry } from '../config/sentry';

/**
 * 告警类型
 */
export enum AlertType {
  QUOTA_WARNING = 'quota_warning',      // 额度预警
  QUOTA_CRITICAL = 'quota_critical',    // 额度严重不足
  ERROR_RATE_HIGH = 'error_rate_high',  // 错误率过高
  DATABASE_ERROR = 'database_error',    // 数据库连接错误
  SERVICE_ERROR = 'service_error',      // 服务异常
  PERFORMANCE_SLOW = 'performance_slow', // 性能过慢
}

/**
 * 告警级别
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * 告警数据接口
 */
interface AlertData {
  type: AlertType;
  level: AlertLevel;
  message: string;
  details: Record<string, any>;
  timestamp: string;
}

/**
 * 告警配置
 */
const ALERT_CONFIG = {
  // 告警接收邮箱（从环境变量读取）
  recipients: (process.env.ALERT_EMAIL || '').split(',').filter(Boolean),
  
  // 告警发送频率限制（避免短时间内重复发送）
  cooldownMinutes: 30,
  
  // 额度告警阈值
  quotaThresholds: {
    warning: 20,   // 剩余20分钟时预警
    critical: 5,   // 剩余5分钟时严重告警
  },
  
  // 错误率告警阈值
  errorRateThreshold: 0.05, // 5%
};

/**
 * 告警历史记录（内存存储，用于避免重复告警）
 */
const alertHistory = new Map<string, number>();

/**
 * 检查是否应该发送告警（基于冷却时间）
 */
function shouldSendAlert(alertKey: string): boolean {
  const lastAlertTime = alertHistory.get(alertKey);
  
  if (!lastAlertTime) {
    return true;
  }
  
  const now = Date.now();
  const cooldownMs = ALERT_CONFIG.cooldownMinutes * 60 * 1000;
  
  return (now - lastAlertTime) > cooldownMs;
}

/**
 * 记录告警发送时间
 */
function recordAlert(alertKey: string): void {
  alertHistory.set(alertKey, Date.now());
}

/**
 * 生成告警键（用于去重）
 */
function getAlertKey(type: AlertType, details: Record<string, any>): string {
  return `${type}_${JSON.stringify(details)}`;
}

/**
 * 格式化告警邮件内容
 */
function formatAlertEmail(alert: AlertData): { subject: string; html: string } {
  const levelEmoji = {
    [AlertLevel.INFO]: 'ℹ️',
    [AlertLevel.WARNING]: '⚠️',
    [AlertLevel.CRITICAL]: '🚨',
  };
  
  const levelColor = {
    [AlertLevel.INFO]: '#3b82f6',
    [AlertLevel.WARNING]: '#f59e0b',
    [AlertLevel.CRITICAL]: '#ef4444',
  };
  
  const subject = `${levelEmoji[alert.level]} [${alert.level.toUpperCase()}] ${alert.message}`;
  
  const detailsHtml = Object.entries(alert.details)
    .map(([key, value]) => {
      return `<tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: 600;">${key}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${
          typeof value === 'object' ? JSON.stringify(value, null, 2) : value
        }</td>
      </tr>`;
    })
    .join('');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert-header { 
          background-color: ${levelColor[alert.level]}; 
          color: white; 
          padding: 20px; 
          border-radius: 8px 8px 0 0; 
        }
        .alert-body { 
          background-color: #f9fafb; 
          padding: 20px; 
          border: 1px solid #e5e7eb; 
          border-top: none; 
          border-radius: 0 0 8px 8px; 
        }
        .details-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 15px; 
        }
        .footer { 
          margin-top: 20px; 
          padding-top: 20px; 
          border-top: 1px solid #e5e7eb; 
          font-size: 12px; 
          color: #6b7280; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="alert-header">
          <h2 style="margin: 0;">${levelEmoji[alert.level]} ${alert.message}</h2>
        </div>
        <div class="alert-body">
          <p><strong>告警级别：</strong> ${alert.level.toUpperCase()}</p>
          <p><strong>告警类型：</strong> ${alert.type}</p>
          <p><strong>发生时间：</strong> ${alert.timestamp}</p>
          
          <h3>详细信息</h3>
          <table class="details-table">
            ${detailsHtml}
          </table>
          
          <div class="footer">
            <p>此邮件由 51Talk 英语学习分析系统自动发送</p>
            <p>请及时处理告警信息，确保系统正常运行</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

/**
 * 发送告警通知
 */
export async function sendAlert(
  type: AlertType,
  level: AlertLevel,
  message: string,
  details: Record<string, any>
): Promise<boolean> {
  // 如果没有配置告警邮箱，仅记录日志
  if (ALERT_CONFIG.recipients.length === 0) {
    console.warn('⚠️  告警邮箱未配置，无法发送告警通知');
    console.warn(`   告警信息: ${message}`, details);
    return false;
  }
  
  // 检查是否应该发送告警（避免重复）
  const alertKey = getAlertKey(type, details);
  if (!shouldSendAlert(alertKey)) {
    console.log(`ℹ️  告警冷却中，跳过发送: ${message}`);
    return false;
  }
  
  try {
    const alert: AlertData = {
      type,
      level,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
    
    const { subject, html } = formatAlertEmail(alert);
    
    // 发送邮件给所有接收人
    for (const recipient of ALERT_CONFIG.recipients) {
      await sendEmail({
        to: recipient.trim(),
        subject,
        html,
      });
    }
    
    // 记录告警时间
    recordAlert(alertKey);
    
    // 记录到 Sentry（如果启用）
    if (level === AlertLevel.CRITICAL) {
      Sentry?.captureMessage(message, {
        level: 'error',
        tags: { alertType: type },
        extra: details,
      });
    }
    
    console.log(`✅ 告警通知已发送: ${message}`);
    return true;
  } catch (error) {
    console.error('❌ 发送告警通知失败:', error);
    
    // 发送失败也记录到 Sentry
    Sentry?.captureException(error, {
      tags: { alertType: type, operation: 'send-alert' },
      extra: { message, details },
    });
    
    return false;
  }
}

/**
 * 额度预警
 */
export async function alertQuotaWarning(service: string, remainingMinutes: number, totalMinutes: number): Promise<void> {
  const usagePercentage = ((totalMinutes - remainingMinutes) / totalMinutes * 100).toFixed(1);
  
  // 判断告警级别
  let level = AlertLevel.INFO;
  if (remainingMinutes <= ALERT_CONFIG.quotaThresholds.critical) {
    level = AlertLevel.CRITICAL;
  } else if (remainingMinutes <= ALERT_CONFIG.quotaThresholds.warning) {
    level = AlertLevel.WARNING;
  } else {
    return; // 额度充足，不发送告警
  }
  
  await sendAlert(
    level === AlertLevel.CRITICAL ? AlertType.QUOTA_CRITICAL : AlertType.QUOTA_WARNING,
    level,
    `${service} 免费额度即将用完`,
    {
      服务名称: service,
      剩余分钟数: `${remainingMinutes} 分钟`,
      总额度: `${totalMinutes} 分钟`,
      使用率: `${usagePercentage}%`,
      建议: level === AlertLevel.CRITICAL
        ? '⚠️ 额度严重不足，请立即充值或限制使用'
        : '💡 建议尽快充值或优化使用策略',
    }
  );
}

/**
 * 错误率告警
 */
export async function alertHighErrorRate(errorRate: number, errorCount: number, totalRequests: number): Promise<void> {
  if (errorRate < ALERT_CONFIG.errorRateThreshold) {
    return; // 错误率正常
  }
  
  await sendAlert(
    AlertType.ERROR_RATE_HIGH,
    AlertLevel.CRITICAL,
    '系统错误率过高',
    {
      错误率: `${(errorRate * 100).toFixed(2)}%`,
      错误数量: errorCount,
      总请求数: totalRequests,
      阈值: `${(ALERT_CONFIG.errorRateThreshold * 100)}%`,
      建议: '请检查系统日志和 Sentry 错误追踪',
    }
  );
}

/**
 * 数据库错误告警
 */
export async function alertDatabaseError(error: Error, operation: string): Promise<void> {
  await sendAlert(
    AlertType.DATABASE_ERROR,
    AlertLevel.CRITICAL,
    '数据库连接失败',
    {
      操作: operation,
      错误信息: error.message,
      错误类型: error.name,
      建议: '请检查数据库连接配置和服务状态',
    }
  );
}

/**
 * 服务异常告警
 */
export async function alertServiceError(service: string, error: Error, context?: Record<string, any>): Promise<void> {
  await sendAlert(
    AlertType.SERVICE_ERROR,
    AlertLevel.CRITICAL,
    `${service} 服务异常`,
    {
      服务名称: service,
      错误信息: error.message,
      错误类型: error.name,
      上下文: context || {},
      建议: '请检查服务配置和API密钥',
    }
  );
}

/**
 * 性能告警
 */
export async function alertSlowPerformance(operation: string, duration: number, threshold: number): Promise<void> {
  if (duration < threshold) {
    return; // 性能正常
  }
  
  await sendAlert(
    AlertType.PERFORMANCE_SLOW,
    AlertLevel.WARNING,
    `${operation} 响应过慢`,
    {
      操作名称: operation,
      响应时间: `${duration}ms`,
      阈值: `${threshold}ms`,
      超出时间: `${duration - threshold}ms`,
      建议: '请检查数据库查询、API调用和网络状况',
    }
  );
}

/**
 * 测试告警系统
 */
export async function testAlertSystem(): Promise<boolean> {
  console.log('🧪 测试告警系统...');
  
  if (ALERT_CONFIG.recipients.length === 0) {
    console.log('⚠️  未配置告警邮箱 (ALERT_EMAIL)');
    console.log('💡 设置 ALERT_EMAIL=your@email.com 以启用告警通知');
    return false;
  }
  
  try {
    const success = await sendAlert(
      AlertType.SERVICE_ERROR,
      AlertLevel.INFO,
      '告警系统测试',
      {
        测试时间: new Date().toISOString(),
        配置邮箱: ALERT_CONFIG.recipients.join(', '),
        说明: '这是一条测试告警，如果收到此邮件，说明告警系统配置正确',
      }
    );
    
    if (success) {
      console.log('✅ 告警系统测试成功');
      return true;
    } else {
      console.log('❌ 告警系统测试失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 告警系统测试异常:', error);
    return false;
  }
}

export default {
  sendAlert,
  alertQuotaWarning,
  alertHighErrorRate,
  alertDatabaseError,
  alertServiceError,
  alertSlowPerformance,
  testAlertSystem,
};

