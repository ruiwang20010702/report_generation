#!/usr/bin/env tsx
/**
 * 数据库连接测试脚本
 * 用于测试数据库连接是否正常
 * 
 * 使用方法：
 *   npm run test:db
 *   或
 *   tsx scripts/test-database.ts
 */

import dotenv from 'dotenv';
import { testConnection, query, closePool } from '../server/config/database.js';

// 加载环境变量
dotenv.config();

async function main() {
  console.log('🔍 开始测试数据库连接...\n');
  
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

  // 检查表是否存在
  console.log('\n🔍 检查数据库表...\n');
  
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
      
      // 获取用户数量
      const userCount = await query('SELECT COUNT(*) FROM users');
      console.log(`   └─ 用户数量: ${userCount.rows[0].count}`);
    } else {
      console.log('❌ users 表不存在');
      console.log('   └─ 请执行: psql -h <host> -U <user> -d <database> -f database/create_users_table.sql');
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
      
      // 获取验证码统计
      const otpStats = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE used = false AND expires_at > NOW()) as active,
          COUNT(*) FILTER (WHERE used = true) as used,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired
        FROM otps
      `);
      const stats = otpStats.rows[0];
      console.log(`   └─ 验证码统计: 总计 ${stats.total}, 有效 ${stats.active}, 已使用 ${stats.used}, 已过期 ${stats.expired}`);
    } else {
      console.log('❌ otps 表不存在');
      console.log('   └─ 请执行: psql -h <host> -U <user> -d <database> -f database/create_otps_table.sql');
    }
    
    // 检查 reports 表（可选）
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
    console.error('❌ 检查表时出错:', error.message);
  }

  // 关闭连接
  await closePool();
  
  console.log('\n✅ 数据库测试完成！\n');
}

main().catch((error) => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});

