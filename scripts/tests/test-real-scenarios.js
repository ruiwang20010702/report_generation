#!/usr/bin/env node

/**
 * 🎯 真实场景测试：英语教学应用实战对比
 * 
 * 测试场景：
 * 1. 语法纠错
 * 2. 发音分析
 * 3. 作文批改
 * 4. 学习建议
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
    emoji: '🔷'
  },
  {
    name: 'GLM-4',
    apiKey: process.env.GLM_API_KEY,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
    emoji: '🧠'
  },
  {
    name: 'Qwen',
    apiKey: process.env.QWEN_API_KEY,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    emoji: '🇨🇳'
  },
  {
    name: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: undefined,
    model: 'gpt-4o',
    emoji: '🤖'
  }
];

// 测试场景
const scenarios = [
  {
    name: '📝 语法纠错',
    difficulty: '简单',
    systemPrompt: '你是一位专业的英语语法老师。请分析学生的句子，指出语法错误并给出正确的表达。',
    userPrompt: `请分析这个句子的语法问题：
"He don't like apples and he go to school yesterday."

请指出：
1. 所有语法错误
2. 正确的表达
3. 简短的解释（每个错误不超过20字）`,
    expectedKeywords: ['doesn\'t', 'went', '时态', '主谓一致'],
    maxTokens: 200
  },
  {
    name: '🗣️ 发音分析',
    difficulty: '中等',
    systemPrompt: '你是一位英语发音教学专家。',
    userPrompt: `学生读了这个单词："schedule"
学生的发音记录：/ˈskedʒuːl/ (错误，应该是美式 /ˈskedʒuːl/ 或英式 /ˈʃedjuːl/)

请分析：
1. 发音是否正确？
2. 如果错误，正确发音应该是什么？
3. 给出一个简单的发音技巧提示`,
    expectedKeywords: ['发音', '美式', '英式', 'schedule'],
    maxTokens: 250
  },
  {
    name: '✍️ 作文批改',
    difficulty: '复杂',
    systemPrompt: '你是一位经验丰富的英语写作老师。',
    userPrompt: `请批改这篇小作文（80词）：

"Last week, I go to the park with my friend. The weather is very good. We play basketball and take many photo. I am very happy. We also eat ice cream. It was delicious. I want to go there again in next week."

请提供：
1. 找出 3-5 个主要错误
2. 给出修改建议
3. 整体评分（满分10分）
4. 一句鼓励的话`,
    expectedKeywords: ['went', 'was', 'photos', '时态', '评分'],
    maxTokens: 400
  },
  {
    name: '📊 学习计划',
    difficulty: '复杂',
    systemPrompt: '你是一位英语学习规划专家。',
    userPrompt: `学生情况：
- 年级：高一
- 当前水平：词汇量 2000，语法基础较弱
- 目标：3个月后参加英语竞赛
- 每天学习时间：1小时

请制定：
1. 分阶段学习计划（3个阶段）
2. 每个阶段的重点（不超过30字）
3. 推荐的学习资源（各2个）`,
    expectedKeywords: ['阶段', '词汇', '语法', '练习', '资源'],
    maxTokens: 500
  }
];

// 测试单个模型单个场景
async function testModelScenario(modelConfig, scenario) {
  if (!modelConfig.apiKey) {
    return {
      skipped: true,
      reason: '未配置 API Key'
    };
  }

  try {
    const startTime = Date.now();
    
    const client = new OpenAI({
      apiKey: modelConfig.apiKey,
      ...(modelConfig.baseURL && { baseURL: modelConfig.baseURL })
    });

    const response = await client.chat.completions.create({
      model: modelConfig.model,
      messages: [
        {
          role: 'system',
          content: scenario.systemPrompt
        },
        {
          role: 'user',
          content: scenario.userPrompt
        }
      ],
      max_tokens: scenario.maxTokens,
      temperature: 0.7
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const content = response.choices[0].message.content;

    // 检查关键词覆盖率
    const foundKeywords = scenario.expectedKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );
    const keywordCoverage = (foundKeywords.length / scenario.expectedKeywords.length * 100).toFixed(0);

    // 评估回答质量
    const quality = evaluateQuality(content, scenario);

    return {
      success: true,
      elapsed: parseFloat(elapsed),
      content: content,
      tokens: response.usage?.total_tokens || 0,
      keywordCoverage: parseInt(keywordCoverage),
      foundKeywords: foundKeywords,
      quality: quality,
      cost: calculateCost(response.usage, modelConfig.name)
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 评估回答质量
function evaluateQuality(content, scenario) {
  let score = 0;
  
  // 长度合理性（40分）
  const words = content.split(/\s+/).length;
  if (words >= 30 && words <= 300) {
    score += 40;
  } else if (words >= 20) {
    score += 20;
  }

  // 结构性（30分）- 检查是否有列表或分点
  if (content.match(/[1-4][\.\)、]/g) || content.match(/[-•]/g)) {
    score += 30;
  } else if (content.includes('\n')) {
    score += 15;
  }

  // 关键词覆盖（30分）
  const foundKeywords = scenario.expectedKeywords.filter(keyword => 
    content.toLowerCase().includes(keyword.toLowerCase())
  );
  score += (foundKeywords.length / scenario.expectedKeywords.length) * 30;

  return Math.round(score);
}

// 计算成本
function calculateCost(usage, modelName) {
  if (!usage) return 0;

  const pricing = {
    'DeepSeek': { input: 1, output: 2 },
    'GLM-4': { input: 50, output: 50 },
    'Qwen': { input: 4, output: 12 },
    'OpenAI': { input: 219, output: 219 }
  };

  const price = pricing[modelName] || { input: 0, output: 0 };
  const inputCost = (usage.prompt_tokens / 1000000) * price.input;
  const outputCost = (usage.completion_tokens / 1000000) * price.output;
  
  return inputCost + outputCost;
}

// 主测试函数
async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('🎯 英语教学真实场景测试');
  console.log('='.repeat(100) + '\n');

  console.log('📋 测试说明：');
  console.log('   - 模拟 4 种真实教学场景');
  console.log('   - 对比模型的响应速度、准确性、成本');
  console.log('   - 评分标准：内容质量、关键词覆盖、结构清晰度\n');

  const allResults = {};

  // 逐个场景测试
  for (const scenario of scenarios) {
    console.log('='.repeat(100));
    console.log(`${scenario.name} (难度: ${scenario.difficulty})`);
    console.log('='.repeat(100) + '\n');

    console.log('📝 测试任务：');
    console.log(scenario.userPrompt.split('\n').slice(0, 3).join('\n') + '...\n');

    console.log('🔄 正在测试所有模型...\n');

    // 并行测试所有模型
    const scenarioResults = await Promise.all(
      models.map(async (model) => {
        const result = await testModelScenario(model, scenario);
        return {
          model: model.name,
          emoji: model.emoji,
          ...result
        };
      })
    );

    allResults[scenario.name] = scenarioResults;

    // 显示结果表格
    console.log('📊 测试结果：\n');
    console.log('模型        | 状态 | 响应时间 | 质量分 | 关键词覆盖 | 成本(¥)    | Tokens');
    console.log('-'.repeat(100));

    scenarioResults.forEach(result => {
      if (result.skipped) {
        const name = (result.emoji + ' ' + result.model).padEnd(12);
        console.log(`${name}| ⏭️  | 未配置`);
      } else if (result.success) {
        const name = (result.emoji + ' ' + result.model).padEnd(12);
        const time = `${result.elapsed}s`.padStart(8);
        const quality = `${result.quality}/100`.padStart(6);
        const coverage = `${result.keywordCoverage}%`.padStart(10);
        const cost = result.cost.toFixed(6).padStart(10);
        const tokens = result.tokens.toString().padStart(6);
        console.log(`${name}| ✅ | ${time} | ${quality} | ${coverage} | ${cost} | ${tokens}`);
      } else {
        const name = (result.emoji + ' ' + result.model).padEnd(12);
        console.log(`${name}| ❌ | 失败: ${result.error}`);
      }
    });

    // 显示最佳回答预览
    const successResults = scenarioResults.filter(r => r.success);
    if (successResults.length > 0) {
      const bestQuality = successResults.reduce((a, b) => a.quality > b.quality ? a : b);
      console.log(`\n🏆 最高质量分: ${bestQuality.emoji} ${bestQuality.model} (${bestQuality.quality}/100)`);
      console.log('\n💬 回答预览：');
      console.log('-'.repeat(100));
      console.log(bestQuality.content.substring(0, 200) + '...');
      console.log('-'.repeat(100));
    }

    console.log('\n');
  }

  // 综合对比
  console.log('\n' + '='.repeat(100));
  console.log('📊 综合性能对比');
  console.log('='.repeat(100) + '\n');

  // 计算每个模型的平均表现
  const modelStats = {};
  
  models.forEach(model => {
    const modelResults = Object.values(allResults)
      .map(scenarioResults => scenarioResults.find(r => r.model === model.name))
      .filter(r => r && r.success);

    if (modelResults.length === 0) {
      modelStats[model.name] = null;
      return;
    }

    const avgElapsed = modelResults.reduce((sum, r) => sum + r.elapsed, 0) / modelResults.length;
    const avgQuality = modelResults.reduce((sum, r) => sum + r.quality, 0) / modelResults.length;
    const avgCoverage = modelResults.reduce((sum, r) => sum + r.keywordCoverage, 0) / modelResults.length;
    const totalCost = modelResults.reduce((sum, r) => sum + r.cost, 0);
    const totalTokens = modelResults.reduce((sum, r) => sum + r.tokens, 0);

    modelStats[model.name] = {
      emoji: model.emoji,
      avgElapsed: avgElapsed.toFixed(2),
      avgQuality: Math.round(avgQuality),
      avgCoverage: Math.round(avgCoverage),
      totalCost: totalCost,
      totalTokens: totalTokens,
      testsCompleted: modelResults.length
    };
  });

  // 显示综合表格
  console.log('模型        | 完成测试 | 平均响应 | 平均质量 | 关键词覆盖 | 总成本(¥)  | 总Tokens');
  console.log('-'.repeat(100));

  Object.entries(modelStats).forEach(([name, stats]) => {
    if (!stats) {
      const modelConfig = models.find(m => m.name === name);
      const displayName = (modelConfig.emoji + ' ' + name).padEnd(12);
      console.log(`${displayName}| 未配置`);
    } else {
      const displayName = (stats.emoji + ' ' + name).padEnd(12);
      const tests = `${stats.testsCompleted}/${scenarios.length}`.padStart(8);
      const time = `${stats.avgElapsed}s`.padStart(8);
      const quality = `${stats.avgQuality}/100`.padStart(8);
      const coverage = `${stats.avgCoverage}%`.padStart(10);
      const cost = stats.totalCost.toFixed(6).padStart(10);
      const tokens = stats.totalTokens.toString().padStart(8);
      console.log(`${displayName}| ${tests} | ${time} | ${quality} | ${coverage} | ${cost} | ${tokens}`);
    }
  });

  // 推荐建议
  const availableStats = Object.entries(modelStats).filter(([_, stats]) => stats !== null);
  
  if (availableStats.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('🏆 各项最佳表现');
    console.log('='.repeat(100) + '\n');

    const fastest = availableStats.reduce((a, b) => 
      parseFloat(a[1].avgElapsed) < parseFloat(b[1].avgElapsed) ? a : b
    );
    console.log(`⚡ 最快响应:   ${fastest[1].emoji} ${fastest[0]} (平均 ${fastest[1].avgElapsed}s)`);

    const bestQuality = availableStats.reduce((a, b) => 
      a[1].avgQuality > b[1].avgQuality ? a : b
    );
    console.log(`🎯 最高质量:   ${bestQuality[1].emoji} ${bestQuality[0]} (平均 ${bestQuality[1].avgQuality}/100)`);

    const cheapest = availableStats.reduce((a, b) => 
      a[1].totalCost < b[1].totalCost ? a : b
    );
    console.log(`💰 最低成本:   ${cheapest[1].emoji} ${cheapest[0]} (总计 ¥${cheapest[1].totalCost.toFixed(6)})`);

    const bestCoverage = availableStats.reduce((a, b) => 
      a[1].avgCoverage > b[1].avgCoverage ? a : b
    );
    console.log(`✅ 最高覆盖率: ${bestCoverage[1].emoji} ${bestCoverage[0]} (平均 ${bestCoverage[1].avgCoverage}%)`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('💡 实战建议');
  console.log('='.repeat(100) + '\n');

  console.log('根据测试结果，推荐使用策略：\n');
  
  console.log('🥇 主力模型选择：');
  console.log('   - 追求性价比 → DeepSeek (成本最低，质量不错)');
  console.log('   - 追求质量   → 查看上方"最高质量"模型');
  console.log('   - 追求速度   → 查看上方"最快响应"模型\n');

  console.log('🔄 组合使用策略：');
  console.log('   - 简单任务（语法纠错）→ 用最便宜的模型');
  console.log('   - 复杂任务（作文批改）→ 用质量最高的模型');
  console.log('   - 实时互动（发音分析）→ 用速度最快的模型\n');

  console.log('='.repeat(100) + '\n');
  console.log('✅ 测试完成！\n');
}

main().catch(console.error);

