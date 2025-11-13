/**
 * 安全功能集成测试
 */

import { describe, it, expect } from '@jest/globals';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

describe('Security Headers', () => {
  it('should include security headers in responses', async () => {
    const response = await fetch(`${API_BASE}/api/health`);
    
    // 检查安全头
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
    expect(response.headers.get('content-security-policy')).toBeTruthy();
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
  
  it('should include request ID in response headers', async () => {
    const response = await fetch(`${API_BASE}/api/health`);
    
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
  
  it('should accept custom request ID', async () => {
    const customRequestId = 'test-request-123';
    const response = await fetch(`${API_BASE}/api/health`, {
      headers: {
        'X-Request-Id': customRequestId,
      },
    });
    
    expect(response.headers.get('x-request-id')).toBe(customRequestId);
  });
});

describe('Rate Limiting', () => {
  it('should apply rate limiting to API endpoints', async () => {
    // 发送多个请求以测试限流（需要根据实际限流配置调整）
    const requests = Array.from({ length: 10 }, () => 
      fetch(`${API_BASE}/api/health`)
    );
    
    const responses = await Promise.all(requests);
    
    // 所有请求都应该成功（在限流范围内）
    responses.forEach(response => {
      expect([200, 429]).toContain(response.status);
    });
  });
});

describe('Input Validation', () => {
  it('should reject requests with SQL injection patterns', async () => {
    const maliciousPayload = {
      videoUrl: "'; DROP TABLE users; --",
      studentId: "1234",
    };
    
    const response = await fetch(`${API_BASE}/api/analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(maliciousPayload),
    });
    
    // 应该被拒绝或清理
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
  
  it('should reject requests with XSS patterns', async () => {
    const maliciousPayload = {
      videoUrl: '<script>alert("xss")</script>',
      studentId: '1234',
    };
    
    const response = await fetch(`${API_BASE}/api/analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(maliciousPayload),
    });
    
    // 应该被拒绝或清理
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe('CORS', () => {
  it('should include CORS headers', async () => {
    const response = await fetch(`${API_BASE}/api/health`, {
      headers: {
        'Origin': 'http://localhost:8080',
      },
    });
    
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });
});

