/**
 * Retroactive logging (SPEC.md's "untracked hours" fix for the mirror).
 *
 * "Did two hours on the decks last night" has to become a real session
 * row, matched to a real project and a real duration -- not a guess
 * hardcoded on whichever project happens to be live. This is what makes
 * the mirror an honest scoreboard instead of one that only counts what
 * happened to occur inside the app.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'

export interface RetroParseResult {
  projectId: string
  durationMinutes: number
}

export async function parseRetroText(
  supabase: SupabaseClient,
  userId: string,
  text: string
): Promise<RetroParseResult | null> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(100)

  if (!projects || projects.length === 0) return null

  const prompt = `The user just said this about time they spent working on something:
"${text}"

Their projects:
${projects.map(p => `[${p.id}] "${p.title}"`).join('\n')}

Which project id does this refer to, and how many minutes did they spend? If it's genuinely
unclear which project, or no duration is mentioned, say so.

Respond with JSON only: { "project_id": "..." | null, "minutes": number | null }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'minimal' })
    const parsed = JSON.parse(response)
    const projectId = typeof parsed?.project_id === 'string' ? parsed.project_id : null
    const minutes = typeof parsed?.minutes === 'number' ? Math.round(parsed.minutes) : null

    if (!projectId || !minutes || minutes <= 0) return null
    if (!projects.some(p => p.id === projectId)) return null // model must stay inside the real set

    return { projectId, durationMinutes: minutes }
  } catch (e) {
    console.warn('[retro-parser] parse failed:', e instanceof Error ? e.message : e)
    return null
  }
}
