/**
 * 日期时间工具函数
 * 用于处理时区转换，默认使用北京时间 (UTC+8)
 */

// 北京时间偏移量（毫秒）
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 将 UTC 时间转换为北京时间的 ISO 字符串
 * @param date - 日期对象、时间戳或日期字符串
 * @returns 北京时间的 ISO 格式字符串（带 +08:00 时区标识）
 */
export function toBeijingTime(date: Date | string | number): string {
  const d = new Date(date);
  const beijingTime = new Date(d.getTime() + BEIJING_OFFSET_MS);
  // 格式: 2025-11-28T11:05:31+08:00（精确到秒）
  return beijingTime.toISOString().substring(0, 19) + '+08:00';
}

/**
 * 将 UTC 时间转换为北京时间的友好格式
 * @param date - 日期对象、时间戳或日期字符串
 * @returns 北京时间的友好格式字符串（如：2025-11-28 11:05:31）
 */
export function toBeijingTimeFormatted(date: Date | string | number): string {
  const d = new Date(date);
  const beijingTime = new Date(d.getTime() + BEIJING_OFFSET_MS);
  return beijingTime.toISOString()
    .replace('T', ' ')
    .replace('Z', '')
    .substring(0, 19);
}

/**
 * 获取当前北京时间的 ISO 字符串
 * @returns 当前北京时间的 ISO 格式字符串
 */
export function nowBeijingTime(): string {
  return toBeijingTime(new Date());
}

/**
 * 获取当前北京时间的友好格式
 * @returns 当前北京时间的友好格式字符串
 */
export function nowBeijingTimeFormatted(): string {
  return toBeijingTimeFormatted(new Date());
}

/**
 * 将日期转换为北京时间的日期部分
 * @param date - 日期对象、时间戳或日期字符串
 * @returns 北京时间的日期部分（如：2025-11-28）
 */
export function toBeijingDate(date: Date | string | number): string {
  return toBeijingTimeFormatted(date).substring(0, 10);
}

/**
 * 获取当前北京时间的日期部分
 * @returns 当前北京时间的日期部分
 */
export function todayBeijing(): string {
  return toBeijingDate(new Date());
}

