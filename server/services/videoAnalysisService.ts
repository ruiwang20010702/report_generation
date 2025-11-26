/**
 * 📹 视频分析服务
 * 
 * ⚠️ 此文件已重构！
 * 
 * 原来 3600+ 行的代码已拆分到 ./videoAnalysis/ 目录下的多个模块：
 * - config.ts: AI配置、定价、报告字数配置 (~80行)
 * - aiClient.ts: AI客户端管理 (~120行)
 * - transcriptionAnalyzer.ts: 转录分析逻辑 (~300行)
 * - reportGenerator.ts: 对比报告生成 (~400行)
 * - dataValidator.ts: 数据验证和修复 (~700行)
 * - mockData.ts: Mock数据 (~200行)
 * - types.ts: 类型定义 (~60行)
 * - index.ts: 主服务类 (~250行)
 * 
 * 此文件现在只是一个重新导出的入口，保持向后兼容。
 */

// 从新的模块化目录导出
export { VideoAnalysisService } from './videoAnalysis/index.js';
export { VideoAnalysisService as default } from './videoAnalysis/index.js';

// 如果其他地方需要直接使用这些工具函数，也可以导出
export { calculateAICost, REPORT_WORD_COUNT, AI_PRICING } from './videoAnalysis/config.js';
export { getModelName, getProviderInfo } from './videoAnalysis/aiClient.js';
