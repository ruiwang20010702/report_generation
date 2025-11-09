#!/usr/bin/env node

/**
 * 🧪 通义千问配置测试脚本
 * 
 * 用途：验证通义千问 API 配置是否正确
 */

import dotenv from 'dotenv';
import OpenAI from 'openai';

// 加载环境变量
dotenv.config({ override: true, debug: true });

console.log('🧪 测试通义千问配置\n');
console.log('============================================================\n');

// 检查环境变量
console.log('📋 环境变量检查:\n');

const qwenApiKey = process.env.QWEN_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const useQwen = process.env.USE_QWEN === 'true';

if (qwenApiKey) {
  console.log(`✅ QWEN_API_KEY: ${qwenApiKey.substring(0, 10)}...`);
} else {
  console.log('❌ QWEN_API_KEY: 未配置');
}

if (openaiApiKey) {
  console.log(`✅ OPENAI_API_KEY: ${openaiApiKey.substring(0, 10)}...`);
} else {
  console.log('⚠️  OPENAI_API_KEY: 未配置（保留作为备用）');
}

console.log(`📌 USE_QWEN: ${useQwen ? '✅ 已启用' : '❌ 未启用'}`);

console.log('\n============================================================\n');

// 测试通义千问连接
if (qwenApiKey) {
  console.log('🔄 测试通义千问 API 连接...\n');
  
  try {
    const client = new OpenAI({
      apiKey: qwenApiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    });
    
    const startTime = Date.now();
    
    const response = await client.chat.completions.create({
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的英语教学专家。'
        },
        {
          role: 'user',
          content: '请用一句话介绍自己。'
        }
      ],
      max_tokens: 100
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('✅ 通义千问 API 连接成功！\n');
    console.log(`⏱️  响应时间: ${elapsed} 秒`);
    console.log(`📝 模型: ${response.model}`);
    console.log(`💬 回复内容: ${response.choices[0].message.content}\n`);
    
    // 显示使用统计
    if (response.usage) {
      console.log('📊 Token 使用情况:');
      console.log(`   - 输入: ${response.usage.prompt_tokens} tokens`);
      console.log(`   - 输出: ${response.usage.completion_tokens} tokens`);
      console.log(`   - 总计: ${response.usage.total_tokens} tokens\n`);
    }
    
  } catch (error) {
    console.error('❌ 通义千问 API 连接失败:\n');
    console.error('错误信息:', error.message);
    
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    
    console.log('\n💡 可能的原因:');
    console.log('   1. API Key 错误或过期');
    console.log('   2. 未开通通义千问服务');
    console.log('   3. 网络连接问题');
    console.log('\n请访问: https://dashscope.console.aliyun.com/');
  }
} else {
  console.log('⚠️  跳过通义千问测试（未配置 API Key）\n');
}

console.log('============================================================\n');

// 服务优先级说明
console.log('🔄 智能降级策略:\n');

if (qwenApiKey && useQwen) {
  console.log('✨ 当前配置：优先使用通义千问');
  console.log('   1️⃣  通义千问（国内免费）');
  if (openaiApiKey) {
    console.log('   2️⃣  OpenAI（国际备用）');
  }
} else if (openaiApiKey) {
  console.log('✨ 当前配置：使用 OpenAI');
  console.log('   - 通义千问未配置或未启用');
} else {
  console.log('❌ 当前配置：无可用服务');
  console.log('   - 请至少配置一个 LLM 服务');
}

console.log('\n============================================================\n');

// 配置建议
console.log('💡 配置建议:\n');

if (!qwenApiKey) {
  console.log('🔧 推荐配置通义千问（国内用户）:');
  console.log('   1. 访问: https://dashscope.console.aliyun.com/');
  console.log('   2. 开通服务（免费）');
  console.log('   3. 创建 API Key');
  console.log('   4. 添加到 .env 文件:');
  console.log('      QWEN_API_KEY=your_api_key_here');
  console.log('      USE_QWEN=true\n');
}

if (qwenApiKey && !useQwen) {
  console.log('⚠️  通义千问已配置但未启用:');
  console.log('   - 在 .env 文件中设置: USE_QWEN=true\n');
}

if (!openaiApiKey) {
  console.log('💡 建议配置 OpenAI 作为备用:');
  console.log('   - 在 .env 文件中添加: OPENAI_API_KEY=your_key\n');
}

console.log('============================================================\n');

console.log('✅ 测试完成！\n');

