import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      tingwu: !!process.env.ALIYUN_ACCESS_KEY_ID && !!process.env.ALIYUN_ACCESS_KEY_SECRET,
    },
  };

  return res.status(200).json(health);
}

