import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Return the current code version to verify deployment
  return res.status(200).json({
    version: '2025-01-10-cache-busting',
    timestamp: new Date().toISOString(),
    extractionFormula: 'currentMidpoint.x - targetMidpoint.x',
    commit: 'a68697a+',
    message: 'Added cache-busting timestamps to aligned URLs',
  });
}
