#!/usr/bin/env tsx
/**
 * 数据库表创建脚本
 * 用于在数据库中创建必要的表
 * 
 * 使用方法：
 *   npm run setup:db
 *   或
 *   tsx scripts/setup-database.ts
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { testConnection, query, closePool } from '../server/config/database.js';

// 加载环境变量
dotenv.config();

async function executeSqlFile(filePath: string, description: string): Promise<boolean> {
  try {
    console.log(`📝 ${description}...`);
    
    // 读取 SQL 文件
    const sql = readFileSync(filePath, 'utf-8');
    
    // 执行 SQL（按语句分割执行，因为可能包含多个语句）
    // 使用简单的方法：直接执行整个 SQL 文件
    await query(sql);
    
    console.log(`   ✅ ${description}成功\n`);
    return true;
  } catch (error: any) {
    // 如果是表已存在的错误，不算失败
    if (error.message && error.message.includes('already exists')) {
      console.log(`   ⚠️  ${description}已存在（跳过）\n`);
      return true;
    }
    console.error(`   ❌ ${description}失败:`, error.message);
    console.error(`   堆栈信息:`, error.stack?.split('\n').slice(0, 3).join('\n'));
    return false;
  }
}

async function main() {
  console.log('🚀 开始设置数据库表...\n');
  
  // 显示配置信息（隐藏密码）
  console.log('📋 数据库配置:');
  
  // 检查是否使用连接字符串（Zeabur 模式）
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING;
  if (connectionString) {
    console.log('   模式: Zeabur 连接字符串');
    console.log(`   连接字符串: ${connectionString.substring(0, 30)}...（已隐藏）`);
  } else {
    console.log('   模式: 单独环境变量');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || '5432'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'postgres'}`);
  console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
  console.log(`   Password: ${process.env.DB_PASSWORD ? '***' : '(未设置)'}`);
    console.log(`   SSL: ${process.env.DB_SSL === 'true' ? '启用' : '禁用'}`);
  }
  console.log('');

  // 测试连接
  console.log('🔍 测试数据库连接...\n');
  const connected = await testConnection();
  
  if (!connected) {
    console.error('\n❌ 数据库连接失败！');
    console.error('\n请检查：');
    console.error('1. 数据库服务是否运行');
    console.error('2. 环境变量配置是否正确（.env 文件）');
    console.error('3. 网络连接是否正常');
    console.error('4. 防火墙规则是否允许访问');
    console.error('5. SSL 配置是否正确\n');
    process.exit(1);
  }

  // 获取项目根目录
  const rootDir = join(process.cwd());
  
  // 执行 SQL 文件
  console.log('📊 创建数据库表...\n');
  
  const results = {
    users: false,
    otps: false,
    reports: false,
  };
  
  // 1. 创建 users 表
  results.users = await executeSqlFile(
    join(rootDir, 'database', 'create_users_table.sql'),
    '创建 users 表'
  );
  
  // 2. 创建 otps 表
  results.otps = await executeSqlFile(
    join(rootDir, 'database', 'create_otps_table.sql'),
    '创建 otps 表'
  );
  
  // 3. 创建 reports 表（可选）
  results.reports = await executeSqlFile(
    join(rootDir, 'database', 'create_reports_table.sql'),
    '创建 reports 表'
  );
  
  // 验证表创建
  console.log('🔍 验证表创建...\n');
  
  try {
    // 检查 users 表
    const usersTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (usersTable.rows[0].exists) {
      console.log('✅ users 表存在');
    } else {
      console.log('❌ users 表不存在');
    }
    
    // 检查 otps 表
    const otpsTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'otps'
      );
    `);
    
    if (otpsTable.rows[0].exists) {
      console.log('✅ otps 表存在');
    } else {
      console.log('❌ otps 表不存在');
    }
    
    // 检查 reports 表
    const reportsTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reports'
      );
    `);
    
    if (reportsTable.rows[0].exists) {
      console.log('✅ reports 表存在');
    } else {
      console.log('⚠️  reports 表不存在（可选）');
    }
    
  } catch (error: any) {
    console.error('❌ 验证表时出错:', error.message);
  }

  // 关闭连接
  await closePool();
  
  // 总结
  console.log('\n' + '='.repeat(50));
  if (results.users && results.otps) {
    console.log('✅ 数据库表设置完成！');
    console.log('\n现在可以运行 \'npm run test:db\' 测试连接\n');
  } else {
    console.log('⚠️  部分表创建失败，请检查错误信息\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 设置失败:', error);
  process.exit(1);
});

