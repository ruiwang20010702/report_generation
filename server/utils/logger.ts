/**
 * 生产级日志系统
 * 
 * 特性：
 * - 环境感知：生产环境自动降低日志级别
 * - 可配置：通过 LOG_LEVEL 环境变量控制
 * - 结构化：支持 JSON 格式输出（便于日志聚合）
 * - 分类：按模块/类别组织日志
 * - 性能：生产环境跳过 DEBUG 级别日志的字符串拼接
 */

export enum LogLevel {
  SILENT = 0,   // 完全静默
  ERROR = 1,    // 仅错误
  WARN = 2,     // 警告 + 错误
  INFO = 3,     // 信息 + 警告 + 错误
  DEBUG = 4,    // 调试（开发环境默认）
  VERBOSE = 5,  // 详细（包含所有内容）
}

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

// 日志级别对应的颜色和标签
const levelConfig: Record<LogLevel, { color: string; label: string; emoji: string }> = {
  [LogLevel.SILENT]: { color: '', label: '', emoji: '' },
  [LogLevel.ERROR]: { color: colors.red, label: 'ERROR', emoji: '❌' },
  [LogLevel.WARN]: { color: colors.yellow, label: 'WARN ', emoji: '⚠️' },
  [LogLevel.INFO]: { color: colors.blue, label: 'INFO ', emoji: 'ℹ️' },
  [LogLevel.DEBUG]: { color: colors.gray, label: 'DEBUG', emoji: '🔍' },
  [LogLevel.VERBOSE]: { color: colors.dim, label: 'VERB ', emoji: '📝' },
};

/**
 * 日志格式类型
 * - json: 结构化 JSON（适合日志聚合系统）
 * - pretty: 彩色可读格式（适合开发环境）
 * - compact: 简洁可读格式（适合生产环境人工查看）
 */
export type LogFormat = 'json' | 'pretty' | 'compact';

interface LoggerConfig {
  level: LogLevel;
  format: LogFormat;      // 日志格式
  useColors: boolean;     // 是否使用颜色
  useEmoji: boolean;      // 是否使用 emoji
  showTimestamp: boolean; // 是否显示时间戳
  showModule: boolean;    // 是否显示模块名
}

/**
 * 解析环境变量中的日志级别
 */
function parseLogLevel(envValue: string | undefined): LogLevel {
  if (!envValue) return LogLevel.DEBUG;
  
  const normalized = envValue.toUpperCase();
  switch (normalized) {
    case 'SILENT': case '0': return LogLevel.SILENT;
    case 'ERROR': case '1': return LogLevel.ERROR;
    case 'WARN': case '2': return LogLevel.WARN;
    case 'INFO': case '3': return LogLevel.INFO;
    case 'DEBUG': case '4': return LogLevel.DEBUG;
    case 'VERBOSE': case '5': return LogLevel.VERBOSE;
    default: return LogLevel.DEBUG;
  }
}

/**
 * 解析日志格式
 */
function parseLogFormat(envValue: string | undefined, isProduction: boolean): LogFormat {
  if (!envValue) {
    // 默认：生产环境用 compact（人类可读），开发环境用 pretty
    return isProduction ? 'compact' : 'pretty';
  }
  
  const normalized = envValue.toLowerCase();
  if (normalized === 'json' || normalized === 'pretty' || normalized === 'compact') {
    return normalized;
  }
  
  return isProduction ? 'compact' : 'pretty';
}

/**
 * 获取默认配置
 */
function getDefaultConfig(): LoggerConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const envLogLevel = process.env.LOG_LEVEL;
  const format = parseLogFormat(process.env.LOG_FORMAT, isProduction);
  
  return {
    // 生产环境默认 INFO，开发环境默认 DEBUG
    // 可通过 LOG_LEVEL 环境变量覆盖
    level: envLogLevel 
      ? parseLogLevel(envLogLevel) 
      : (isProduction ? LogLevel.INFO : LogLevel.DEBUG),
    
    // 日志格式
    format,
    
    // 非 JSON 模式下使用颜色（compact 模式也可以有颜色）
    useColors: format !== 'json',
    
    // 开发环境使用 emoji
    useEmoji: format === 'pretty',
    
    showTimestamp: true,
    showModule: true,
  };
}

