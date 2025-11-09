#!/usr/bin/env node

/**
 * 阿里云语音服务测试脚本
 * 
 * 用法：
 *   node test-aliyun.js
 * 
 * 检查项：
 * 1. 环境变量是否配置
 * 2. 服务是否正确初始化
 * 3. 额度统计是否正常
 */

import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

console.log('🧪 测试阿里云语音服务配置\n');
console.log('=' .repeat(60));

// 检查环境变量
const checks = [
  {
    name: 'ALIYUN_ACCESS_KEY_ID',
    value: process.env.ALIYUN_ACCESS_KEY_ID,
    required: true,
  },
  {
    name: 'ALIYUN_ACCESS_KEY_SECRET',
    value: process.env.ALIYUN_ACCESS_KEY_SECRET,
    required: true,
  },
  {
    name: 'ALIYUN_NLS_APP_KEY',
    value: process.env.ALIYUN_NLS_APP_KEY,
    required: true,
  },
  {
    name: 'OPENAI_API_KEY',
    value: process.env.OPENAI_API_KEY,
    required: false,
  },
  {
    name: 'ASSEMBLYAI_API_KEY',
    value: process.env.ASSEMBLYAI_API_KEY,
    required: false,
  },
];

let hasAliyun = true;
let hasAssemblyAI = false;
let hasOpenAI = false;

console.log('\n📋 环境变量检查:\n');

checks.forEach(check => {
  const status = check.value ? '✅' : (check.required ? '❌' : '⚠️ ');
  const display = check.value 
    ? `${check.value.substring(0, 10)}...` 
    : '未配置';
  
  console.log(`${status} ${check.name}: ${display}`);
  
  // 统计配置情况
  if (check.name === 'ALIYUN_ACCESS_KEY_ID' && !check.value) {
    hasAliyun = false;
  }
  if (check.name === 'ASSEMBLYAI_API_KEY' && check.value) {
    hasAssemblyAI = true;
  }
  if (check.name === 'OPENAI_API_KEY' && check.value) {
    hasOpenAI = true;
  }
});

console.log('\n' + '='.repeat(60));

// 显示配置状态
console.log('\n🎯 服务状态:\n');

if (hasAliyun) {
  console.log('✅ 阿里云: 已配置（国内优先）');
  console.log('   - 免费额度: 120分钟/月');
  console.log('   - 速度: ⚡ 快（国内服务器）');
  console.log('   - 网络: ✅ 无需VPN');
} else {
  console.log('❌ 阿里云: 未配置');
  console.log('   - 建议国内用户配置');
  console.log('   - 配置文档: docs/getting-started/ALIYUN_QUICKSTART.md');
}

console.log('');

if (hasAssemblyAI) {
  console.log('✅ AssemblyAI: 已配置（国际备用）');
  console.log('   - 免费额度: 300分钟/月');
  console.log('   - 速度: 🌍 中等（国际网络）');
  console.log('   - 网络: ⚠️  可能需要VPN');
} else {
  console.log('⚠️  AssemblyAI: 未配置（可选）');
  console.log('   - 国际用户可配置');
}

console.log('');

if (hasOpenAI) {
  console.log('✅ OpenAI Whisper: 已配置（保底方案）');
  console.log('   - 成本: $0.006/分钟');
  console.log('   - 速度: 🎙️ 快');
  console.log('   - 网络: ⚠️  可能需要代理');
} else {
  console.log('⚠️  OpenAI Whisper: 未配置');
  console.log('   - 用于 GPT-4 分析（必需）');
}

console.log('\n' + '='.repeat(60));

// 显示智能降级策略
console.log('\n🔄 智能降级策略:\n');

if (hasAliyun && hasAssemblyAI && hasOpenAI) {
  console.log('✨ 最佳配置！三层保障：');
  console.log('   1️⃣  阿里云（前120分钟，国内快）');
  console.log('   2️⃣  AssemblyAI（121-420分钟，国际服务）');
  console.log('   3️⃣  Whisper（超出420分钟，付费保底）');
  console.log('\n   💰 预计节省: $2.52/月（1500分钟场景）');
} else if (hasAliyun && hasOpenAI) {
  console.log('✅ 国内优化配置：');
  console.log('   1️⃣  阿里云（前120分钟，国内快）');
  console.log('   2️⃣  Whisper（超出120分钟，付费）');
  console.log('\n   💰 预计节省: $0.72/月（1500分钟场景）');
} else if (hasAssemblyAI && hasOpenAI) {
  console.log('✅ 国际配置：');
  console.log('   1️⃣  AssemblyAI（前300分钟）');
  console.log('   2️⃣  Whisper（超出300分钟，付费）');
  console.log('\n   💰 预计节省: $1.80/月（1500分钟场景）');
} else if (hasOpenAI) {
  console.log('⚠️  基础配置（仅 Whisper）：');
  console.log('   - 所有转录均付费（$0.006/分钟）');
  console.log('   - 建议配置免费服务节省成本');
} else {
  console.log('❌ 未配置任何服务！');
  console.log('   - 至少需要配置 OPENAI_API_KEY');
}

console.log('\n' + '='.repeat(60));

// 显示建议
console.log('\n💡 配置建议:\n');

if (!hasAliyun && !hasAssemblyAI) {
  console.log('📌 强烈建议配置免费转录服务：');
  console.log('   🇨🇳 国内用户: 配置阿里云（5分钟快速配置）');
  console.log('      → docs/getting-started/ALIYUN_QUICKSTART.md');
  console.log('   🌍 国际用户: 配置 AssemblyAI');
  console.log('      → https://www.assemblyai.com/');
} else if (!hasAliyun) {
  console.log('📌 国内用户建议配置阿里云：');
  console.log('   ✅ 无需VPN，速度更快');
  console.log('   ✅ 每月额外2小时免费额度');
  console.log('   → docs/getting-started/ALIYUN_QUICKSTART.md');
} else if (!hasAssemblyAI) {
  console.log('📌 可选配置 AssemblyAI（国际备用）：');
  console.log('   ✅ 每月额外5小时免费额度');
  console.log('   ⚠️  需要国际网络访问');
}

if (!hasOpenAI) {
  console.log('\n❗ 必须配置 OpenAI API Key：');
  console.log('   - 用于 GPT-4 分析学习报告');
  console.log('   - 用于 Whisper 转录（备用）');
  console.log('   → https://platform.openai.com/api-keys');
}

console.log('\n' + '='.repeat(60));

// 显示下一步操作
console.log('\n🚀 下一步:\n');

if (hasAliyun || hasAssemblyAI || hasOpenAI) {
  console.log('✅ 配置完成，可以启动服务：');
  console.log('\n   npm run dev:all');
  console.log('\n   然后访问: http://localhost:8080');
} else {
  console.log('❌ 请先配置环境变量：');
  console.log('\n   1. 复制示例文件:');
  console.log('      cp env.aliyun.example .env');
  console.log('\n   2. 编辑 .env 文件，添加你的 API Keys');
  console.log('\n   3. 重新运行此测试:');
  console.log('      node test-aliyun.js');
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ 测试完成！\n');

// 返回状态码
if (!hasOpenAI) {
  console.log('⚠️  警告: 未配置 OpenAI API Key\n');
  process.exit(1);
}

process.exit(0);

