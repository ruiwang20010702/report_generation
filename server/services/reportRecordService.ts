/**
 * 报告记录服务
 * 用于记录每次生成报告的关键信息（用户、时间、学生姓名、成本）
 */

import { pool } from '../config/database.js';
import type { CostBreakdown } from '../types/index.js';

export interface ReportRecord {
  userId?: string;
  studentName: string;
  costBreakdown: CostBreakdown;
  analysisData?: any; // 完整的分析报告数据（可选）
}

export class ReportRecordService {
  /**
   * 记录报告生成信息到数据库
   */
  async recordReport(record: ReportRecord): Promise<string> {
    try {
      const query = `
        INSERT INTO reports (
          user_id,
          student_name,
          cost_breakdown,
          analysis_data,
          created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, created_at
      `;

      const values = [
        record.userId || null,
        record.studentName,
        JSON.stringify(record.costBreakdown),
        record.analysisData ? JSON.stringify(record.analysisData) : null
      ];

      const result = await pool.query(query, values);
      const reportId = result.rows[0].id;
      const createdAt = result.rows[0].created_at;

      console.log(`✅ 报告记录已保存到数据库`);
      console.log(`   报告ID: ${reportId}`);
      console.log(`   学生姓名: ${record.studentName}`);
      console.log(`   生成时间: ${createdAt}`);
      console.log(`   总成本: ¥${record.costBreakdown.total.cost.toFixed(4)}`);

      return reportId;
    } catch (error) {
      console.error('❌ 保存报告记录失败:', error);
      // 不抛出错误，避免影响主流程
      return '';
    }
  }

  /**
   * 查询用户的报告记录（用于后期统计）
   */
  async getUserReports(userId: string, limit: number = 50) {
    try {
      const query = `
        SELECT 
          id,
          student_name,
          cost_breakdown,
          created_at
        FROM reports
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ 查询报告记录失败:', error);
      return [];
    }
  }

  /**
   * 统计成本信息（用于后期分析）
   */
  async getCostStatistics(userId?: string) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_reports,
          SUM((cost_breakdown->>'total')::numeric) as total_cost,
          AVG((cost_breakdown->>'total')::numeric) as avg_cost,
          MIN(created_at) as first_report,
          MAX(created_at) as last_report
        FROM reports
      `;

      const values: any[] = [];
      if (userId) {
        query += ' WHERE user_id = $1';
        values.push(userId);
      }

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ 查询成本统计失败:', error);
      return null;
    }
  }

  /**
   * 查询所有报告记录（管理员用）
   */
  async getAllReports(limit: number = 100, offset: number = 0) {
    try {
      const query = `
        SELECT 
          r.id,
          r.user_id,
          u.email as user_email,
          r.student_name,
          r.cost_breakdown,
          r.created_at
        FROM reports r
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ 查询所有报告记录失败:', error);
      return [];
    }
  }
}

export const reportRecordService = new ReportRecordService();

