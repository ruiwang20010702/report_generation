/**
 * Jest 测试环境设置
 */

import { beforeAll, afterAll } from '@jest/globals';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_ANALYSIS = 'true'; // 在测试中使用模拟分析

// 全局设置
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');
  console.log(`📍 API Base URL: ${process.env.API_BASE_URL || 'http://localhost:3001'}`);
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  // 在这里添加清理逻辑（如关闭数据库连接等）
  await new Promise(resolve => setTimeout(resolve, 500)); // 等待清理完成
});

// 设置全局超时
jest.setTimeout(30000);

