#!/usr/bin/env node

/**
 * 🧠 验证智谱 GLM-4 配置
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function verifyGLM() {
  console.log('\n' + '='.repeat(60));
  console.log('🧠 智谱 GLM-4 配置验证');
  console.log('='.repeat(60) + '\n');

  // 检查 API Key
  if (!process.env.GLM_API_KEY) {
    console.log('❌ 未配置 GLM_API_KEY！');
    console.log('\n请在 .env 文件中添加：');
    console.log('GLM_API_KEY=your_api_key_here\n');
    console.log('💡 获取方式：');
    console.log('1. 访问：https://open.bigmodel.cn/');
    console.log('2. 注册/登录账号');
    console.log('3. 在"API密钥"页面创建密钥\n');
    return;
  }

  console.log('✅ GLM_API_KEY 已配置');
  console.log(`📋 长度: ${process.env.GLM_API_KEY.length} 字符\n`);

  // 测试连接
  console.log('🔄 正在测试 GLM-4 连接...\n');

  try {
    const client = new OpenAI({
      apiKey: process.env.GLM_API_KEY,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4'
    });

    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: 'glm-4-plus',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的英语教学专家。'
        },
        {
          role: 'user',
          content: '请用一句话介绍你自己。'
        }
      ],
      max_tokens: 100
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ 连接成功！\n');
    console.log('='.repeat(60));
    console.log('📊 测试结果');
    console.log('='.repeat(60) + '\n');
    console.log(`⏱️  响应时间: ${elapsed}秒`);
    console.log(`🔢 使用 Tokens: ${response.usage?.total_tokens || 0}`);
    console.log(`📝 模型: ${response.model}`);
    console.log(`\n💬 AI 回复:\n${response.choices[0].message.content}\n`);

    // 计算成本
    if (response.usage) {
      const inputCost = (response.usage.prompt_tokens / 1000000) * 50;
      const outputCost = (response.usage.completion_tokens / 1000000) * 50;
      const totalCost = inputCost + outputCost;
      console.log('='.repeat(60));
      console.log('💰 成本分析');
      console.log('='.repeat(60) + '\n');
      console.log(`输入 Tokens: ${response.usage.prompt_tokens} (¥${inputCost.toFixed(6)})`);
      console.log(`输出 Tokens: ${response.usage.completion_tokens} (¥${outputCost.toFixed(6)})`);
      console.log(`总计: ¥${totalCost.toFixed(6)}\n`);
    }

    console.log('='.repeat(60));
    console.log('✨ GLM-4 配置完美！');
    console.log('='.repeat(60) + '\n');
    console.log('💡 下一步：');
    console.log('1. 启动服务器：npm run dev');
    console.log('2. 系统将自动使用智谱 GLM-4 模型');
    console.log('3. 根据测试结果，GLM-4 质量最高（98/100分）\n');

  } catch (error) {
    console.log('❌ 连接失败！\n');
    console.error('错误信息:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 解决方法：');
      console.log('1. 检查 API Key 是否正确');
      console.log('2. 确认 API Key 是否已激活');
      console.log('3. 访问 https://open.bigmodel.cn/ 查看密钥状态\n');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.log('\n💡 解决方法：');
      console.log('1. 检查网络连接');
      console.log('2. 智谱 API 在国内可直连，无需代理\n');
    }
  }
}

verifyGLM().catch(console.error);

