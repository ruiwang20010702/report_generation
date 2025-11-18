/**
 * 📚 课程知识库类型定义
 * 
 * 用于课程内容查询和AI提示增强
 */

/**
 * 课程上下文信息
 * 包含单元级别的学习内容
 */
export interface CurriculumContext {
  level: string;           // 级别，如 "Level 1"
  unit: number;            // 单元号，如 1
  theme: string;           // 单元主题，如 "Family and Friends 家人和朋友"
  vocabulary: string[];    // 核心词汇列表
  sentences: string[];     // 核心句式列表
  phonics: string[];       // 拼读内容（如有）
  goals: string;           // 单元知识目标
  lessonInfo?: string;     // 课程内容描述，如 "强口语 Lesson 1、3、5、7"
  standard?: string;       // 匹配新课标
}

/**
 * JSON 数据行结构
 * 直接对应Excel转换后的JSON格式
 */
export interface CurriculumDataRow {
  级别?: string;
  "级别\n"?: string;
  单元数量?: string;
  "单元数量\n"?: string;
  Unit?: number;
  "Unit\n"?: number;
  单元主题?: string;
  "单元主题\n"?: string;
  单元知识目标?: string;
  "单元知识目标\n"?: string;
  课程内容?: string;
  "课程内容\n"?: string;
  __EMPTY?: string;
  "__EMPTY\n"?: string;
  匹配新课标?: string;
  "匹配新课标\n"?: string;
  [key: string]: any;  // 允许其他可能的字段
}

/**
 * Level 到文件的映射
 */
export const LEVEL_FILE_MAP: Record<string, string> = {
  'Level 0': 'curriculum-data-L0___.json',
  'Level 1': 'curriculum-data-L1___.json',
  'Level 2': 'curriculum-data-L2___.json',
  'Level 3': 'curriculum-data-L3___.json',
  'Level 4': 'curriculum-data-L4_Eric.json',
  'Level 5': 'curriculum-data-L5_Abby.json',
  'Level 6': 'curriculum-data-L6_ss____.json',
  'Level 7': 'curriculum-data-L7_9_DP.json',
  'Level 8': 'curriculum-data-L7_9_DP.json',
  'Level 9': 'curriculum-data-L7_9_DP.json',
  'Level S': 'curriculum-data-LS_K.json',
  'Level K': 'curriculum-data-LS_K.json',
  '启蒙': 'curriculum-data-______.json',
};

/**
 * 标准化 Level 格式
 * @param level 原始 level 字符串
 * @returns 标准化后的 level 字符串
 */
export function normalizeLevel(level: string): string {
  // 移除多余空格并转为标准格式
  const normalized = level.trim();
  
  // 处理各种可能的输入格式
  if (/^L\s*0$/i.test(normalized)) return 'Level 0';
  if (/^L\s*1$/i.test(normalized)) return 'Level 1';
  if (/^L\s*2$/i.test(normalized)) return 'Level 2';
  if (/^L\s*3$/i.test(normalized)) return 'Level 3';
  if (/^L\s*4$/i.test(normalized)) return 'Level 4';
  if (/^L\s*5$/i.test(normalized)) return 'Level 5';
  if (/^L\s*6$/i.test(normalized)) return 'Level 6';
  if (/^L\s*7$/i.test(normalized)) return 'Level 7';
  if (/^L\s*8$/i.test(normalized)) return 'Level 8';
  if (/^L\s*9$/i.test(normalized)) return 'Level 9';
  if (/^L\s*S$/i.test(normalized)) return 'Level S';
  if (/^L\s*K$/i.test(normalized)) return 'Level K';
  
  // 已经是标准格式，直接返回
  if (normalized.startsWith('Level ')) return normalized;
  
  // 默认返回原始值
  return normalized;
}