// 全局配置
let globalConfig: LoggerConfig = getDefaultConfig();

/**
 * 更新全局日志配置
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * 获取当前日志级别
 */
export function getLogLevel(): LogLevel {
  return globalConfig.level;
}

/**
 * 设置日志级别
 */
export function setLogLevel(level: LogLevel): void {
  globalConfig.level = level;
}

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 格式化时间（简短格式）
 */
function formatTimeShort(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * 安全地序列化对象（处理循环引用）
 */
function safeStringify(obj: any, indent?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // 处理 Error 对象
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    return value;
  }, indent);
}

/**
 * 创建模块日志器
 */
export function createLogger(module: string) {
  const shouldLog = (level: LogLevel): boolean => {
    return level <= globalConfig.level;
  };

  const formatMessage = (level: LogLevel, message: string, data?: any): void => {
    if (!shouldLog(level)) return;

    const config = globalConfig;
    const levelInfo = levelConfig[level];

    // 输出函数
    const output = (text: string) => {
      if (level === LogLevel.ERROR) {
        console.error(text);
      } else if (level === LogLevel.WARN) {
        console.warn(text);
      } else {
        console.log(text);
      }
    };

    if (config.format === 'json') {
      // JSON 格式输出（适合日志聚合系统）
      const logEntry: Record<string, any> = {
        timestamp: new Date().toISOString(),
        level: levelInfo.label.trim(),
        module,
        message,
      };
      
      if (data !== undefined) {
        if (data instanceof Error) {
          logEntry.error = {
            name: data.name,
            message: data.message,
            stack: data.stack,
          };
        } else {
          logEntry.data = data;
        }
      }

      output(safeStringify(logEntry));
      
    } else if (config.format === 'compact') {
      // Compact 格式：简洁的单行输出，适合生产环境人工查看
      // 格式: HH:MM:SS LEVEL [Module] Message {key=value}
      const time = formatTimeShort();
      const levelTag = levelInfo.label.trim().padEnd(5);
      
      // 构建输出
      let line = '';
      
      if (config.useColors) {
        // 彩色 compact 格式
        line = `${colors.dim}${time}${colors.reset} `;
        line += `${levelInfo.color}${levelTag}${colors.reset} `;
        line += `${colors.cyan}[${module}]${colors.reset} `;
        line += message;
      } else {
        // 无色 compact 格式
        line = `${time} ${levelTag} [${module}] ${message}`;
      }
      
      // 附加数据：使用 key=value 格式，更简洁
      if (data !== undefined) {
        if (data instanceof Error) {
          line += config.useColors 
            ? ` ${colors.red}error="${data.message}"${colors.reset}`
            : ` error="${data.message}"`;
          if (level === LogLevel.ERROR && data.stack) {
            line += '\n' + data.stack;
          }
        } else if (typeof data === 'object') {
          // 将对象转换为 key=value 格式
          const kvPairs: string[] = [];
          for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) continue;
            const v = typeof value === 'object' ? safeStringify(value) : String(value);
            // 截断过长的值
            const truncated = v.length > 100 ? v.substring(0, 100) + '...' : v;
            kvPairs.push(`${key}=${truncated}`);
          }
          if (kvPairs.length > 0) {
            const dataStr = kvPairs.join(' ');
            line += config.useColors 
              ? ` ${colors.dim}${dataStr}${colors.reset}`
              : ` ${dataStr}`;
          }
        } else {
          line += ` ${String(data)}`;
        }
      }
      
      output(line);
      
    } else {
      // Pretty 格式：彩色可读格式，适合开发环境
      const parts: string[] = [];

      // 时间戳
      if (config.showTimestamp) {
        const time = formatTimeShort();
        parts.push(config.useColors ? `${colors.dim}${time}${colors.reset}` : time);
      }

      // 日志级别
      const label = config.useEmoji ? levelInfo.emoji : `[${levelInfo.label}]`;
      parts.push(config.useColors ? `${levelInfo.color}${label}${colors.reset}` : label);

      // 模块名
      if (config.showModule) {
        const moduleTag = `[${module}]`;
        parts.push(config.useColors ? `${colors.cyan}${moduleTag}${colors.reset}` : moduleTag);
      }

      // 消息
      parts.push(message);

      // 附加数据
      if (data !== undefined) {
        if (data instanceof Error) {
          parts.push(config.useColors 
            ? `${colors.red}${data.message}${colors.reset}`
            : data.message);
          if (level === LogLevel.ERROR && data.stack) {
            parts.push('\n' + data.stack);
          }
        } else if (typeof data === 'object') {
          const dataStr = safeStringify(data, 2);
          // 如果数据太长，截断显示
          if (dataStr.length > 500 && level !== LogLevel.VERBOSE) {
            parts.push(config.useColors 
              ? `${colors.dim}${dataStr.substring(0, 500)}...${colors.reset}`
              : `${dataStr.substring(0, 500)}...`);
          } else {
            parts.push(config.useColors 
              ? `${colors.dim}${dataStr}${colors.reset}`
              : dataStr);
          }
        } else {
          parts.push(String(data));
        }
      }

      output(parts.join(' '));
    }
  };

  return {
    /**
     * 错误日志 - 始终显示（除非 SILENT）
     */
    error: (message: string, data?: any) => formatMessage(LogLevel.ERROR, message, data),

    /**
     * 警告日志 - 生产环境显示
     */
    warn: (message: string, data?: any) => formatMessage(LogLevel.WARN, message, data),

    /**
     * 信息日志 - 生产环境显示（重要业务事件）
     */
    info: (message: string, data?: any) => formatMessage(LogLevel.INFO, message, data),

    /**
     * 调试日志 - 仅开发环境显示
     */
    debug: (message: string, data?: any) => formatMessage(LogLevel.DEBUG, message, data),

    /**
     * 详细日志 - 需要手动开启
     */
    verbose: (message: string, data?: any) => formatMessage(LogLevel.VERBOSE, message, data),

    /**
     * 条件日志 - 只在满足条件时输出
     */
    debugIf: (condition: boolean, message: string, data?: any) => {
      if (condition) formatMessage(LogLevel.DEBUG, message, data);
    },

    /**
     * 分组开始
     */
    group: (label: string) => {
      if (shouldLog(LogLevel.DEBUG)) {
        const config = globalConfig;
        if (config.format !== 'json') {
          const separator = '─'.repeat(50);
          console.log(config.useColors 
            ? `\n${colors.cyan}┌${separator}${colors.reset}`
            : `\n┌${separator}`);
          console.log(config.useColors 
            ? `${colors.cyan}│ ${label}${colors.reset}`
            : `│ ${label}`);
          console.log(config.useColors 
            ? `${colors.cyan}└${separator}${colors.reset}`
            : `└${separator}`);
        }
      }
    },

    /**
     * 进度日志（用于长时间操作）
     */
    progress: (step: string, current?: number, total?: number) => {
      if (shouldLog(LogLevel.INFO)) {
        const progress = current !== undefined && total !== undefined 
          ? ` (${current}/${total})`
          : '';
        formatMessage(LogLevel.INFO, `${step}${progress}`);
      }
    },

    /**
     * 性能计时
     */
    time: (label: string): () => void => {
      const start = Date.now();
      return () => {
        const duration = Date.now() - start;
        formatMessage(LogLevel.DEBUG, `${label} completed`, { duration: `${duration}ms` });
      };
    },

    /**
     * 检查是否应该输出某级别日志
     */
    shouldLog,
  };
}

