#!/usr/bin/env tsx
/**
 * 环境变量交互式配置脚本
 * 用于帮助用户配置数据库连接信息
 * 
 * 使用方法：
 *   npm run setup:env
 *   或
 *   tsx scripts/setup-env.ts
 */

import dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

// 加载现有环境变量
dotenv.config();

interface Question {
  key: string;
  label: string;
  required: boolean;
  default?: string;
  mask?: boolean;
}

const questions: Question[] = [
  {
    key: 'DB_HOST',
    label: '数据库主机地址（如：pgm-xxxxx.pg.rds.aliyuncs.com 或 localhost）\n  提示：在阿里云控制台 RDS 实例的"连接信息"中查看',
    required: true,
  },
  {
    key: 'DB_PORT',
    label: '数据库端口',
    required: false,
    default: '5432',
  },
  {
    key: 'DB_NAME',
    label: '数据库名称',
    required: true,
  },
  {
    key: 'DB_USER',
    label: '数据库用户名',
    required: true,
  },
  {
    key: 'DB_PASSWORD',
    label: '数据库密码',
    required: true,
    mask: true,
  },
  {
    key: 'JWT_SECRET',
    label: 'JWT 密钥（用于生成和验证 token，建议使用强密码）',
    required: true,
    default: generateRandomSecret(),
  },
  {
    key: 'DB_SSL',
    label: '是否启用 SSL（生产环境推荐：true）',
    required: false,
    default: 'true',
  },
];

function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function askQuestion(rl: ReturnType<typeof createInterface>, question: Question): Promise<string> {
  return new Promise((resolve) => {
    const currentValue = process.env[question.key];
    const prompt = currentValue
      ? `\n${question.label}\n  当前值: ${question.mask && currentValue ? maskValue(currentValue) : currentValue}\n  按 Enter 保持当前值，或输入新值: `
      : `\n${question.label}${question.default ? ` (默认: ${question.mask && question.default ? maskValue(question.default) : question.default})` : ''}${question.required ? ' *' : ''}: `;

    rl.question(prompt, (answer) => {
      if (!answer.trim()) {
        // 如果用户没有输入，使用当前值或默认值
        resolve(currentValue || question.default || '');
      } else {
        resolve(answer.trim());
      }
    });
  });
}

function maskValue(value: string): string {
  if (!value) return '(未设置)';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

async function main() {
  console.log('🔧 环境变量交互式配置工具\n');
  console.log('=' .repeat(50));
  console.log('此工具将帮助您配置数据库连接信息');
  console.log('=' .repeat(50) + '\n');

  // 检查 .env 文件
  const envFileExists = existsSync('.env');
  if (envFileExists) {
    console.log('✅ 检测到 .env 文件存在');
    console.log('   将更新现有配置\n');
  } else {
    console.log('⚠️  未检测到 .env 文件');
    console.log('   将创建新的 .env 文件\n');
  }

  // 读取现有 .env 文件内容
  let envContent = '';
  if (envFileExists) {
    try {
      envContent = readFileSync('.env', 'utf-8');
    } catch (error) {
      console.error('❌ 读取 .env 文件失败:', error);
      process.exit(1);
    }
  } else {
    // 如果不存在，从示例文件读取模板
    try {
      envContent = readFileSync('env.aliyun.example', 'utf-8');
    } catch (error) {
      console.error('❌ 读取 env.aliyun.example 文件失败:', error);
      process.exit(1);
    }
  }

  // 创建 readline 接口
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answers: Record<string, string> = {};

  try {
    // 询问每个问题
    for (const question of questions) {
      const answer = await askQuestion(rl, question);
      
      if (question.required && !answer) {
        console.error(`\n❌ 错误: ${question.label} 是必需的，不能为空`);
        rl.close();
        process.exit(1);
      }
      
      if (answer) {
        answers[question.key] = answer;
      }
    }

    rl.close();

    // 更新 .env 文件内容
    let updatedContent = envContent;
    
    for (const [key, value] of Object.entries(answers)) {
      // 检查是否已存在该变量
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(updatedContent)) {
        // 替换现有值
        updatedContent = updatedContent.replace(regex, `${key}=${value}`);
      } else {
        // 添加到文件末尾
        updatedContent += `\n${key}=${value}\n`;
      }
    }

    // 写入 .env 文件
    try {
      writeFileSync('.env', updatedContent, 'utf-8');
      console.log('\n✅ 环境变量配置已保存到 .env 文件\n');
    } catch (error) {
      console.error('\n❌ 写入 .env 文件失败:', error);
      process.exit(1);
    }

    // 显示配置摘要
    console.log('📋 配置摘要：');
    console.log('=' .repeat(50));
    for (const [key, value] of Object.entries(answers)) {
      const question = questions.find(q => q.key === key);
      const displayValue = question?.mask ? maskValue(value) : value;
      console.log(`${key}: ${displayValue}`);
    }
    console.log('=' .repeat(50) + '\n');

    // 提示下一步
    console.log('💡 下一步：');
    console.log('   1. 检查配置：npm run check:env');
    console.log('   2. 在数据库中创建表：npm run setup:db');
    console.log('   3. 测试数据库连接：npm run test:db');
    console.log('   4. 启动服务器：npm run dev\n');

  } catch (error) {
    rl.close();
    console.error('\n❌ 配置过程中出错:', error);
    process.exit(1);
  }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⚠️  配置已取消');
  process.exit(0);
});

main().catch((error) => {
  console.error('❌ 配置失败:', error);
  process.exit(1);
});

