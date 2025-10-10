import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Return the current code version to verify deployment
  return res.status(200).json({
    version: '2025-01-10-final-fix',
    timestamp: new Date().toISOString(),
    extractionFormula: 'currentMidpoint.x - targetMidpoint.x',
    commit: '4d062b8',
    message: 'If you see this, the latest code is deployed',
  });
}