// 预创建常用模块的日志器
export const log = {
  analysis: createLogger('Analysis'),
  transcription: createLogger('Transcription'),
  ai: createLogger('AI'),
  db: createLogger('Database'),
  auth: createLogger('Auth'),
  job: createLogger('JobQueue'),
  http: createLogger('HTTP'),
  email: createLogger('Email'),
  system: createLogger('System'),
};

// 默认导出
export default log;

/**
 * 控制台日志包装器
 * 用于在不修改大量代码的情况下控制 console.log 输出
 * 
 * 使用方法：在应用启动时调用 installConsoleWrapper()
 */
let originalConsole: {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
  info: typeof console.info;
} | null = null;

/**
 * 日志过滤规则
 */
interface LogFilter {
  // 包含这些关键词的日志会被过滤（生产环境）
  suppressPatterns: RegExp[];
  // 始终显示的关键词（即使匹配了 suppress）
  alwaysShowPatterns: RegExp[];
}

const defaultFilter: LogFilter = {
  suppressPatterns: [
    // 调试信息
    /^\s*📝\s*\[DEV\]/,
    /^\s*🔍\s*\[调试\]/,
    /^\s*📊\s*\[DEV\]/,
    /^\s*\[DEV\]/,
    // 详细的中间步骤
    /提取的关键数据/,
    /传递给AI的数据/,
    /学生单词来源/,
    /AI 模型返回的原始数据/,
    /overallSuggestions 更新对比/,
    // 冗长的 JSON 输出
    /^\s*\{[\s\S]{500,}\}\s*$/,
  ],
  alwaysShowPatterns: [
    // 错误和警告始终显示
    /❌|⚠️|ERROR|WARN|失败|错误/,
    // 重要业务事件
    /分析完成|任务完成|开始处理|处理完成/,
    // 成本相关
    /费用|成本|cost/i,
  ],
};

