/**
 * 🤖 AI 客户端管理模块
 * 负责 AI 客户端的创建、配置和管理
 */

import OpenAI from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AppError, ErrorType } from '../../utils/errors.js';
import type { AIProviderConfig } from './config.js';

/**
 * 🔍 强制使用 GLM 模型（固定配置）
 * 不再支持降级到其他模型，确保输出一致性
 */
export function detectAIProvider(): AIProviderConfig | null {
  // 🧠 强制使用智谱 GLM - 质量最高的国内模型（测试得分 98/100）
  if (process.env.GLM_API_KEY) {
    return {
      name: 'GLM',
      apiKey: process.env.GLM_API_KEY,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4-plus',
      displayName: '智谱 GLM-4-Plus',
      emoji: '🧠',
      features: ['国内直连', '质量最高', '128K上下文']
    };
  }

  // ❌ GLM 不可用时抛出错误，不再降级
  throw new AppError(
    ErrorType.API_KEY_ERROR,
    'GLM API Key 未配置',
    {
      userMessage: 'GLM API Key 未配置，请设置环境变量 GLM_API_KEY 以使用智谱 GLM 模型。系统已配置为强制使用 GLM 模型。',
      context: {
        hint: '请设置环境变量 GLM_API_KEY 以使用智谱 GLM 模型',
      },
    }
  );
}

/**
 * 🏗️ 创建 AI 客户端实例
 */
export function createAIClient(config: AIProviderConfig): OpenAI {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${config.emoji} 使用 AI 服务: ${config.displayName}`);
  console.log(`📋 模型: ${config.model}`);
  console.log(`✨ 特性: ${config.features.join(' | ')}`);
  console.log(`${'='.repeat(60)}\n`);

  const clientConfig: any = {
    apiKey: config.apiKey,
  };

  if (config.baseURL) {
    clientConfig.baseURL = config.baseURL;
  }

  // 为 OpenAI 添加代理支持
  if (config.name === 'OpenAI') {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) {
      console.log('🌐 Using proxy:', proxyUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
      clientConfig.httpAgent = new HttpsProxyAgent(proxyUrl);
    }
  }

  return new OpenAI(clientConfig);
}

/**
 * 创建 AI 客户端（支持动态 API Key 和代理）
 * 注意：系统使用智谱 GLM 模型，用户提供的 API Key 也应该是 GLM 的
 */
export function getOpenAIClient(apiKey: string | undefined, defaultOpenai: OpenAI | null): OpenAI | null {
  if (apiKey) {
    console.log('🔑 Using user-provided GLM API Key');
    
    // 配置 GLM 客户端（智谱AI）
    const config: any = {
      apiKey,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4', // GLM API 地址
    };
    
    // 从环境变量读取代理设置
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) {
      console.log('🌐 Using proxy:', proxyUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // 隐藏密码
      config.httpAgent = new HttpsProxyAgent(proxyUrl);
    }
    
    return new OpenAI(config);
  }
  return defaultOpenai;
}

/**
 * 🎯 根据客户端自动选择合适的模型
 */
export function getModelName(openai: OpenAI): string {
  const baseURL = (openai as any).baseURL;
  
  // DeepSeek
  if (baseURL?.includes('deepseek.com')) {
    return 'deepseek-chat';
  }
  
  // 智谱 GLM
  if (baseURL?.includes('bigmodel.cn')) {
    return 'glm-4-plus';
  }
  
  // 通义千问
  if (baseURL?.includes('dashscope.aliyuncs.com')) {
    return 'qwen-plus';
  }
  
  // OpenAI（默认）
  return 'gpt-4o';
}

/**
 * 📊 获取当前使用的 AI 提供商信息
 */
export function getProviderInfo(openai: OpenAI): string {
  const baseURL = (openai as any).baseURL;
  
  if (baseURL?.includes('deepseek.com')) return '🔷 DeepSeek';
  if (baseURL?.includes('bigmodel.cn')) return '🧠 智谱GLM-4';
  if (baseURL?.includes('dashscope.aliyuncs.com')) return '🇨🇳 通义千问';
  return '🤖 OpenAI GPT-4';
}

