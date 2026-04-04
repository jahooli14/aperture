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

1. send_email: Simple email reminder/notification
   { "type": "send_email", "to": "email", "subject": "...", "body": "HTML body" }

2. weather_email: Email with live weather data injected (Open-Meteo, free)
   { "type": "weather_email", "to": "email", "subject": "...", "lat": 51.5074, "lon": -0.1278, "template": "Good morning! Here's the weather:<br><br>{{weather}}<br><br>Have a great day." }

3. send_email_digest: Aggregate and send a summary email
   { "type": "send_email_digest", "to": "email", "subject": "...", "items_query": "what to summarise" }

4. http_request: Call an external API
   { "type": "http_request", "url": "...", "method": "GET|POST|PUT" }

5. smart_home: Control devices (Samsung Frame TV, Sonos speakers, bird cam)
   { "type": "smart_home", "device": "frame_tv|sonos|bird_cam", "command": "...", "params": {} }

   Frame TV commands: art_mode_on, art_mode_off, next_art
   Sonos commands: play, pause, set_volume (params: {volume: "30"}), play_favourite (params: {name: "Playlist Name"}), say (params: {text: "Hello"})
   Bird cam commands: snapshot

RULES:
- The fix must be fully data-driven (no custom code)
- Use cron expressions for scheduling (standard 5-field format)
- Timezone: Europe/London
- Keep it simple — one fix, one purpose
- Prefer weather_email over http_request+send_email when weather data is needed
- For email "to" field: use the user's email address
- Estimate monthly cost (emails ~$0.001 each, APIs free)
- You can chain multiple actions in the actions array

Return JSON:
{
  "name": "short-kebab-case-name",
  "description": "One sentence explaining what this fix does and when",
  "schedule": {
    "cron": "0 7 * * *",
    "timezone": "Europe/London",
    "description": "Every day at 7am"
  },
  "actions": [ ... ],
  "estimated_cost": "$0.03/month"
}

If the annoyance CANNOT be automated at all (e.g. "fix the leaky tap"), return:
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