/**
 * 检查消息是否应该被过滤
 */
function shouldFilter(args: any[], filter: LogFilter): boolean {
  const message = args.map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg)
  ).join(' ');
  
  // 检查是否匹配 alwaysShow
  for (const pattern of filter.alwaysShowPatterns) {
    if (pattern.test(message)) {
      return false;
    }
  }
  
  // 检查是否匹配 suppress
  for (const pattern of filter.suppressPatterns) {
    if (pattern.test(message)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 安装控制台包装器
 * 在生产环境自动过滤调试日志
 */
export function installConsoleWrapper(customFilter?: Partial<LogFilter>): void {
  // 避免重复安装
  if (originalConsole) {
    return;
  }
  
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = getLogLevel();
  
  // 保存原始 console 方法
  originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
  };
  
  const filter: LogFilter = {
    suppressPatterns: [
      ...defaultFilter.suppressPatterns,
      ...(customFilter?.suppressPatterns || []),
    ],
    alwaysShowPatterns: [
      ...defaultFilter.alwaysShowPatterns,
      ...(customFilter?.alwaysShowPatterns || []),
    ],
  };
  
  // 包装 console.log
  console.log = (...args: any[]) => {
    // 生产环境且日志级别低于 DEBUG 时过滤
    if (isProduction && logLevel < LogLevel.DEBUG) {
      if (shouldFilter(args, filter)) {
        return;
      }
    }
    originalConsole!.log(...args);
  };
  
  // console.info 同 console.log
  console.info = (...args: any[]) => {
    if (isProduction && logLevel < LogLevel.DEBUG) {
      if (shouldFilter(args, filter)) {
        return;
      }
    }
    originalConsole!.info(...args);
  };
  
  // console.warn 仅在 WARN 级别以上过滤
  console.warn = (...args: any[]) => {
    if (logLevel < LogLevel.WARN) {
      return;
    }
    originalConsole!.warn(...args);
  };
  
  // console.error 始终显示（除非 SILENT）
  console.error = (...args: any[]) => {
    if (logLevel === LogLevel.SILENT) {
      return;
    }
    originalConsole!.error(...args);
  };
  
  if (isProduction) {
    originalConsole.log('📋 [Logger] Console wrapper installed - production mode, filtering debug logs');
  }
}

/**
 * 卸载控制台包装器（恢复原始行为）
 */
export function uninstallConsoleWrapper(): void {
  if (originalConsole) {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    originalConsole = null;
  }
}

/**
 * 临时启用详细日志（用于调试）
 */
export function withVerboseLogging<T>(fn: () => T): T {
  const wasInstalled = originalConsole !== null;
  
  if (wasInstalled) {
    uninstallConsoleWrapper();
  }
  
  try {
    return fn();
  } finally {
    if (wasInstalled) {
      installConsoleWrapper();
    }
  }
}

