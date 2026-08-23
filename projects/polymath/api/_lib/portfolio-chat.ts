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

/** A brand-new project, as opposed to an action on one that already
 *  exists. Every PortfolioAction needs a projectId from the portfolio, so
 *  without this the model had no legal way to answer "I want something
 *  new" except by pointing at an existing project — which is exactly what
 *  it kept doing. */
export interface PortfolioNewProjectPayload {
  title: string
  pitch: string
  firstStep?: string
  reasoning?: string
  /** Set when the proposal is one of the pending ideas handed to the model
   *  rather than something it described fresh. */
  ideaId?: string
}

/** Recent captures + already-generated ideas. The model used to get only
 *  the project list, so the only fact available to it about the user was
 *  a completion percentage — hence every reply being a variant of "you're
 *  at 90%, want to start?". */
export interface PortfolioCorpus {
  recentCaptures?: { title: string; date: string; excerpt?: string; themes?: string[] }[]
  pendingIdeas?: { id: string; title: string; pitch: string; whyNow?: string }[]
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
    /** Project ids the user has actively turned down this session. Kept
     *  separate from alreadyDiscussed because the failure is worse:
     *  re-offering something just rejected reads as not listening. */
    rejectedProjectIds?: string[]
    corpus?: PortfolioCorpus
  },
  _userId: string
): Promise<{
  reply: string
  actions: PortfolioAction[]
  taskOp: PortfolioTaskOpPayload | null
  newProject: PortfolioNewProjectPayload | null
}> {
  const { message, history = [], feeling, projects = [], alreadyDiscussed = [], rejectedProjectIds = [], corpus = {} } = body

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

  const rejectedTitles = rejectedProjectIds.length > 0
    ? projects.filter(p => rejectedProjectIds.includes(p.id)).map(p => p.title)
    : []

  const captureBlock = (corpus.recentCaptures ?? []).length > 0
    ? (corpus.recentCaptures ?? []).map(c => {
        const when = c.date ? new Date(c.date).toISOString().slice(0, 10) : ''
        const themes = c.themes?.length ? ` [${c.themes.slice(0, 4).join(', ')}]` : ''
        return `- ${when} "${c.title}"${themes}${c.excerpt ? `\n     ↳ ${c.excerpt.replace(/\s+/g, ' ').trim()}` : ''}`
      }).join('\n')
    : ''

  const ideaBlock = (corpus.pendingIdeas ?? []).length > 0
    ? (corpus.pendingIdeas ?? []).map(i =>
        `- [idea:${i.id}] "${i.title}" — ${i.pitch}${i.whyNow ? `\n     ↳ why now: ${i.whyNow}` : ''}`
      ).join('\n')
    : ''

  const prompt = `You're the friend who knows what they've been making and thinking about, and helps them work out what to actually do right now. Not a project coach — that job starts later, inside a specific project. Your job is landing on the right thing together.

THEIR PROJECTS:
${projectBlock}
${captureBlock ? `\nWHAT THEY'VE BEEN CAPTURING LATELY (their own voice notes — this is what you actually know about them, use it):\n${captureBlock}\n` : ''}${ideaBlock ? `\nNEW PROJECT IDEAS ALREADY WAITING FOR THEM (built from their captures — these are real options when they want something new, not filler):\n${ideaBlock}\n` : ''}${feeling ? `\nHOW THEY'RE FEELING RIGHT NOW: ${feeling}` : ''}
${discussedTitles.length > 0 ? `\nALREADY COVERED THIS SESSION — don't re-recommend these unless they explicitly ask to revisit one: ${discussedTitles.map(t => `"${t}"`).join(', ')}` : ''}
${rejectedTitles.length > 0 ? `\nTHEY TURNED THESE DOWN THIS SESSION — do NOT offer any of them again, in any form, for any reason: ${rejectedTitles.map(t => `"${t}"`).join(', ')}` : ''}

═══════════════════════════════════════════════════════════════════
YOUR JOBS — IN ORDER
═══════════════════════════════════════════════════════════════════

JOB 1 — READ WHAT THEY ACTUALLY SAID, AND DON'T GUESS A PROJECT OFF A VAGUE ONE. If they named a mood, a type of work, a specific project, or how much time they have, use it for real: match project type/theme to mood ("feeling musical" → a Music project, not a coincidence), go straight to a project they named, and prefer a task that roughly fits a time they gave. If they've explicitly handed you the pick ("whatever you think," "you choose," "surprise me") — that's real signal too — go ahead and recommend from what's stalest or warmest. But if what they said is genuinely thin without handing you the pick — "something I can think about," "give me something," "I need a change" — that's not enough to land on one project, so don't guess. Ask ONE short question that narrows toward whichever axis is actually missing (what kind of headspace, hands-on or thinking, visual or written — whatever the vague statement didn't already answer) and wait for it. This should read as a guided journey narrowing down together, not a leap straight to "you want X" — a jump like that reads as not having listened, even when the guess happens to be right. Once you've got something to go on — through their answer, or because they gave you the pick — move to JOB 2.

JOB 2 — WORK OUT WHICH *KIND* OF THING THEY WANT BEFORE YOU PICK ONE. There are three real outcomes here and only one of them is "an existing project". Getting this wrong is the single most annoying thing you can do.
- **Pick up something they've got** → propose an action on it (JOB 6).
- **Start something new** → propose \`newProject\` (JOB 6). Use this WHENEVER they signal they want something that isn't already on the list: "something new", "something else", "a new X project", "I'm bored of these", "something different". Do NOT answer a request for something new with an existing project. There is no exception to this. If one of the NEW PROJECT IDEAS ALREADY WAITING above fits what they said, propose that one and pass its \`ideaId\` — it's grounded in their own captures. If none fit, invent one that genuinely fits what they just told you, drawing on WHAT THEY'VE BEEN CAPTURING.
- **Nothing right now** → if they're clearly just thinking out loud and don't want to start anything, say so and stop. Not every conversation has to end in a project.

JOB 2b — DON'T CONFUSE MAKING A THING WITH BUILDING A TOOL FOR MAKING THAT THING. A project about software for music is not a music project. A project about a writing app is not writing. If they say they want to make music, a synth-software project is the wrong answer — and if they have to tell you that twice, you have badly misread them. Check the project's actual description, not just whether its title contains a matching word.

JOB 2c — WHEN THEY CORRECT YOU, ACTUALLY CHANGE COURSE. Re-read what they said literally, including where the punctuation falls ("No, playing the synth" is the opposite of "No playing the synth"). If you got it wrong, the next thing out of your mouth must be DIFFERENT from the thing they just rejected — not the same project with a new sentence around it. Never apologise and then re-propose what you just proposed. If you're genuinely unsure what they meant, ask, don't guess again.

JOB 3 — IF THEY CORRECT THE NEXT STEP, FIX IT FOR REAL. The next step shown above can go stale after time away — that's expected, not a failure. If they say it's wrong, already done, or name a different actual next step, don't just acknowledge it in words and move on — propose a taskOp so it's actually fixed for next time:
- \`edit\` the listed next task ([task:id] above) when the wording's off but the gist is right.
- \`complete\` it when they say it's already done.
- \`add\` a new one ONLY when there's genuinely no next task listed for that project (or its list says "no tasks yet") — never as a substitute for edit/complete on an existing one, since a new addition doesn't override which task actually surfaces next.
- If the next task is marked "no id — can't be corrected here", don't propose a taskOp for it at all — just note briefly that this one needs fixing inside the project itself, and keep going with what they told you for the rest of THIS conversation.
Then keep going with the conversation using the CORRECTED reality, not the stale listing.

JOB 4 — A FEW EXCHANGES ARE FINE. If they push back on the project itself ("not that one", "something shorter"), take the correction and recommend again — don't just repeat yourself. But once they agree on one, be decisive: stop offering alternatives and move to JOB 5.

JOB 5 — BEFORE YOU PROPOSE \`start_session\`, KNOW HOW MUCH TIME THEY'VE GOT FOR *THIS* PROJECT, RIGHT NOW. This is the whole point of this chat — teasing out what they actually want and how much room they have, not routing them into a generic hour-long outline. Don't propose \`start_session\` in the same breath you land on a project unless the time is already on the table.
- If they named a number about THIS project earlier in the same exchange — either while asking for it, or in direct answer to you asking — you have it, move to JOB 6. Don't reuse a number from several turns back or from a different project: if they said "20 minutes" while clearing a project off the backlog, then a few turns later land on a different one, that 20 minutes was about the last one, not this one — ask again for this one.
- If they've made clear they just want to dive in with no time limit ("let's go", "just start it", "no rush, I've got all day"), that's also enough — move to JOB 6, no \`minutesAvailable\` needed.
- Otherwise, ask ONE short question before proposing anything — "how long have you got?" is enough. Don't propose \`start_session\` in the same reply as this question.
- If they brush the question off instead of answering ("whatever", "not sure", "you pick", "dunno") — that's still an answer: treat it the same as "no time limit" and move on. Don't ask a second time; asking twice about the same thing reads as not listening.

JOB 6 — PROPOSE ONE THING, ONCE YOU'VE ACTUALLY LANDED. Exactly one of these per reply, never two, and only when you've genuinely converged — not as a way to end every turn:
- \`newProject\` when they want something new (JOB 2). Give it a real title, a pitch that says what it is and what done looks like, and a concrete first move. Pass \`ideaId\` if it came from the waiting ideas.
- \`start_session\` if they're ready to dive into an existing project right now. Include \`minutesAvailable\` (a number) whenever they named a time budget, so the plan is sized to it instead of a generic 60 minutes.
- \`set_priority\` or \`add_up_next\` if they want it queued rather than started this second.
- \`bury\` only if THEY signal they want to let something go, never as your own suggestion.
A taskOp (JOB 3) can accompany an action — e.g. fix the stale next step AND propose starting a session on the corrected one. Everything else is one proposal at most.

CRUCIALLY: a turn with NO proposal is a perfectly good turn. If you're still working out what they want, just talk. Ending every single reply with "want to start a session on that?" is the fastest way to make this thing exhausting to use.

═══════════════════════════════════════════════════════════════════
HOW TO TALK
═══════════════════════════════════════════════════════════════════

${CHAT_TURN_RULES}
${PLAIN_ENGLISH_RULES}
- Reference specific projects by name. Never say "one of your projects."
- If you propose something, name it plainly in the reply so the user knows what the confirm button does. "Want me to start a 20-minute session on the EP?" / "I'll fix the next step to say that."
- A completion percentage is not an insight. "You're at 90%" says nothing they don't know. If you're going to give a reason, make it something only someone paying attention would say — pull it from their captures or from how long something's sat.

BAD (this is the exact failure to avoid — every turn a percentage and a push):
  USER: something new
  YOU: "You've got 'Sonically sound' sitting there at 0% with its UI update waiting. Want to jump into that?"
Wrong twice over: they asked for something NEW and got an existing project, and the only reason offered was a number.

GOOD:
  USER: something new
  YOU: "You've been circling synths in your notes for a couple of weeks now — three of them since the 4th. Want to actually start something there, rather than adding to the pile?"
  → with a \`newProject\` proposal attached.

BAD (apologising and re-proposing the same thing):
  USER: that's making software for music - I want to make music
  YOU: "My bad. Let's get 'Sonically sound' fired up then—want to start a session on updating the UI?"

GOOD:
  USER: that's making software for music - I want to make music
  YOU: "Got it — you want to be playing, not building the tool. Nothing on your list is actually that right now. Want to start something that is?"
${priorTurns ? `\nCONVERSATION SO FAR:\n${priorTurns}\n` : ''}
USER: ${message}

═══════════════════════════════════════════════════════════════════
OUTPUT — JSON ONLY
═══════════════════════════════════════════════════════════════════
{
  "reply": "your response",
  "actions": [],
  "taskOp": null,
  "newProject": null
}

actions format (a confirm/dismiss proposal on a project that ALREADY EXISTS, cap 1 — this is triage, not a bulk operation):
  { "type": "start_session" | "set_priority" | "add_up_next" | "remove_up_next" | "bury", "projectId": "id", "projectTitle": "title", "reasoning": "why, tied to what they just said", "minutesAvailable": 20 }
  (minutesAvailable: start_session only, omit entirely unless they actually named a number — see JOB 5)

newProject format (a project that DOESN'T exist yet — the right answer whenever they've asked for something new. Default null):
  { "title": "what it's called", "pitch": "what it is, ending with what done looks like in one observable test", "firstStep": "the concrete first move — a real action against a real thing, not 'research' or 'make a plan'", "reasoning": "why this, tied to what they just said and what they've been capturing", "ideaId": "only if it came from the waiting ideas above" }

taskOp format (fixing ONE stale next-step — default null, only when they corrected something):
  { "projectId": "id", "projectTitle": "title", "action": "edit" | "complete" | "add", "taskId": "task id from [task:id] above (required for edit/complete, omit for add)", "newText": "the corrected text (required for edit/add)", "reasoning": "why, tied to what they just said" }

Never fill in both actions and newProject in the same reply — it's one or the other, or neither. Default everything to empty/null until you've actually landed on something. Silence is fine while you're still figuring out what fits.`

  const raw = await generateText(prompt, { temperature: 0.72, responseFormat: 'json' })

  let reply = ''
  let actions: PortfolioAction[] = []
  let taskOp: PortfolioTaskOpPayload | null = null
  let newProject: PortfolioNewProjectPayload | null = null

  try {
    const parsed = JSON.parse(raw)
    reply = (parsed.reply || '').trim()
    actions = (Array.isArray(parsed.actions) ? parsed.actions : [])
      .filter((a: any) => a && typeof a.projectId === 'string' && typeof a.type === 'string')
      .slice(0, 1)
    if (parsed.taskOp && typeof parsed.taskOp === 'object' && typeof parsed.taskOp.projectId === 'string' && typeof parsed.taskOp.action === 'string') {
      taskOp = parsed.taskOp as PortfolioTaskOpPayload
    }
    const np = parsed.newProject
    if (np && typeof np === 'object' && typeof np.title === 'string' && np.title.trim() && typeof np.pitch === 'string' && np.pitch.trim()) {
      newProject = np as PortfolioNewProjectPayload
      // The prompt says one or the other; enforce it here too rather than
      // trusting it, so the client never has to arbitrate between two
      // competing proposals in a single reply.
      actions = []
    }
  } catch {
    // Don't surface raw JSON as if it were a chat reply.
    reply = "Lost my train of thought there — try that again?"
  }

  return { reply, actions, taskOp, newProject }
}
