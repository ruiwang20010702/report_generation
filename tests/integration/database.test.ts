/**
 * 数据库集成测试
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool, testConnection } from '../../server/config/database';

describe('Database Connection', () => {
  beforeAll(async () => {
    // 确保数据库连接可用
    await testConnection();
  });
  
  afterAll(async () => {
    // 清理连接池
    await pool.end();
  });
  
  it('should connect to the database', async () => {
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT NOW()');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('now');
    } finally {
      client.release();
    }
  });
  
  it('should have correct table structure', async () => {
    const client = await pool.connect();
    
    try {
      // 检查 reports 表是否存在
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'reports'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
      
      // 检查必要的列是否存在
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'reports'
        ORDER BY ordinal_position;
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('video_url');
      expect(columnNames).toContain('transcript');
      expect(columnNames).toContain('analysis');
      expect(columnNames).toContain('created_at');
    } finally {
      client.release();
    }
  });
  
  it('should have correct indexes', async () => {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'reports';
      `);
      
      const indexNames = result.rows.map(row => row.indexname);
      
      // 检查关键索引是否存在
      expect(indexNames).toContain('idx_reports_user_id');
      expect(indexNames).toContain('idx_reports_created_at');
    } finally {
      client.release();
    }
  });
  
  it('should insert and retrieve a record', async () => {
    const client = await pool.connect();
    
    try {
      // 插入测试记录（不需要 user_id，因为它可以为 NULL）
      const insertResult = await client.query(`
        INSERT INTO reports 
        (video_url, transcript, analysis)
        VALUES ($1, $2, $3)
        RETURNING id;
      `, ['https://example.com/test.mp4', 'Test transcript', { test: true }]);
      
      expect(insertResult.rows).toHaveLength(1);
      const insertedId = insertResult.rows[0].id;
      
      // 检索记录
      const selectResult = await client.query(`
        SELECT * FROM reports WHERE id = $1;
      `, [insertedId]);
      
      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0].video_url).toBe('https://example.com/test.mp4');
      expect(selectResult.rows[0].transcript).toBe('Test transcript');
      
      // 清理测试数据
      await client.query(`DELETE FROM reports WHERE id = $1;`, [insertedId]);
    } finally {
      client.release();
    }
  });
});

