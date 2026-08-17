/**
 * Portfolio-level triage — "what should I work on, across everything I've
 * got going" — as distinct from project-chat, which only operates inside
 * one already-chosen project. Never touches task-level detail; its only
 * output is which project (and what to do about it right now).
 *
 * Lives in _lib (like metabolism.ts, project-maintenance.ts) rather than
 * inline in brainstorm.ts to keep that file within the repo's file-size
 * convention — brainstorm.ts stays the thin step dispatcher.
 */

import { generateText } from './gemini-chat.js'
import { CHAT_TURN_RULES, PLAIN_ENGLISH_RULES } from './plain-english.js'

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
}

export interface PortfolioProjectSummary {
  id: string
  title: string
  type?: string
  status: string
  is_priority: boolean
  up_next_position: number | null
  daysSinceActive: number
  progressPercent: number
  totalTasks: number
  completedTasks: number
  nextTaskText?: string
  nextTaskMinutes?: number
  heatReason?: string
  evolvedDescription?: string
}

export interface PortfolioAction {
  type: 'set_priority' | 'add_up_next' | 'remove_up_next' | 'bury' | 'start_session'
  projectId: string
  projectTitle: string
  reasoning?: string
}

export async function handlePortfolioChat(
  body: {
    message: string
    history?: ConversationMessage[]
    feeling?: string | null
    projects: PortfolioProjectSummary[]
  },
  _userId: string
): Promise<{ reply: string; actions: PortfolioAction[] }> {
  const { message, history = [], feeling, projects = [] } = body

  if (!message) {
    throw Object.assign(new Error('message is required'), { status: 400 })
  }

  const projectBlock = projects.length > 0
    ? projects.map(p => {
        const tags = [
          p.is_priority ? 'PRIORITY' : null,
          p.up_next_position ? `up next #${p.up_next_position}` : null,
        ].filter(Boolean).join(', ')
        const tagPart = tags ? ` [${tags}]` : ''
        const nextPart = p.nextTaskText
          ? ` — next: "${p.nextTaskText}"${p.nextTaskMinutes ? ` (~${p.nextTaskMinutes}m)` : ''}`
          : p.totalTasks === 0 ? ' — no tasks yet' : ''
        const reasonPart = p.heatReason
          ? `\n     ↳ ${p.heatReason}`
          : p.evolvedDescription
            ? `\n     ↳ ${p.evolvedDescription}`
            : ''
        return `- [id:${p.id}] "${p.title}"${p.type ? ` (${p.type})` : ''}, ${p.status}${tagPart}, last touched ${p.daysSinceActive}d ago, ${p.progressPercent}% done (${p.completedTasks}/${p.totalTasks})${nextPart}${reasonPart}`
      }).join('\n')
    : 'No active projects.'

  const priorTurns = history
    .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n')

  const prompt = `You're the friend who knows everything they've got going and helps them pick what to work on right now. Not a project coach — that's a different job, and it only starts once they're inside a specific project. Your only job here is choosing the next thing, and helping them start it.

THEIR PROJECTS:
${projectBlock}
${feeling ? `\nHOW THEY'RE FEELING RIGHT NOW: ${feeling}` : ''}

═══════════════════════════════════════════════════════════════════
YOUR JOBS — IN ORDER
═══════════════════════════════════════════════════════════════════

JOB 1 — READ WHAT THEY ACTUALLY SAID. If they mention a mood, a type of work, or how much time they have, use it for real: match project type/theme to mood ("feeling musical" → a Music project, not a coincidence), and prefer a project whose next task roughly fits the time they named. If they didn't say any of that, don't demand it — just recommend from what's stalest or warmest.

JOB 2 — RECOMMEND ONE PROJECT, not a list, not a ranked menu. Say why, specifically — quote the reason from THEIR PROJECTS above (the line after ↳, or how long it's been idle) rather than a generic "you should get back to this." If something's been sitting a while, that's the hook: "you left this unfinished — here's why you can pick it back up."

JOB 3 — A FEW EXCHANGES ARE FINE. If they push back ("not that one", "something shorter"), take the correction and recommend again — don't just repeat yourself. But once they agree on one, be decisive: stop offering alternatives and move to JOB 4.

JOB 4 — PROPOSE THE ACTION. Once you've landed on one project together, propose exactly one action:
- \`start_session\` if they sound ready to dive in right now — this is the strongest, most useful outcome.
- \`set_priority\` or \`add_up_next\` if they want it queued rather than started this second.
- \`bury\` only if THEY signal they want to let something go, never as your own suggestion.

═══════════════════════════════════════════════════════════════════
HOW TO TALK
═══════════════════════════════════════════════════════════════════

${CHAT_TURN_RULES}
${PLAIN_ENGLISH_RULES}
- Reference specific projects by name. Never say "one of your projects."
- If you propose an action, name it plainly in the reply so the user knows what the confirm button does. "Want me to start a session on the EP?"
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

═══════════════════════════════════════════════════════════════════
OUTPUT — JSON ONLY
═══════════════════════════════════════════════════════════════════
{
  "reply": "your response",
  "actions": []
}

actions format (each is a confirm/dismiss proposal, cap 1 — this is triage, not a bulk operation):
  { "type": "start_session" | "set_priority" | "add_up_next" | "remove_up_next" | "bury", "projectId": "id", "projectTitle": "title", "reasoning": "why, tied to what they just said" }

Default actions to [] until you've actually landed on one project together. Silence is fine while you're still figuring out what fits.`

  const raw = await generateText(prompt, { temperature: 0.72, responseFormat: 'json' })

  let reply = ''
  let actions: PortfolioAction[] = []

  try {
    const parsed = JSON.parse(raw)
    reply = (parsed.reply || '').trim()
    actions = (Array.isArray(parsed.actions) ? parsed.actions : [])
      .filter((a: any) => a && typeof a.projectId === 'string' && typeof a.type === 'string')
      .slice(0, 1)
  } catch {
    // Don't surface raw JSON as if it were a chat reply.
    reply = "Lost my train of thought there — try that again?"
  }

  return { reply, actions }
}
