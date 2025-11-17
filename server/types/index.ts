export interface VideoAnalysisRequest {
  video1: string;
  video2: string;
  video1Time?: string; // 第一个视频的上课时间
  video2Time?: string; // 第二个视频的上课时间
  studentName: string;
  studentId: string; // 学生ID（必选）
  grade: string;
  level: string;
  unit: string;
  apiKey?: string;
  useMockData?: boolean;
  language?: string;
  speakerCount?: number; // 说话人数量（可选，默认3）
  userId?: string; // 用户ID（用于记录报告）
}

export interface LearningDataMetric {
  trend: "提升" | "下降" | "持平";
  percentage: string;
  analysis: string;
}

export interface ProgressDimension {
  analysis: string;
  example: string;
}

export interface PronunciationExample {
  word: string;
  incorrect: string;
  correct: string;
  type: string;
}

export interface GrammarExample {
  category: string;
  incorrect: string;
  correct: string;
  explanation: string;
}

export interface IntonationExample {
  sentence: string;
  issue: string;
  improvement: string;
}

export interface Suggestion {
  title: string;
  description: string;
}

export interface CostBreakdown {
  transcription: {
    service: string;           // 使用的转录服务（如 "tingwu"）
    video1Duration: number;    // 视频1时长（秒）
    video2Duration: number;    // 视频2时长（秒）
    totalMinutes: number;      // 总转录时长（分钟，向上取整）
    unitPrice: number;         // 单价（元/分钟）
    cost: number;              // 转录成本（元）
    currency: string;          // 货币单位
  };
  aiAnalysis: {
    provider: string;          // AI提供商（如 "GLM"）
    model: string;             // 使用的模型（如 "glm-4-plus"）
    video1Analysis: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
    };
    video2Analysis: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
    };
    comparison: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
    };
    totalTokens: number;       // 总token数
    totalCost: number;         // AI分析总成本（元）
    currency: string;          // 货币单位
  };
  total: {
    cost: number;              // 总成本（元）
    currency: string;          // 货币单位
    breakdown: string;         // 成本明细文本
  };
  timestamp: string;           // 成本计算时间
}

export interface VideoAnalysisResponse {
  studentName: string;
  studentId: string;
  grade: string;
  level: string;
  unit: string;
  learningData: {
    handRaising: LearningDataMetric;
    answerLength: LearningDataMetric;
    completeSentences: LearningDataMetric;
    readingAccuracy: LearningDataMetric;
  };
  progressDimensions: {
    fluency: ProgressDimension;
    confidence: ProgressDimension;
    languageApplication: ProgressDimension;
    sentenceComplexity: ProgressDimension;
  };
  improvementAreas: {
    pronunciation?: {
      overview: string;
      details: string;
      examples: PronunciationExample[];
      persistentIssues?: {
        title: string;
        items: string[];
      };
      suggestions: Suggestion[];
    };
    grammar?: {
      overview: string;
      details: string;
      examples: GrammarExample[];
      suggestions: Suggestion[];
    };
    intonation?: {
      overview: string;
      details: string;
      suggestions: Suggestion[];
    };
  };
  costBreakdown?: CostBreakdown;  // 成本详情（可选）
}

