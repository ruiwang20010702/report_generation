/**
 * 🎯 测试所有国内 AI 模型
 * 
 * 支持的模型：
 * - DeepSeek: 性价比最高
 * - GLM-4: 清华技术，老牌国产
 * - Qwen: 阿里云，免费额度大
 * - OpenAI: 国际标准（需代理）
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// 模型配置
const models = [
  {
    name: 'DeepSeek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    emoji: '🔷',
    pricing: {
      input: 1,    // ¥1 / 1M tokens
      output: 2    // ¥2 / 1M tokens
    },
    features: ['超高性价比', '强推理能力', '500万免费额度']
  },
  {
    name: 'GLM-4',
    apiKey: process.env.GLM_API_KEY,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
    emoji: '🧠',
    pricing: {
      input: 50,   // ¥50 / 1M tokens
      output: 50   // ¥50 / 1M tokens
    },
    features: ['清华背景', '高准确率', '25元体验金']
  },
  {
    name: 'Qwen',
    apiKey: process.env.QWEN_API_KEY,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    emoji: '🇨🇳',
    pricing: {
      input: 4,    // ¥4 / 1M tokens
      output: 12   // ¥12 / 1M tokens
    },
    features: ['阿里云服务', '100万免费额度', '响应快速']
  },
  {
    name: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: undefined,
    model: 'gpt-4o',
    emoji: '🤖',
    pricing: {
      input: 30 * 7.3,   // $30 / 1M tokens → ¥219
      output: 30 * 7.3   // 简化计算
    },
    features: ['国际领先', '需要代理', '成本较高']
  }
];

async function testModel(config) {
  if (!config.apiKey) {
    console.log(`${config.emoji} ${config.name}: ⏭️  未配置（跳过）\n`);
    return null;
  }

  try {
    const startTime = Date.now();
    
    const client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL })
    });

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的英语教学专家。'
        },
        {
          role: 'user',
          content: '请用一句话介绍你的英语教学能力。'
        }
      ],
      max_tokens: 100
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // 计算成本
    let cost = 0;
    if (response.usage) {
      const inputCost = (response.usage.prompt_tokens / 1000000) * config.pricing.input;
      const outputCost = (response.usage.completion_tokens / 1000000) * config.pricing.output;
      cost = inputCost + outputCost;
    }

    return {
      name: config.name,
      emoji: config.emoji,
      success: true,
      elapsed: parseFloat(elapsed),
      tokens: response.usage?.total_tokens || 0,
      cost: cost,
      response: response.choices[0].message.content.substring(0, 60) + '...',
      features: config.features
    };

  } catch (error) {
    return {
      name: config.name,
      emoji: config.emoji,
      success: false,
      error: error.message,
      features: config.features
    };
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 国内 AI 模型对比测试');
  console.log('='.repeat(80) + '\n');

  console.log('📋 测试任务：分析学生英语学习表现（典型使用场景）');
  console.log('📊 测试指标：响应速度、成本、可用性\n');

  // 并行测试所有模型
  console.log('🔄 正在测试所有模型...\n');
  const results = await Promise.all(models.map(testModel));

  // 过滤出成功的结果
  const successResults = results.filter(r => r && r.success);
  
  if (successResults.length === 0) {
    console.log('❌ 没有可用的模型！请至少配置一个 API Key。\n');
    console.log('💡 配置方式：在 .env 文件中添加以下任意一项：');
    console.log('   DEEPSEEK_API_KEY=sk-...');
    console.log('   GLM_API_KEY=...');
    console.log('   QWEN_API_KEY=sk-...');
    console.log('   OPENAI_API_KEY=sk-...\n');
    return;
  }

  // 显示结果
  console.log('✅ 测试完成！\n');
  console.log('=' .repeat(80));
  console.log('📊 性能对比表');
  console.log('='.repeat(80) + '\n');

  // 表头
  console.log('模型        | 状态 | 响应时间 | Tokens | 成本(¥)   | 回复预览');
  console.log('-'.repeat(80));

  results.forEach(result => {
    if (!result) return;
    
    if (result.success) {
      const name = (result.emoji + ' ' + result.name).padEnd(12);
      const status = '✅';
      const time = result.elapsed.toFixed(2) + 's';
      const tokens = result.tokens.toString().padStart(6);
      const cost = result.cost.toFixed(6).padStart(9);
      console.log(`${name}| ${status} | ${time.padStart(8)} | ${tokens} | ${cost} | ${result.response}`);
    } else {
      const name = (result.emoji + ' ' + result.name).padEnd(12);
      console.log(`${name}| ❌ | 未配置或失败`);
    }
  });

  // 推荐方案
  console.log('\n' + '='.repeat(80));
  console.log('💡 推荐方案（按性价比排序）');
  console.log('='.repeat(80) + '\n');

  const recommendations = [
    {
      rank: '🥇',
      name: 'DeepSeek',
      reason: '超高性价比，比 GPT-4 便宜 95%，新用户送 500万 tokens',
      cost: '~¥0.06/百次分析'
    },
    {
      rank: '🥈', 
      name: '通义千问 (Qwen)',
      reason: '阿里云服务，100万 tokens/月免费，足够个人使用',
      cost: '前 100万 tokens 免费'
    },
    {
      rank: '🥉',
      name: '智谱 GLM-4',
      reason: '清华背景，高准确率，送 25元体验金，GLM-4-Flash 免费',
      cost: '~¥0.30/百次分析'
    }
  ];

  recommendations.forEach(rec => {
    console.log(`${rec.rank} ${rec.name}`);
    console.log(`   理由: ${rec.reason}`);
    console.log(`   成本: ${rec.cost}\n`);
  });

  // 最快响应
  if (successResults.length > 0) {
    const fastest = successResults.reduce((a, b) => a.elapsed < b.elapsed ? a : b);
    console.log(`⚡ 最快响应: ${fastest.emoji} ${fastest.name} (${fastest.elapsed}s)`);
    
    const cheapest = successResults.reduce((a, b) => a.cost < b.cost ? a : b);
    console.log(`💰 最低成本: ${cheapest.emoji} ${cheapest.name} (¥${cheapest.cost.toFixed(6)})`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 配置建议');
  console.log('='.repeat(80) + '\n');

  console.log('轻度使用（每月 < 100 次分析）：');
  console.log('  → 通义千问（免费额度内）\n');

  console.log('中度使用（每月 100-1000 次分析）：');
  console.log('  → DeepSeek（性价比最高）\n');

  console.log('重度使用（需要最高质量）：');
  console.log('  → 主用 DeepSeek，关键场景用 GPT-4\n');

  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);

