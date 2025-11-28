/**
 * 报告记录服务
 * 用于记录每次生成报告的关键信息（用户、时间、学生姓名、成本）
 */

import { pool } from '../config/database.js';
import type { CostBreakdown } from '../types/index.js';
import { toBeijingTime } from '../utils/datetime.js';

export interface ReportRecord {
  userId?: string;
  studentName: string;
  studentId?: string;
  videoUrl?: string;
  transcript?: string;
  audioDur?: number;
  fileName?: string;
  fileUrl?: string;
  costDetail: CostBreakdown;
  analysisData?: any; // 完整的分析报告数据（可选）
}

export interface ReportSummary {
  id: string;
  studentId?: string | null;
  studentName?: string | null;
  grade?: string | null;
  level?: string | null;
  unit?: string | null;
  costDetail?: CostBreakdown | null;
  createdAt: string;
}

export interface ReportRecordMeta {
  id: string;
  createdAt: string;
}

export class ReportRecordService {
  /**
   * 记录报告生成信息到数据库
   */
  async recordReport(record: ReportRecord): Promise<ReportRecordMeta | null> {
    try {
      // 如果有 userId，查询用户的 email
      let userEmail: string | null = null;
      if (record.userId) {
        try {
          const userResult = await pool.query(
            'SELECT email FROM users WHERE id = $1',
            [record.userId]
          );
          if (userResult.rows.length > 0) {
            userEmail = userResult.rows[0].email;
          }
        } catch (err) {
          console.warn('⚠️ 查询用户email失败（不影响报告保存）:', err);
        }
      }

      // 从 costDetail 中提取 report_cost（转录 + AI分析成本）
      const transcriptionCost = record.costDetail?.transcription?.cost ?? 0;
      const aiAnalysisCost = record.costDetail?.aiAnalysis?.totalCost ?? 0;
      const reportCost = transcriptionCost + aiAnalysisCost;

      const query = `
        INSERT INTO reports (
          user_id,
          user_email,
          student_id,
          student_name,
          video_url,
          transcript,
          audio_dur,
          file_name,
          file_url,
          cost_detail,
          report_cost,
          analysis_data,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING id, created_at
      `;

      const values = [
        record.userId || null,
        userEmail,
        record.studentId || null,
        record.studentName || null,
        record.videoUrl || null,
        record.transcript || null,
        record.audioDur || null,
        record.fileName || null,
        record.fileUrl || null,
        JSON.stringify(record.costDetail),
        reportCost || null,
        record.analysisData ? JSON.stringify(record.analysisData) : null
      ];

      const result = await pool.query(query, values);
      const reportId = result.rows[0].id;
      const createdAt = result.rows[0].created_at;

      console.log(`✅ 报告记录已保存到数据库`);
      console.log(`   报告ID: ${reportId}`);
      console.log(`   学生姓名: ${record.studentName}`);
      if (record.studentId) console.log(`   学生ID: ${record.studentId}`);
      if (userEmail) console.log(`   用户邮箱: ${userEmail}`);
      console.log(`   生成时间: ${createdAt}`);
      console.log(`   总成本: ¥${record.costDetail.total.cost.toFixed(4)}`);

      return {
        id: reportId,
        createdAt: toBeijingTime(createdAt),
      };
    } catch (error) {
      console.error('❌ 保存报告记录失败:', error);
      // 不抛出错误，避免影响主流程
      return null;
    }
  }

  /**
   * 查询用户的报告记录（用于后期统计）
   */
  async getUserReports(
    userId: string,
    options: { limit?: number; offset?: number; studentId?: string } = {}
  ): Promise<{ reports: ReportSummary[]; total: number }> {
    const { limit = 50, offset = 0, studentId } = options;

    try {
      const filters: string[] = ['user_id = $1'];
      const params: any[] = [userId];

      if (studentId) {
        filters.push(`student_id = $${params.length + 1}`);
        params.push(studentId);
      }

      const whereClause = filters.join(' AND ');
      const dataQuery = `
        SELECT 
          id,
          student_id,
          student_name,
          analysis_data->>'grade' as grade,
          analysis_data->>'level' as level,
          analysis_data->>'unit' as unit,
          cost_detail,
          created_at
        FROM reports
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `;

      const countQuery = `
        SELECT COUNT(*)::int as total
        FROM reports
        WHERE ${whereClause}
      `;

      const dataParams = [...params, limit, offset];
      const [dataResult, countResult] = await Promise.all([
        pool.query(dataQuery, dataParams),
        pool.query(countQuery, params),
      ]);

      const summaries: ReportSummary[] = dataResult.rows.map((row) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        grade: row.grade,
        level: row.level,
        unit: row.unit,
        costDetail: row.cost_detail,
        createdAt: toBeijingTime(row.created_at),
      }));

