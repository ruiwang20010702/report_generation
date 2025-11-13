/**
 * API 端点集成测试
 */

import { describe, it, expect } from '@jest/globals';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

describe('Analysis API', () => {
  it('should reject requests without required fields', async () => {
    const response = await fetch(`${API_BASE}/api/analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });
  
  it('should validate video URL format', async () => {
    const response = await fetch(`${API_BASE}/api/analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl: 'invalid-url',
        studentId: 'TEST001',
      }),
    });
    
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
  
  it('should validate student ID format', async () => {
    const response = await fetch(`${API_BASE}/api/analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl: 'https://example.com/video.mp4',
        studentId: '', // 空学生ID
      }),
    });
    
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Reports API', () => {
  it('should retrieve reports with pagination', async () => {
    const response = await fetch(`${API_BASE}/api/analysis/reports?page=1&limit=10`);
    
    expect([200, 404]).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      expect(Array.isArray(data) || data.reports).toBeTruthy();
    }
  });
  
  it('should filter reports by student ID', async () => {
    const response = await fetch(`${API_BASE}/api/analysis/reports?studentId=TEST001`);
    
    expect([200, 404]).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      // 验证返回的数据格式
      expect(data).toBeDefined();
    }
  });
});

describe('Error Handling', () => {
  it('should return 404 for non-existent API routes', async () => {
    const response = await fetch(`${API_BASE}/api/non-existent-route`);
    
    expect(response.status).toBe(404);
  });
  
  it('should handle malformed JSON', async () => {
    const response = await fetch(`${API_BASE}/api/analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json {{{',
    });
    
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
  
  it('should return structured error responses', async () => {
    const response = await fetch(`${API_BASE}/api/non-existent-route`);
    const data = await response.json();
    
    expect(data).toHaveProperty('error');
    expect(typeof data.error).toBe('string');
  });
});

describe('Content Negotiation', () => {
  it('should return JSON by default', async () => {
    const response = await fetch(`${API_BASE}/api/health`);
    
    expect(response.headers.get('content-type')).toContain('application/json');
  });
  
  it('should handle missing Accept header', async () => {
    const response = await fetch(`${API_BASE}/api/health`, {
      headers: {
        'Accept': '',
      },
    });
    
    expect(response.status).toBe(200);
  });
});

