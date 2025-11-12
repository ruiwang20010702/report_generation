/**
 * 管理员路由
 * 用于查询报告记录和成本统计
 */

import express from 'express';
import { reportRecordService } from '../services/reportRecordService.js';

const router = express.Router();

/**
 * 查询所有报告记录
 * GET /api/admin/reports?limit=100&offset=0
 */
router.get('/reports', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const reports = await reportRecordService.getAllReports(limit, offset);

    res.json({
      success: true,
      data: reports,
      pagination: {
        limit,
        offset,
        count: reports.length
      }
    });
  } catch (error) {
    console.error('查询报告记录失败:', error);
    res.status(500).json({
      success: false,
      error: '查询报告记录失败'
    });
  }
});

/**
 * 查询成本统计
 * GET /api/admin/cost-statistics?userId=xxx
 */
router.get('/cost-statistics', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const statistics = await reportRecordService.getCostStatistics(userId);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('查询成本统计失败:', error);
    res.status(500).json({
      success: false,
      error: '查询成本统计失败'
    });
  }
});

/**
 * 查询用户的报告记录
 * GET /api/admin/user-reports/:userId?limit=50
 */
router.get('/user-reports/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const reports = await reportRecordService.getUserReports(userId, limit);

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('查询用户报告记录失败:', error);
    res.status(500).json({
      success: false,
      error: '查询用户报告记录失败'
    });
  }
});

export default router;

