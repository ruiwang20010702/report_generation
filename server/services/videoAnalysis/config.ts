/**
 * 📝 视频分析服务配置
 * 包含报告字数配置、AI提供商配置、定价等
 */

/**
 * 📝 报告字数配置
 * 在这里修改报告各部分的字数要求
 */
export const REPORT_WORD_COUNT = {
  // 学习数据分析
  learningData: {
    handRaising: 50,      // 主动发言次数分析
    answerLength: 50,    // 回答长度分析
    completeSentences: 50, // 完整句子率分析
    readingAccuracy: 50,  // 阅读准确率分析
  },
  // 进步维度
  progressDimensions: {
    fluency: 100,           // 流利度分析
    confidence: 100,        // 自信心分析
    languageApplication: 100, // 语言应用分析
    sentenceComplexity: 100,  // 句子复杂度分析
  },
  // 改进领域
  improvementAreas: {
    overview: 25,          // 概述部分
    details: 150,           // 详细分析部分
    suggestion: 100,        // 建议描述
  },
};

/**
 * 🎯 AI 提供商配置接口
 */
export interface AIProviderConfig {
  name: string;           // 提供商标识：'DeepSeek' | 'GLM' | 'Qwen' | 'OpenAI'
  apiKey: string;         // API 密钥
  baseURL?: string;       // API 基础 URL（可选，OpenAI 使用默认）
  model: string;          // 模型名称
  displayName: string;    // 显示名称
  emoji: string;          // 图标
  features: string[];     // 特性列表
}

/**
 * 💰 AI 模型定价配置（2025年4月更新）
 * 单位：元/1K tokens
 * 注意：智谱GLM-4-Plus在2025年4月24日大幅降价，从¥50/1M降至¥5/1M tokens
 */
export const AI_PRICING: Record<string, { input: number; output: number }> = {
  'glm-4-plus': { input: 0.005, output: 0.005 },   // 智谱GLM-4-Plus: ¥5/1M tokens (2025年4月降价后)
  'glm-4': { input: 0.1, output: 0.1 },             // 智谱GLM-4: ¥100/1M tokens
  'deepseek-chat': { input: 0.001, output: 0.002 }, // DeepSeek: ¥1/1M input, ¥2/1M output
  'qwen-plus': { input: 0.004, output: 0.012 },     // 通义千问Plus: ¥4/1M input, ¥12/1M output
  'gpt-4o': { input: 2.5, output: 10 },             // GPT-4o: $2.5/1M input, $10/1M output (按¥1=$1计算)
};

/**
 * 💰 计算 AI 调用成本
 */
export function calculateAICost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = AI_PRICING[model] || { input: 0.005, output: 0.005 }; // 默认使用GLM-4-Plus定价（2025年4月降价后）
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * 📊 后处理 AI 调用的使用量统计
 */
export interface PostProcessingUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  callCount: number;  // 实际调用次数
}

/**
 * 创建空的使用量统计对象
 */
export function createEmptyUsage(): PostProcessingUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, callCount: 0 };
}

