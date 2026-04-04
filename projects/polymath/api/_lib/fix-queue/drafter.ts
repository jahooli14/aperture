/**
 * Fix Drafter
 * Uses AI to generate a concrete, data-driven fix specification
 * from an annoyance description and fix_hint.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from '../idea-engine-v2/models.js'
import type { FixDraft } from './types.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function draftFix(annoyance: {
  content: string
  original_thought: string
  fix_hint: string
  severity: string
  user_email: string
}): Promise<FixDraft | null> {
  const model = genAI.getGenerativeModel({
    model: MODELS.FILTER, // Use Flash (slightly better than Lite) for fix design
    generationConfig: { responseMimeType: 'application/json' }
  })

  const prompt = `You are a life automation engineer. Given a user's annoyance, design a concrete automated fix.

ANNOYANCE: "${annoyance.content}"
CONTEXT: "${annoyance.original_thought}"
HINT: "${annoyance.fix_hint}"
SEVERITY: ${annoyance.severity}
USER EMAIL: ${annoyance.user_email}

Design a fix using ONLY these action types:
1. send_email: Send a reminder/notification email
2. send_email_digest: Aggregate and send a summary email
3. http_request: Call an external API (weather, etc.)
4. smart_home: Control Samsung Frame TV, Sonos speakers, or bird cam

RULES:
- The fix must be fully data-driven (no custom code needed)
- Use cron expressions for scheduling (standard 5-field format)
- Timezone should be Europe/London
- Keep it simple — one fix, one purpose
- Estimate the monthly cost (emails via Resend are ~$0.001 each, API calls are free/cheap)
- For weather: use Open-Meteo API (free, no key needed). London coords: lat=51.5074&lon=-0.1278
- For email reminders: the "to" field should be the user's email
- For smart home: just specify device + command, the runner handles the rest

Return JSON:
{
  "name": "short-kebab-case-name",
  "description": "One sentence explaining what this fix does and when",
  "schedule": {
    "cron": "0 20 * * 2",
    "timezone": "Europe/London",
    "description": "Every Tuesday at 8pm"
  },
  "actions": [
    {
      "type": "send_email",
      "to": "user@example.com",
      "subject": "Reminder subject",
      "body": "The reminder message with any dynamic context"
    }
  ],
  "estimated_cost": "$0.03/month"
}

If the annoyance cannot be reasonably automated (e.g. "fix the leaky tap"), return:
{ "name": null }

Return only valid JSON.`

  const result = await model.generateContent(prompt)
  const response = result.response.text().trim()

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  const parsed = JSON.parse(jsonMatch[0])
  if (!parsed.name) return null

  return parsed as FixDraft
}