      return {
        reports: summaries,
        total: countResult.rows[0]?.total || 0,
      };
    } catch (error) {
      console.error('❌ 查询报告记录失败:', error);
      return {
        reports: [],
        total: 0,
      };
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
          SUM((cost_detail->'total'->>'cost')::numeric) as total_cost,
          AVG((cost_detail->'total'->>'cost')::numeric) as avg_cost,
          MIN(created_at) as first_report,
          MAX(created_at) as last_report
        FROM reports
        WHERE cost_detail IS NOT NULL
      `;

      const values: any[] = [];
      if (userId) {
        query += ' AND user_id = $1';
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
          r.student_id,
          u.email as user_email,
          r.analysis_data->>'studentName' as student_name,
          r.cost_detail,
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

  /**
   * 根据ID查询报告（可选按用户限制）
   */
  async getReportById(reportId: string, userId?: string) {
    try {
      const params: any[] = [reportId];
      let condition = 'id = $1';

      if (userId) {
        params.push(userId);
        condition += ` AND user_id = $${params.length}`;
      }

      const query = `
        SELECT 
          id,
          user_id,
          student_id,
          student_name,
          cost_detail,
          analysis_data,
          created_at
        FROM reports
        WHERE ${condition}
        LIMIT 1
      `;

      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        id: row.id,
        userId: row.user_id,
        studentId: row.student_id,
        studentName: row.student_name,
        costDetail: row.cost_detail,
        analysisData: row.analysis_data,
        createdAt: toBeijingTime(row.created_at),
      };
    } catch (error) {
      console.error('❌ 查询报告详情失败:', error);
      return null;
    }
  }

  /**
   * 更新报告的分析内容
   */
  async updateReportAnalysis(reportId: string, userId: string, analysisData: any) {
    try {
      const serialized = JSON.stringify(analysisData);
      const studentName =
        analysisData && typeof analysisData.studentName === 'string'
          ? analysisData.studentName
          : null;

      const query = `
        UPDATE reports
        SET 
          analysis_data = $3::jsonb,
          student_name = COALESCE($4, student_name),
          updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      const result = await pool.query(query, [reportId, userId, serialized, studentName]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('❌ 更新报告数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取报告的解读版数据（缓存）
   */
  async getInterpretation(reportId: string): Promise<any | null> {
    try {
      const query = `
        SELECT interpretation_data
        FROM reports
        WHERE id = $1
        LIMIT 1
      `;

      const result = await pool.query(query, [reportId]);
      if (result.rows.length === 0) {
        return null;
      }

      const data = result.rows[0].interpretation_data;
      if (!data) {
        return null;
      }

      console.log(`✅ 从缓存读取解读版数据，报告ID: ${reportId}`);
      return data;
    } catch (error) {
      console.error('❌ 读取解读版数据失败:', error);
      return null;
    }
  }

  /**
   * 保存报告的解读版数据（缓存）并更新花费信息
   */
  async saveInterpretation(
    reportId: string, 
    interpretationData: any,
    costInfo?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
      model: string;
      currency: string;
    }
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(interpretationData);

      if (costInfo) {
        // 同时更新解读版数据和花费信息
        // interpretation_cost 累加（支持重新生成解读版），total_cost 由数据库自动计算
        const query = `
          UPDATE reports
          SET 
            interpretation_data = $2::jsonb,
            cost_detail = jsonb_set(
              jsonb_set(
                COALESCE(cost_detail, '{}'::jsonb),
                '{interpretation}',
                $3::jsonb
              ),
              '{total,cost}',
              to_jsonb(COALESCE(report_cost, 0) + COALESCE(interpretation_cost, 0) + $4::numeric)
            ),
            interpretation_cost = COALESCE(interpretation_cost, 0) + $4,
            updated_at = NOW()
          WHERE id = $1
          RETURNING id, report_cost, interpretation_cost, total_cost
        `;

        const interpretationCostData = {
          model: costInfo.model,
          promptTokens: costInfo.promptTokens,
          completionTokens: costInfo.completionTokens,
          totalTokens: costInfo.totalTokens,
          cost: costInfo.cost,
          currency: costInfo.currency,
          generatedAt: new Date().toISOString(),
        };

        const result = await pool.query(query, [
          reportId, 
          serialized, 
          JSON.stringify(interpretationCostData),
          costInfo.cost
        ]);
        const success = (result.rowCount ?? 0) > 0;

        if (success) {
          const row = result.rows[0];
          const reportCost = parseFloat(row.report_cost) || 0;
          const interpretationCost = parseFloat(row.interpretation_cost) || 0;
          const totalCost = parseFloat(row.total_cost) || 0;
          console.log(`✅ 解读版数据已缓存，报告ID: ${reportId}`);
          console.log(`   💰 报告生成费用: ¥${reportCost.toFixed(4)}`);
          console.log(`   💰 解读版累计费用: ¥${interpretationCost.toFixed(4)} (本次: +¥${costInfo.cost.toFixed(4)})`);
          console.log(`   💰 总费用: ¥${totalCost.toFixed(4)}`);
        } else {
          console.warn(`⚠️ 未找到报告记录，无法缓存解读版数据，报告ID: ${reportId}`);
        }

        return success;
      } else {
        // 只更新解读版数据（用于缓存命中时）
        const query = `
          UPDATE reports
          SET 
            interpretation_data = $2::jsonb,
            updated_at = NOW()
          WHERE id = $1
          RETURNING id
        `;

        const result = await pool.query(query, [reportId, serialized]);
        const success = (result.rowCount ?? 0) > 0;

        if (success) {
          console.log(`✅ 解读版数据已缓存，报告ID: ${reportId}`);
        } else {
          console.warn(`⚠️ 未找到报告记录，无法缓存解读版数据，报告ID: ${reportId}`);
        }

        return success;
      }
    } catch (error) {
      console.error('❌ 保存解读版数据失败:', error);
      return false;
    }
  }
}

export const reportRecordService = new ReportRecordService();

