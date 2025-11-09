/**
 * 🧠 智谱 GLM-4 API 测试脚本
 * 
 * GLM-4 特点：
 * - 国内老牌大模型，清华技术背景
 * - 国内直连，响应快速
 * - 高准确率，擅长中英文理解
 * - 支持多模态能力
 * 
 * 官网：https://open.bigmodel.cn/
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function testGLM() {
  console.log('\n' + '='.repeat(70));
  console.log('🧠 智谱 GLM-4 API 连接测试');
  console.log('='.repeat(70) + '\n');

  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    console.log('❌ 未配置 GLM_API_KEY');
    console.log('\n📝 配置步骤：');
    console.log('   1. 访问 https://open.bigmodel.cn/');
    console.log('   2. 注册/登录账号（支持手机/邮箱）');
    console.log('   3. 创建 API Key');
    console.log('   4. 在 .env 文件中添加：');
    console.log('      GLM_API_KEY=你的API密钥');
    console.log('\n💰 定价：');
    console.log('   GLM-4-Plus:');
    console.log('   - 输入：¥50 / 1M tokens');
    console.log('   - 输出：¥50 / 1M tokens');
    console.log('   GLM-4-Flash (经济版):');
    console.log('   - 完全免费（限速）');
    console.log('   - 新用户送 25 元体验金');
    return;
  }

  console.log('✅ API Key 已配置');
  console.log(`   Key: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}\n`);

  try {
    const startTime = Date.now();
    
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4'
    });

    console.log('🔌 正在连接智谱 GLM API...');
    
    const response = await client.chat.completions.create({
      model: 'glm-4-plus',  // 或使用 'glm-4-flash' (免费)
      messages: [
        {
          role: 'system',
          content: '你是一位专业的英语教学专家。'
        },
        {
          role: 'user',
          content: '请简短介绍一下你的能力，50字以内。'
        }
      ],
      max_tokens: 200
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ 智谱 GLM API 连接成功！\n');
    console.log('📊 测试结果：');
    console.log(`   ⏱️  响应时间: ${elapsed} 秒`);
    console.log(`   📝 模型: ${response.model}`);
    console.log(`   🎯 完成原因: ${response.choices[0].finish_reason}`);
    console.log(`   💬 回复内容: ${response.choices[0].message.content}\n`);

    if (response.usage) {
      console.log('💰 Token 使用：');
      console.log(`   输入: ${response.usage.prompt_tokens} tokens`);
      console.log(`   输出: ${response.usage.completion_tokens} tokens`);
      console.log(`   总计: ${response.usage.total_tokens} tokens`);
      
      // 计算成本（CNY，GLM-4-Plus 定价）
      const inputCost = (response.usage.prompt_tokens / 1000000) * 50;
      const outputCost = (response.usage.completion_tokens / 1000000) * 50;
      const totalCost = inputCost + outputCost;
      console.log(`   💵 成本 (GLM-4-Plus): ¥${totalCost.toFixed(6)}\n`);
    }

    console.log('✨ 特性：');
    console.log('   ✅ 国内直连（无需 VPN）');
    console.log('   ✅ 清华技术背景，国内老牌');
    console.log('   ✅ 高准确率，中英文理解强');
    console.log('   ✅ 支持 128K 上下文');
    console.log('   ✅ 新用户送 25 元体验金');
    console.log('   ✅ GLM-4-Flash 免费版可用\n');

    console.log('💡 模型选择：');
    console.log('   - glm-4-plus: 最强性能（付费）');
    console.log('   - glm-4-flash: 经济实惠（免费，有限速）');
    console.log('   - 修改代码中的 model 参数即可切换\n');

    console.log('='.repeat(70));
    console.log('🎉 测试完成！智谱 GLM 可以正常使用');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.log('\n❌ 智谱 GLM API 调用失败\n');
    
    if (error.response) {
      console.log('📋 错误详情：');
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误信息: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log('📋 错误信息：', error.message);
    }

    console.log('\n🔧 排查建议：');
    console.log('   1. 检查 API Key 是否正确');
    console.log('   2. 确认账户是否有余额/体验金');
    console.log('   3. 尝试使用免费的 glm-4-flash 模型');
    console.log('   4. 检查网络连接是否正常');
    console.log('   5. 查看智谱控制台是否有错误提示');
  }
}

testGLM();

