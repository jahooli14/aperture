/**
 * Mint an ephemeral auth token for the browser to connect directly to the
 * Gemini Live API. The token is single-use, scoped to the Live model used
 * by the onboarding chat, expires in 30 minutes, and does NOT expose
 * GEMINI_API_KEY to the client.
 *
 * GET /api/onboarding-token
 *  → { token: string, model: string, expiresAt: string }
 *
 * Per Google AI docs (April 2026), ephemeral tokens are required for any
 * client-to-server Live API connection.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { MODELS } from './_lib/models.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('[onboarding-token] GEMINI_API_KEY missing')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  try {
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: 'v1alpha' },
    })

    // Token lifetime: 30 min total, 1 min to start a new session.
    // Tight scoping — single-use, locked to the Live model + AUDIO modality.
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString()

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: MODELS.FLASH_LIVE,
          config: {
            responseModalities: ['AUDIO'] as any,
            temperature: 0.6,
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    return res.status(200).json({
      token: token.name,
      model: MODELS.FLASH_LIVE,
      expiresAt: expireTime,
    })
  } catch (err: any) {
    console.error('[onboarding-token] mint failed:', err?.message, err?.stack)
    return res.status(500).json({ error: 'Token mint failed' })
  }
}
