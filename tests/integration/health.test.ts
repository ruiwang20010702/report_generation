/**
 * 健康检查端点集成测试
 */

import { describe, it, expect } from '@jest/globals';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

describe('Health Check Endpoints', () => {
  it('should return healthy status from /api/health', async () => {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
  });
  
  it('should return detailed health info from /api/health/detailed', async () => {
    const response = await fetch(`${API_BASE}/api/health/detailed`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data).toHaveProperty('checks');
    expect(data.checks).toHaveProperty('database');
    expect(data.checks).toHaveProperty('system');
  });
  
  it('should return live status from /api/health/live', async () => {
    const response = await fetch(`${API_BASE}/api/health/live`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('live');
  });
  
  it('should return ready status from /api/health/ready', async () => {
    const response = await fetch(`${API_BASE}/api/health/ready`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('ready');
  });
});

describe('Metrics Endpoint', () => {
  it('should return metrics in JSON format', async () => {
    const response = await fetch(`${API_BASE}/api/metrics`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('requests');
    expect(data).toHaveProperty('system');
  });
  
  it('should return metrics in Prometheus format', async () => {
    const response = await fetch(`${API_BASE}/api/metrics?format=prometheus`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(text).toContain('http_requests_total');
    expect(text).toContain('process_heap_bytes');
  });
});

