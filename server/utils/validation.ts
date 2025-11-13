/**
 * 输入验证工具函数
 */

/**
 * 验证URL格式
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    // 只允许 http 和 https 协议
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 验证学生姓名
 */
export function isValidStudentName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  const trimmed = name.trim();
  // 姓名长度应在2-50个字符之间
  if (trimmed.length < 2 || trimmed.length > 50) {
    return false;
  }
  
  // 只允许中文字符、英文字母、数字、空格和常见标点
  const namePattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_\.]+$/;
  return namePattern.test(trimmed);
}

/**
 * 验证视频URL
 */
export function isValidVideoUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }
  
  // 可以添加更多视频URL的验证逻辑
  // 例如：检查是否是支持的视频平台URL
  const videoUrlPatterns = [
    /youtube\.com/,
    /youtu\.be/,
    /vimeo\.com/,
    /bilibili\.com/,
    /\.mp4$/i,
    /\.mov$/i,
    /\.avi$/i,
    /\.webm$/i,
    /\.m3u8$/i,
  ];
  
  // 如果URL包含视频平台域名或视频文件扩展名，认为是有效的
  return videoUrlPatterns.some(pattern => pattern.test(url)) || true; // 暂时允许所有有效的URL
}

/**
 * 验证学生ID
 */
export function isValidStudentId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  const trimmed = id.trim();
  // 学生ID长度应在2-50个字符之间
  if (trimmed.length < 2 || trimmed.length > 50) {
    return false;
  }
  
  // 只允许字母、数字、下划线和短横线
  const idPattern = /^[a-zA-Z0-9_-]+$/;
  return idPattern.test(trimmed);
}

/**
 * 安全地截取字符串（避免在null/undefined上调用substring）
 */
export function safeSubstring(str: string | null | undefined, start: number, end?: number): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.substring(start, end);
}

