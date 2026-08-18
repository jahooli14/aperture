/**
 * Portfolio-level triage — "what should I work on, across everything I've
 * got going" — as distinct from project-chat, which only operates inside
 * one already-chosen project. Its main job is which project (and what to
 * do about it right now) — it does NOT curate a project's full task list
 * (that stays project-chat's job). The one exception: when the user
 * corrects what's actually next for a project — the listed next step is
 * wrong, already done, or missing entirely — it can fix that one task so
 * the recommendation isn't working off stale data next time.
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
  nextTaskId?: string
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
  /** Minutes they said they've got — start_session only. Sizes the actual
   *  session plan instead of defaulting to a generic 60 minutes. */
  minutesAvailable?: number
}

/** Deliberately narrower than project-chat's full taskOps (no delete /
 *  uncomplete) — this exists to fix ONE stale next-step, not to curate a
 *  task list. edit = wording's wrong, complete = it's actually already
 *  done, add = the real next step isn't listed at all. */
export interface PortfolioTaskOpPayload {
  projectId: string
  projectTitle: string
  action: 'edit' | 'complete' | 'add'
  taskId?: string
  newText?: string
  reasoning?: string
}

export async function handlePortfolioChat(
  body: {
    message: string
    history?: ConversationMessage[]
    feeling?: string | null
    projects: PortfolioProjectSummary[]
    /** Project ids already recommended/corrected this session — lets a
     *  long "keep going" sweep stay correct without needing the full
     *  conversation history (which is capped client-side for cost). */
    alreadyDiscussed?: string[]
  },
  _userId: string
): Promise<{ reply: string; actions: PortfolioAction[]; taskOp: PortfolioTaskOpPayload | null }> {
  const { message, history = [], feeling, projects = [], alreadyDiscussed = [] } = body

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
        // Only offer a [task:id] reference when there's a real id to give —
        // legacy/malformed task data can have text without one. Without
        // this a model could echo taskId:"undefined", which would pass
        // validation as a truthy string and only fail later with a
        // confusing error instead of the taskOp simply never being offered.
        // "add" can't stand in for edit/complete here: it appends to the
        // end of the list, and the next task is whichever undone one sorts
        // first by order — so an id-less broken task just keeps winning
        // forever regardless. Say so plainly rather than implying add fixes it.
        const nextPart = p.nextTaskText
          ? p.nextTaskId
            ? ` — next: [task:${p.nextTaskId}] "${p.nextTaskText}"${p.nextTaskMinutes ? ` (~${p.nextTaskMinutes}m)` : ''}`
            : ` — next: "${p.nextTaskText}"${p.nextTaskMinutes ? ` (~${p.nextTaskMinutes}m)` : ''} (no id — this one can't be corrected here, it needs the project's own task list)`
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

  const discussedTitles = alreadyDiscussed.length > 0
    ? projects.filter(p => alreadyDiscussed.includes(p.id)).map(p => p.title)
    : []

  const prompt = `You're the friend who knows everything they've got going and helps them pick what to work on right now. Not a project coach — that's a different job, and it only starts once they're inside a specific project. Your only job here is choosing the next thing, and helping them start it.

THEIR PROJECTS:
${projectBlock}
${feeling ? `\nHOW THEY'RE FEELING RIGHT NOW: ${feeling}` : ''}
${discussedTitles.length > 0 ? `\nALREADY COVERED THIS SESSION — don't re-recommend these unless they explicitly ask to revisit one: ${discussedTitles.map(t => `"${t}"`).join(', ')}` : ''}

═══════════════════════════════════════════════════════════════════
YOUR JOBS — IN ORDER
═══════════════════════════════════════════════════════════════════

JOB 1 — READ WHAT THEY ACTUALLY SAID. If they mention a mood, a type of work, or how much time they have, use it for real: match project type/theme to mood ("feeling musical" → a Music project, not a coincidence), and prefer a project whose next task roughly fits the time they named. If they didn't say any of that, don't demand it — just recommend from what's stalest or warmest.

JOB 2 — RECOMMEND ONE PROJECT, not a list, not a ranked menu. Say why, specifically — quote the reason from THEIR PROJECTS above (the line after ↳, or how long it's been idle) rather than a generic "you should get back to this." If something's been sitting a while, that's the hook: "you left this unfinished — here's why you can pick it back up." When they ask what else needs attention (they're clearing a backlog, working through several projects in a row) — don't recap or re-explain, just move straight to the next stalest/most relevant one. THEIR PROJECTS above already reflects whatever got resolved a moment ago, so trust it.

JOB 3 — IF THEY CORRECT THE NEXT STEP, FIX IT FOR REAL. The next step shown above can go stale after time away — that's expected, not a failure. If they say it's wrong, already done, or name a different actual next step, don't just acknowledge it in words and move on — propose a taskOp so it's actually fixed for next time:
- \`edit\` the listed next task ([task:id] above) when the wording's off but the gist is right.
- \`complete\` it when they say it's already done.
- \`add\` a new one ONLY when there's genuinely no next task listed for that project (or its list says "no tasks yet") — never as a substitute for edit/complete on an existing one, since a new addition doesn't override which task actually surfaces next.
- If the next task is marked "no id — can't be corrected here", don't propose a taskOp for it at all — just note briefly that this one needs fixing inside the project itself, and keep going with what they told you for the rest of THIS conversation.
Then keep going with the conversation using the CORRECTED reality, not the stale listing.

JOB 4 — A FEW EXCHANGES ARE FINE. If they push back on the project itself ("not that one", "something shorter"), take the correction and recommend again — don't just repeat yourself. But once they agree on one, be decisive: stop offering alternatives and move to JOB 5.

JOB 5 — BEFORE YOU PROPOSE \`start_session\`, KNOW HOW MUCH TIME THEY'VE GOT. This is the whole point of this chat — teasing out what they actually want and how much room they have, not routing them into a generic hour-long outline. Don't propose \`start_session\` in the same breath you land on a project unless the time is already on the table. Check CONVERSATION SO FAR and this message first:
- If they've already named a number anywhere in this exchange ("20 minutes", "half an hour", "got an hour"), you have it — move to JOB 6.
- If they've made clear they just want to dive in with no time limit ("let's go", "just start it", "no rush, I've got all day"), that's also enough — move to JOB 6, no \`minutesAvailable\` needed.
- Otherwise, ask ONE short question before proposing anything — "how long have you got?" is enough. Don't propose \`start_session\` in the same reply as this question.

JOB 6 — PROPOSE THE ACTION. Once you've landed on one project together (and, for \`start_session\`, you know the time situation per JOB 5), propose exactly one action:
- \`start_session\` if they're ready to dive in right now — this is the strongest, most useful outcome. Include \`minutesAvailable\` (a number) whenever they named a time budget, so the plan is actually sized to it instead of a generic 60 minutes.
- \`set_priority\` or \`add_up_next\` if they want it queued rather than started this second.
- \`bury\` only if THEY signal they want to let something go, never as your own suggestion.
A taskOp (JOB 3) and an action (JOB 6) can both happen in the same reply — e.g. fix the stale next step AND propose starting a session on the corrected one.

═══════════════════════════════════════════════════════════════════
HOW TO TALK
═══════════════════════════════════════════════════════════════════

${CHAT_TURN_RULES}
${PLAIN_ENGLISH_RULES}
- Reference specific projects by name. Never say "one of your projects."
- If you propose an action or a taskOp, name it plainly in the reply so the user knows what the confirm button does. "Want me to start a 20-minute session on the EP?" / "I'll fix the next step to say that."
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

═══════════════════════════════════════════════════════════════════
OUTPUT — JSON ONLY
═══════════════════════════════════════════════════════════════════
{
  "reply": "your response",
  "actions": [],
  "taskOp": null
}

actions format (each is a confirm/dismiss proposal, cap 1 — this is triage, not a bulk operation):
  { "type": "start_session" | "set_priority" | "add_up_next" | "remove_up_next" | "bury", "projectId": "id", "projectTitle": "title", "reasoning": "why, tied to what they just said", "minutesAvailable": 20 }
  (minutesAvailable: start_session only, omit entirely unless they actually named a number — see JOB 5)

taskOp format (fixing ONE stale next-step — default null, only when they corrected something):
  { "projectId": "id", "projectTitle": "title", "action": "edit" | "complete" | "add", "taskId": "task id from [task:id] above (required for edit/complete, omit for add)", "newText": "the corrected text (required for edit/add)", "reasoning": "why, tied to what they just said" }

Default actions to [] and taskOp to null until you've actually landed on something. Silence is fine while you're still figuring out what fits.`

  const raw = await generateText(prompt, { temperature: 0.72, responseFormat: 'json' })

  let reply = ''
  let actions: PortfolioAction[] = []
  let taskOp: PortfolioTaskOpPayload | null = null

  try {
    const parsed = JSON.parse(raw)
    reply = (parsed.reply || '').trim()
    actions = (Array.isArray(parsed.actions) ? parsed.actions : [])
      .filter((a: any) => a && typeof a.projectId === 'string' && typeof a.type === 'string')
      .slice(0, 1)
    if (parsed.taskOp && typeof parsed.taskOp === 'object' && typeof parsed.taskOp.projectId === 'string' && typeof parsed.taskOp.action === 'string') {
      taskOp = parsed.taskOp as PortfolioTaskOpPayload
    }
  } catch {
    // Don't surface raw JSON as if it were a chat reply.
    reply = "Lost my train of thought there — try that again?"
  }

  return { reply, actions, taskOp }
}
