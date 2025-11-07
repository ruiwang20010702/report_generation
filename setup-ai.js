#!/usr/bin/env node

/**
 * 🎯 AI 模型快速配置工具
 * 
 * 帮助用户交互式配置 AI 模型
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function showBanner() {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 国内 AI 模型配置向导');
  console.log('='.repeat(70) + '\n');
  console.log('本工具将帮助你快速配置适合国内使用的 AI 模型\n');
}

function showModels() {
  console.log('📋 支持的模型：\n');
  
  const models = [
    {
      num: '1',
      name: 'DeepSeek',
      emoji: '🔷',
      desc: '性价比之王 - 推荐首选',
      free: '500万 tokens 免费',
      cost: '超出后 ¥0.01/次'
    },
    {
      num: '2',
      name: '通义千问 (Qwen)',
      emoji: '🇨🇳',
      desc: '免费额度大 - 个人推荐',
      free: '每月 100万 tokens',
      cost: '超出后 ¥0.08/次'
    },
    {
      num: '3',
      name: '智谱 GLM-4',
      emoji: '🧠',
      desc: '质量标杆 - 清华背景',
      free: '送 25元体验金',
      cost: 'Plus ¥1.5/次, Flash 免费'
    },
    {
      num: '4',
      name: 'OpenAI GPT-4',
      emoji: '🤖',
      desc: '国际标准 - 需要代理',
      free: '无',
      cost: '约 ¥1.5/次'
    }
  ];

  models.forEach(m => {
    console.log(`${m.num}. ${m.emoji} ${m.name}`);
    console.log(`   ${m.desc}`);
    console.log(`   免费额度: ${m.free}`);
    console.log(`   成本: ${m.cost}\n`);
  });
}

function getModelConfig(choice) {
  const configs = {
    '1': {
      name: 'DeepSeek',
      envKey: 'DEEPSEEK_API_KEY',
      url: 'https://platform.deepseek.com/',
      steps: [
        '1. 访问 https://platform.deepseek.com/',
        '2. 支持微信/手机号快速注册（30秒）',
        '3. 登录后 → 左侧菜单 "API Keys"',
        '4. 点击 "创建 API Key"',
        '5. 复制密钥（格式：sk-xxxxx）'
      ]
    },
    '2': {
      name: '通义千问',
      envKey: 'QWEN_API_KEY',
      url: 'https://dashscope.console.aliyun.com/',
      steps: [
        '1. 访问 https://dashscope.console.aliyun.com/',
        '2. 点击"立即开通"（免费，无需付费）',
        '3. 登录阿里云账号（或快速注册）',
        '4. 控制台 → 右上角 "API-KEY 管理"',
        '5. "创建新的 API-KEY"',
        '6. 复制密钥（格式：sk-xxxxx）'
      ]
    },
    '3': {
      name: '智谱 GLM-4',
      envKey: 'GLM_API_KEY',
      url: 'https://open.bigmodel.cn/',
      steps: [
        '1. 访问 https://open.bigmodel.cn/',
        '2. 手机号/邮箱注册',
        '3. 控制台 → "API 管理"',
        '4. "创建 API Key"',
        '5. 复制密钥'
      ]
    },
    '4': {
      name: 'OpenAI',
      envKey: 'OPENAI_API_KEY',
      url: 'https://platform.openai.com/',
      steps: [
        '1. 访问 https://platform.openai.com/',
        '2. 注册账号（需要国外手机号）',
        '3. 绑定信用卡（国外卡）',
        '4. 创建 API Key',
        '5. 复制密钥（格式：sk-xxxxx）',
        '⚠️  注意：需要稳定的代理/VPN'
      ]
    }
  };

  return configs[choice];
}

function updateEnvFile(envKey, apiKey) {
  const envPath = path.join(__dirname, '.env');
  let envContent = '';

  // 读取现有 .env 文件
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // 检查是否已存在该配置
  const regex = new RegExp(`^${envKey}=.*$`, 'm');
  
  if (regex.test(envContent)) {
    // 更新现有配置
    envContent = envContent.replace(regex, `${envKey}=${apiKey}`);
    console.log(`\n✅ 已更新 ${envKey}`);
  } else {
    // 添加新配置
    envContent += `\n${envKey}=${apiKey}\n`;
    console.log(`\n✅ 已添加 ${envKey}`);
  }

  // 写回文件
  fs.writeFileSync(envPath, envContent);
}

async function testApiKey(envKey) {
  console.log('\n🔄 正在测试 API Key...\n');
  
  const testScripts = {
    'DEEPSEEK_API_KEY': 'test:deepseek',
    'QWEN_API_KEY': 'test:qwen',
    'GLM_API_KEY': 'test:glm',
    'OPENAI_API_KEY': 'test:openai'
  };

  const script = testScripts[envKey];
  if (script) {
    console.log(`运行测试命令: npm run ${script}\n`);
    console.log('💡 你也可以稍后手动运行：npm run test:models 对比所有模型\n');
  }
}

async function main() {
  showBanner();

  // 询问是否需要帮助
  const needHelp = await question('需要配置 AI 模型吗？(y/n): ');
  
  if (needHelp.toLowerCase() !== 'y') {
    console.log('\n👋 随时运行 node setup-ai.js 来配置\n');
    rl.close();
    return;
  }

  console.log('');
  showModels();

  // 选择模型
  const choice = await question('请选择要配置的模型 (1-4): ');
  
  if (!['1', '2', '3', '4'].includes(choice)) {
    console.log('\n❌ 无效的选择\n');
    rl.close();
    return;
  }

  const config = getModelConfig(choice);
  
  console.log(`\n📝 配置 ${config.name}\n`);
  console.log('获取 API Key 的步骤：\n');
  config.steps.forEach(step => console.log(`   ${step}`));
  
  console.log(`\n🔗 官网地址: ${config.url}\n`);

  // 询问是否已有 API Key
  const hasKey = await question('你已经有 API Key 了吗？(y/n): ');
  
  if (hasKey.toLowerCase() !== 'y') {
    console.log(`\n💡 请先访问 ${config.url} 注册并获取 API Key`);
    console.log('   获取后再次运行: node setup-ai.js\n');
    rl.close();
    return;
  }

  // 输入 API Key
  const apiKey = await question(`\n请输入你的 ${config.name} API Key: `);
  
  if (!apiKey || apiKey.trim().length < 10) {
    console.log('\n❌ API Key 无效（太短）\n');
    rl.close();
    return;
  }

  // 保存到 .env
  try {
    updateEnvFile(config.envKey, apiKey.trim());
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 配置成功！');
    console.log('='.repeat(70) + '\n');

    // 测试建议
    await testApiKey(config.envKey);

    // 下一步
    console.log('📋 下一步：\n');
    console.log('   1. 测试配置：npm run test:models');
    console.log('   2. 启动服务：npm run dev:all');
    console.log('   3. 访问应用：http://localhost:8080\n');

    // 询问是否继续配置其他模型
    const configMore = await question('要配置其他模型吗？(y/n): ');
    
    if (configMore.toLowerCase() === 'y') {
      rl.close();
      // 递归调用
      main();
    } else {
      console.log('\n👋 配置完成，开始使用吧！\n');
      rl.close();
    }

  } catch (error) {
    console.error('\n❌ 保存配置失败:', error.message);
    console.log('\n💡 请手动在 .env 文件中添加：');
    console.log(`   ${config.envKey}=${apiKey}\n`);
    rl.close();
  }
}

// 处理 Ctrl+C
rl.on('close', () => {
  process.exit(0);
});

main().catch(error => {
  console.error('❌ 发生错误:', error);
  rl.close();
});

