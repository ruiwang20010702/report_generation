import bcrypt from 'bcrypt';
import { query, closePool } from '../server/config/database.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 导入用户到数据库
 * @param email 用户邮箱
 * @param password 用户密码（明文）
 */
async function importUser(email: string, password: string) {
  try {
    console.log(`\n🚀 开始导入用户: ${email}`);
    
    // 检查用户是否已存在
    const existingUser = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('✅ 密码已加密');

    if (existingUser.rows.length > 0) {
      // 用户已存在，更新密码
      console.log('⚠️  用户已存在，更新密码...');
      await query(
        'UPDATE users SET passwd_hash = $1, updated_at = TIMEZONE(\'utc\'::text, NOW()) WHERE email = $2',
        [hashedPassword, email]
      );
      console.log(`✅ 用户密码已更新: ${email}`);
      console.log(`   用户ID: ${existingUser.rows[0].id}`);
    } else {
      // 用户不存在，创建新用户
      console.log('📝 创建新用户...');
      const result = await query(
        'INSERT INTO users (email, passwd_hash, created_at, updated_at) VALUES ($1, $2, TIMEZONE(\'utc\'::text, NOW()), TIMEZONE(\'utc\'::text, NOW())) RETURNING id, email, created_at',
        [email, hashedPassword]
      );
      console.log(`✅ 用户创建成功: ${email}`);
      console.log(`   用户ID: ${result.rows[0].id}`);
      console.log(`   创建时间: ${result.rows[0].created_at}`);
    }

    console.log('✅ 导入完成！\n');
  } catch (error: any) {
    console.error('❌ 导入失败:', error.message);
    if (error.code) {
      console.error('   错误代码:', error.code);
    }
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  const email = '704778107@qq.com';
  const password = 'Wr18912332269';

  try {
    // 测试数据库连接
    console.log('🔍 测试数据库连接...');
    await query('SELECT NOW()');
    console.log('✅ 数据库连接成功\n');

    // 确保 passwd_hash 字段存在
    console.log('🔍 检查 passwd_hash 字段...');
    try {
      await query('SELECT passwd_hash FROM users LIMIT 1');
      console.log('✅ passwd_hash 字段已存在\n');
    } catch (error: any) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('⚠️  passwd_hash 字段不存在，正在添加...');
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS passwd_hash TEXT');
        console.log('✅ passwd_hash 字段已添加\n');
      } else {
        throw error;
      }
    }

    // 导入用户
    await importUser(email, password);
  } catch (error: any) {
    console.error('\n❌ 操作失败:', error.message);
    process.exit(1);
  } finally {
    // 关闭数据库连接池
    await closePool();
  }
}

// 运行脚本
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

export { importUser };

