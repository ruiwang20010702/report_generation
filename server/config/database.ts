import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// 加载环境变量（确保在创建连接池之前加载）
dotenv.config();

/**
 * 数据库连接配置
 * 优先使用 DATABASE_URL 或 POSTGRES_CONNECTION_STRING (Zeabur自动注入)
 * 否则从单独的环境变量读取
 */
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING;

// SSL 配置函数：统一处理 SSL 设置
function getSSLConfig() {
  // 如果明确设置了 DB_SSL=false，则禁用 SSL（Zeabur 场景）
  if (process.env.DB_SSL === 'false') {
    console.log('🔓 SSL: 已禁用 (DB_SSL=false)');
    return false;
  }
  // 如果明确设置了 DB_SSL=true，则启用 SSL
  if (process.env.DB_SSL === 'true') {
    console.log('🔒 SSL: 已启用 (DB_SSL=true)');
    return {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    };
  }
  // 默认：禁用 SSL（Zeabur PostgreSQL 不支持 SSL）
  console.log('🔓 SSL: 默认禁用 (Zeabur 兼容模式)');
  return false;
}

const dbConfig: PoolConfig = connectionString
  ? {
      // Zeabur 模式：使用连接字符串
      connectionString: connectionString,
      // 连接池配置
      max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Zeabur环境减少连接数
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10),
      // SSL 配置（Zeabur PostgreSQL 不支持 SSL）
      ssl: getSSLConfig(),
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
      ssl: getSSLConfig(),
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
    
    // 优先使用连接字符串（Zeabur 模式）
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING;
    
    let clientConfig: any;
    
    if (connectionString) {
      // Zeabur 模式：使用连接字符串
      console.log('🔗 使用连接字符串模式 (Zeabur)');
      clientConfig = {
        connectionString: connectionString,
        connectionTimeoutMillis: 30000,
        // 使用统一的 SSL 配置函数
        ssl: getSSLConfig(),
      };
    } else {
      // 传统模式：单独的环境变量
      console.log('🔗 使用单独环境变量模式');
      
      clientConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || ''),
        connectionTimeoutMillis: 30000,
        // 使用统一的 SSL 配置函数
        ssl: getSSLConfig(),
      };
    }
    
    const client = new Client(clientConfig);
    
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

