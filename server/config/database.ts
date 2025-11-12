import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// 加载环境变量（确保在创建连接池之前加载）
dotenv.config();

/**
 * 数据库连接配置
 * 优先使用 DATABASE_URL (Zeabur自动注入)
 * 否则从单独的环境变量读取
 */
const dbConfig: PoolConfig = process.env.DATABASE_URL 
  ? {
      // Zeabur 模式：使用 DATABASE_URL
      connectionString: process.env.DATABASE_URL,
      // 连接池配置
      max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Zeabur环境减少连接数
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10),
      // Zeabur 通常需要 SSL
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false, // Zeabur证书兼容性
      } : false,
    }
  : {
      // 传统模式：单独的环境变量（阿里云等）
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || ''),
      // 连接池配置
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10),
      // SSL 配置
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      } : false,
    };

/**
 * 创建数据库连接池
 * 使用连接池可以提高性能并管理连接
 */
export const pool = new Pool(dbConfig);

/**
 * 测试数据库连接
 */
export async function testConnection(): Promise<boolean> {
  try {
    // 使用直接连接而不是连接池，避免连接池初始化问题
    const { Client } = await import('pg');
    
    // 构建 SSL 配置
    let sslConfig: any = false;
    if (process.env.DB_SSL === 'true') {
      sslConfig = {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      };
    }
    
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || ''),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '30000', 10), // 增加到30秒
      ssl: sslConfig,
    });
    
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 连接已建立，执行查询...');
    const result = await client.query('SELECT NOW()');
    await client.end();
    console.log('✅ 数据库连接成功:', result.rows[0].now);
    return true;
  } catch (error: any) {
    console.error('❌ 数据库连接失败:', error.message);
    if (error.code) {
      console.error('   错误代码:', error.code);
    }
    if (error.stack) {
      console.error('   堆栈信息:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    return false;
  }
}

/**
 * 执行 SQL 查询
 * @param text SQL 查询文本
 * @param params 查询参数
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 执行查询:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('❌ 查询错误:', { text, error });
    throw error;
  }
}

/**
 * 获取客户端（用于事务）
 */
export async function getClient() {
  return await pool.connect();
}

/**
 * 关闭连接池（应用关闭时调用）
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('✅ 数据库连接池已关闭');
}

// 处理连接错误
pool.on('error', (err) => {
  console.error('❌ 数据库连接池错误:', err);
});

// 优雅关闭
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

