/**
 * 百度统计配置和工具函数
 * 
 * 使用说明：
 * 1. 在百度统计 (https://tongji.baidu.com) 创建站点
 * 2. 获取站点 ID（在统计代码中的 hm.js? 后面的字符串）
 * 3. 在环境变量中设置 VITE_BAIDU_ANALYTICS_ID
 * 
 * 功能：
 * - 自动页面浏览统计 (PV/UV)
 * - 自定义事件追踪
 * - 用户行为分析
 */

// 声明百度统计全局变量类型
declare global {
  interface Window {
    _hmt: Array<[string, ...unknown[]]>;
  }
}

/**
 * 百度统计站点 ID
 */
const BAIDU_ANALYTICS_ID = import.meta.env.VITE_BAIDU_ANALYTICS_ID as string | undefined;

/**
 * 是否启用百度统计
 */
export const isAnalyticsEnabled = (): boolean => {
  return !!BAIDU_ANALYTICS_ID && BAIDU_ANALYTICS_ID.length > 0;
};

/**
 * 初始化百度统计
 * 在应用启动时调用一次
 */
export function initBaiduAnalytics(): boolean {
  if (!isAnalyticsEnabled()) {
    console.log('📊 百度统计未配置，数据埋点已禁用');
    console.log('💡 设置 VITE_BAIDU_ANALYTICS_ID 环境变量以启用百度统计');
    return false;
  }

  // 初始化 _hmt 数组
  window._hmt = window._hmt || [];

  // 动态加载百度统计脚本
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://hm.baidu.com/hm.js?${BAIDU_ANALYTICS_ID}`;
  
  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  console.log('📊 百度统计已初始化');
  return true;
}

/**
 * 追踪页面浏览
 * 用于 SPA 应用中的路由切换
 * 
 * @param pageUrl - 页面 URL（可选，默认使用当前 URL）
 */
export function trackPageView(pageUrl?: string): void {
  if (!isAnalyticsEnabled()) return;

  // 确保 _hmt 数组已初始化
  if (!window._hmt) {
    window._hmt = [];
  }

  const url = pageUrl || window.location.pathname + window.location.search;
  window._hmt.push(['_trackPageview', url]);
  
  if (import.meta.env.DEV) {
    console.log('📊 [Analytics] PageView:', url);
  }
}

/**
 * 追踪自定义事件
 * 
 * @param category - 事件类别（如：video, report, user）
 * @param action - 事件动作（如：submit, view, download）
 * @param label - 事件标签（可选，如：学生姓名、报告ID）
 * @param value - 事件值（可选，如：视频时长、处理耗时）
 * 
 * @example
 * // 追踪视频分析提交
 * trackEvent('video', 'analysis_submit', '张三', 180);
 * 
 * // 追踪报告查看
 * trackEvent('report', 'view', 'report-123');
 * 
 * // 追踪登录
 * trackEvent('user', 'login', 'success');
 */
export function trackEvent(
  category: string,
  action: string,
  label?: string,
  value?: number
): void {
  if (!isAnalyticsEnabled()) return;

  // 确保 _hmt 数组已初始化
  if (!window._hmt) {
    window._hmt = [];
  }

  window._hmt.push(['_trackEvent', category, action, label, value]);
  
  if (import.meta.env.DEV) {
    console.log('📊 [Analytics] Event:', { category, action, label, value });
  }
}

/**
 * 设置用户 ID（用于用户关联分析）
 * 
 * @param userId - 用户唯一标识
 */
export function setUserId(userId: string): void {
  if (!isAnalyticsEnabled()) return;

  // 确保 _hmt 数组已初始化
  if (!window._hmt) {
    window._hmt = [];
  }

  window._hmt.push(['_setUserId', userId]);
  
  if (import.meta.env.DEV) {
    console.log('📊 [Analytics] SetUserId:', userId);
  }
}

// ============================================
// 业务相关的便捷追踪函数
// ============================================

/**
 * 追踪视频分析事件
 */
export const AnalyticsEvents = {
  /**
   * 用户登录
   */
  login: (userId: string, method: 'password' | 'token' = 'password') => {
    trackEvent('user', 'login', method);
    setUserId(userId);
  },

  /**
   * 用户登出
   */
  logout: () => {
    trackEvent('user', 'logout');
  },

  /**
   * 开始视频分析
   */
  analysisStart: (studentName: string) => {
    trackEvent('video', 'analysis_start', studentName);
  },

  /**
   * 视频分析完成
   */
  analysisComplete: (studentName: string, durationSeconds: number) => {
    trackEvent('video', 'analysis_complete', studentName, durationSeconds);
  },

  /**
   * 视频分析失败
   */
  analysisFailed: (errorType: string) => {
    trackEvent('video', 'analysis_failed', errorType);
  },

  /**
   * 查看报告
   */
  reportView: (reportId: string) => {
    trackEvent('report', 'view', reportId);
  },

  /**
   * 查看历史报告
   */
  reportHistoryView: (reportId: string) => {
    trackEvent('report', 'history_view', reportId);
  },

  /**
   * 查看报告解读
   */
  interpretationView: (reportId: string) => {
    trackEvent('report', 'interpretation_view', reportId);
  },

  /**
   * 下载/打印报告
   */
  reportDownload: (reportId: string) => {
    trackEvent('report', 'download', reportId);
  },

  /**
   * 表单填写开始
   */
  formStart: () => {
    trackEvent('form', 'start');
  },

  /**
   * 表单提交
   */
  formSubmit: () => {
    trackEvent('form', 'submit');
  },

  /**
   * 表单验证失败
   */
  formValidationError: (field: string) => {
    trackEvent('form', 'validation_error', field);
  },
};

export default {
  init: initBaiduAnalytics,
  trackPageView,
  trackEvent,
  setUserId,
  isEnabled: isAnalyticsEnabled,
  events: AnalyticsEvents,
};

