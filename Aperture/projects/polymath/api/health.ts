/**
 * Health Check Endpoint
 * Returns system health and configuration status
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV || 'unknown'
    },
    configuration: {
      supabaseUrl: !!process.env.VITE_SUPABASE_URL,
      supabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      geminiApiKey: !!process.env.GEMINI_API_KEY,
      geminiApiKeyLength: process.env.GEMINI_API_KEY?.length || 0,
      geminiApiKeyPrefix: process.env.GEMINI_API_KEY?.substring(0, 10) + '...'
    }
  }

  return res.status(200).json(health)
}
