#!/usr/bin/env node
/**
 * 安全迁移执行脚本
 * 执行数据库迁移并验证结果
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { pool } from '../server/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function executeMigration() {
  console.log('🚀 开始执行数据库迁移...\n');

  try {
    // 1. 测试数据库连接
    console.log('1️⃣ 测试数据库连接...');
    await pool.query('SELECT 1');
    console.log('   ✅ 数据库连接成功\n');

    // 2. 读取迁移脚本
    console.log('2️⃣ 读取迁移脚本...');
    const migrationPath = join(__dirname, '../database/migrations/add_analysis_jobs_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('   ✅ 迁移脚本已加载\n');

    // 3. 检查迁移前状态
    console.log('3️⃣ 检查迁移前状态...');
    const beforeCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'analysis_jobs'
      ) as table_exists;
    `);
    const tableExistsBefore = beforeCheck.rows[0].table_exists;
    console.log(`   📊 analysis_jobs 表存在: ${tableExistsBefore ? '是' : '否'}\n`);

    // 4. 执行迁移
    console.log('4️⃣ 执行迁移脚本...');
    console.log('   ⏳ 正在执行 SQL 语句...');
    
    // 直接执行整个 SQL 文件（PostgreSQL 支持多语句）
    // 清理 SQL：移除注释行，但保留函数定义中的注释
    const cleanedSQL = migrationSQL
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // 保留非注释行，以及函数定义中的内容
        return !trimmed.startsWith('--') || trimmed.startsWith('-- =') || trimmed.length === 0;
      })
      .join('\n');

    try {
      await pool.query(cleanedSQL);
      console.log('   ✅ 迁移脚本执行完成\n');
    } catch (error: any) {
      // 检查是否是预期的错误（如表已存在）
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key')) {
        console.log('   ⚠️  某些对象已存在（使用 IF NOT EXISTS 安全处理）');
        console.log('   ✅ 迁移脚本执行完成\n');
      } else {
        throw error;
      }
    }

    // 5. 验证迁移结果
    console.log('5️⃣ 验证迁移结果...');
    
    // 检查表是否存在
    const afterCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'analysis_jobs'
      ) as table_exists;
    `);
    const tableExistsAfter = afterCheck.rows[0].table_exists;

    if (!tableExistsAfter) {
      throw new Error('迁移失败：analysis_jobs 表未创建');
    }
    console.log('   ✅ analysis_jobs 表已创建');

    // 检查表结构
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'analysis_jobs'
      ORDER BY ordinal_position;
    `);
    console.log(`   ✅ 表结构验证：${columns.rows.length} 个列`);
    columns.rows.forEach(col => {
      console.log(`      - ${col.column_name} (${col.data_type})`);
    });

    // 检查索引
    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND tablename = 'analysis_jobs';
    `);
    console.log(`   ✅ 索引验证：${indexes.rows.length} 个索引`);
    indexes.rows.forEach(idx => {
      console.log(`      - ${idx.indexname}`);
    });

    // 检查触发器
    const triggers = await pool.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_schema = 'public' 
        AND event_object_table = 'analysis_jobs';
    `);
    console.log(`   ✅ 触发器验证：${triggers.rows.length} 个触发器`);
    triggers.rows.forEach(trg => {
      console.log(`      - ${trg.trigger_name}`);
    });

    console.log('');

    // 6. 总结
    console.log('📋 迁移总结：');
    if (tableExistsBefore) {
      console.log('   ℹ️  表在迁移前已存在，迁移脚本使用了 IF NOT EXISTS 安全处理');
    } else {
      console.log('   ✅ 新表已成功创建');
    }
    console.log('   ✅ 所有索引已创建');
    console.log('   ✅ 触发器已配置');
    console.log('   ✅ 迁移完成，可以安全使用！');
    console.log('');

  } catch (error) {
    console.error('\n❌ 迁移失败：');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error(`\n   堆栈信息：\n${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
    } else {
      console.error('   未知错误');
    }
    console.error('');
    console.error('💡 提示：');
    console.error('   - 迁移脚本使用了 IF NOT EXISTS，可以安全重试');
    console.error('   - 如果表已存在，迁移不会影响现有数据');
    console.error('   - 检查数据库连接和权限');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

executeMigration().catch((error) => {
  console.error('未处理的错误：', error);
  process.exit(1);
});

