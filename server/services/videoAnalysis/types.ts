/**
 * 📝 视频分析服务类型定义
 */

import type { TranscriptionResult } from '../whisperService.js';

/**
 * 单视频分析结果
 */
export interface SingleVideoResult {
  transcription: TranscriptionResult;
  analysis: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
}

/**
 * 学生信息
 */
export interface StudentInfo {
  studentName: string;
  studentId?: string;
  grade: string;
  level: string;
  unit: string;
  video1Time?: string;
  video2Time?: string;
}

/**
 * 需要修复的负值百分比指标
 */
export interface MetricToFix {
  key: string;
  label: string;
  originalPercentage: string;
  originalTrend: string;
  originalAnalysis: string;
  newPercentage?: number; // 修复后的百分比值（5-10随机整数）
}

/**
 * 数据不一致信息
 */
export interface DataInconsistency {
  suggestionIndex: number;
  field: 'performanceSummary' | 'description';
  foundValue: string;
  expectedKey: string;
  expectedValue: string;
  context: string;
}

/**
 * 真实数据映射
 */
export interface RealDataItem {
  percentage: string;
  label: string;
}

