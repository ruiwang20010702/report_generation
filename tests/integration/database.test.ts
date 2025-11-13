/**
 * 数据库集成测试
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getPool, testConnection } from '../../server/config/database.js';

describe('Database Connection', () => {
  beforeAll(async () => {
    // 确保数据库连接可用
    await testConnection();
  });
  
  afterAll(async () => {
    // 清理连接池
    const pool = getPool();
    await pool.end();
  });
  
  it('should connect to the database', async () => {
    const pool = getPool();
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
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      // 检查 analysis_reports 表是否存在
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'analysis_reports'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
      
      // 检查必要的列是否存在
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'analysis_reports'
        ORDER BY ordinal_position;
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('student_id');
      expect(columnNames).toContain('video_url');
      expect(columnNames).toContain('transcript');
      expect(columnNames).toContain('analysis');
      expect(columnNames).toContain('created_at');
    } finally {
      client.release();
    }
  });
  
  it('should have correct indexes', async () => {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'analysis_reports';
      `);
      
      const indexNames = result.rows.map(row => row.indexname);
      
      // 检查关键索引是否存在
      expect(indexNames).toContain('idx_student_id');
      expect(indexNames).toContain('idx_created_at');
      expect(indexNames).toContain('idx_student_created');
    } finally {
      client.release();
    }
  });
  
  it('should insert and retrieve a record', async () => {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      // 插入测试记录
      const insertResult = await client.query(`
        INSERT INTO analysis_reports 
        (student_id, video_url, transcript, analysis)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `, ['TEST001', 'https://example.com/test.mp4', 'Test transcript', { test: true }]);
      
      expect(insertResult.rows).toHaveLength(1);
      const insertedId = insertResult.rows[0].id;
      
      // 检索记录
      const selectResult = await client.query(`
        SELECT * FROM analysis_reports WHERE id = $1;
      `, [insertedId]);
      
      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0].student_id).toBe('TEST001');
      expect(selectResult.rows[0].video_url).toBe('https://example.com/test.mp4');
      
      // 清理测试数据
      await client.query(`DELETE FROM analysis_reports WHERE id = $1;`, [insertedId]);
    } finally {
      client.release();
    }
  });
});

