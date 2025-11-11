#!/usr/bin/env tsx
/**
 * 环境变量检查脚本
 * 用于检查必要的环境变量是否已配置
 * 
 * 使用方法：
 *   npm run check:env
 *   或
 *   tsx scripts/check-env.ts
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';

// 加载环境变量
dotenv.config();

interface EnvCheck {
  name: string;
  value: string | undefined;
  required: boolean;
  description: string;
  masked?: boolean;
}

const envChecks: EnvCheck[] = [
  // 数据库配置
  {
    name: 'DB_HOST',
    value: process.env.DB_HOST,
    required: true,
    description: '数据库主机地址（如：your-database.rds.aliyuncs.com）',
  },
  {
    name: 'DB_PORT',
    value: process.env.DB_PORT,
    required: false,
    description: '数据库端口（默认：5432）',
  },
  {
    name: 'DB_NAME',
    value: process.env.DB_NAME,
    required: true,
    description: '数据库名称',
  },
  {
    name: 'DB_USER',
    value: process.env.DB_USER,
    required: true,
    description: '数据库用户名',
  },
  {
    name: 'DB_PASSWORD',
    value: process.env.DB_PASSWORD,
    required: true,
    description: '数据库密码',
    masked: true,
  },
  {
    name: 'JWT_SECRET',
    value: process.env.JWT_SECRET,
    required: true,
    description: 'JWT 密钥（用于生成和验证 token）',
    masked: true,
  },
  // 可选配置
  {
    name: 'DB_SSL',
    value: process.env.DB_SSL,
    required: false,
    description: '是否启用 SSL（生产环境推荐：true）',
  },
  {
    name: 'OPENAI_API_KEY',
    value: process.env.OPENAI_API_KEY,
    required: false,
    description: 'OpenAI API Key（用于 GPT-4 分析）',
    masked: true,
  },
  {
    name: 'ALIYUN_ACCESS_KEY_ID',
    value: process.env.ALIYUN_ACCESS_KEY_ID,
    required: false,
    description: '阿里云 AccessKey ID（用于语音转录）',
  },
  {
    name: 'ALIYUN_ACCESS_KEY_SECRET',
    value: process.env.ALIYUN_ACCESS_KEY_SECRET,
    required: false,
    description: '阿里云 AccessKey Secret',
    masked: true,
  },
  {
    name: 'ALIYUN_NLS_APP_KEY',
    value: process.env.ALIYUN_NLS_APP_KEY,
    required: false,
    description: '阿里云智能语音 AppKey',
  },
];

function maskValue(value: string | undefined): string {
  if (!value) return '(未设置)';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

function main() {
  console.log('🔍 检查环境变量配置...\n');

  // 检查 .env 文件
  const envFileExists = existsSync('.env');
  if (envFileExists) {
    console.log('✅ .env 文件存在\n');
  } else {
    console.log('⚠️  .env 文件不存在\n');
    console.log('💡 提示：');
    console.log('   1. 复制 env.aliyun.example 为 .env');
    console.log('   2. 编辑 .env 文件，填写数据库连接信息\n');
  }

  // 检查环境变量
  let allRequired = true;
  const requiredMissing: string[] = [];
  const optionalMissing: string[] = [];

  console.log('📋 环境变量检查结果：\n');

  for (const check of envChecks) {
    const hasValue = check.value !== undefined && check.value !== '';
    const displayValue = check.masked && hasValue 
      ? maskValue(check.value) 
      : (check.value || '(未设置)');

    if (check.required) {
      if (hasValue) {
        console.log(`✅ ${check.name}: ${displayValue}`);
      } else {
        console.log(`❌ ${check.name}: ${displayValue}`);
        console.log(`   └─ ${check.description}`);
        allRequired = false;
        requiredMissing.push(check.name);
      }
    } else {
      if (hasValue) {
        console.log(`✅ ${check.name}: ${displayValue}`);
      } else {
        console.log(`⚠️  ${check.name}: ${displayValue} (可选)`);
        console.log(`   └─ ${check.description}`);
        optionalMissing.push(check.name);
      }
    }
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 总结
  if (allRequired) {
    console.log('✅ 所有必需的环境变量已配置！\n');
    console.log('💡 下一步：');
    console.log('   1. 在数据库中创建表：npm run setup:db');
    console.log('   2. 测试数据库连接：npm run test:db');
    console.log('   3. 启动服务器：npm run dev\n');
  } else {
    console.log('❌ 缺少必需的环境变量！\n');
    console.log('📝 需要配置的变量：');
    requiredMissing.forEach(name => {
      const check = envChecks.find(c => c.name === name);
      console.log(`   - ${name}: ${check?.description}`);
    });
    console.log('\n💡 配置步骤：');
    console.log('   1. 复制 env.aliyun.example 为 .env（如果还没有）');
    console.log('   2. 编辑 .env 文件，填写上述环境变量');
    console.log('   3. 重新运行此脚本检查：npm run check:env\n');
  }

  if (optionalMissing.length > 0) {
    console.log('💡 可选配置（用于增强功能）：');
    optionalMissing.forEach(name => {
      const check = envChecks.find(c => c.name === name);
      console.log(`   - ${name}: ${check?.description}`);
    });
    console.log('');
  }
}

main();

