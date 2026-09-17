/**
 * The session brief — the opening message on a project you're catching up
 * with, not just opening.
 *
 * Time passes between visits and the project doesn't wait for you: a task
 * gets finished from The Path directly, a thought gets captured on a walk
 * that turns out to be about this exact thing, the description changes.
 * The greeting has to read as aware of what actually happened, or it reads
 * as a canned "welcome back" that could have been written the day the
 * project was created.
 *
 * What used to happen: the greeting was built from the task list alone,
 * and a second, unrelated system ran a raw corpus-wide embedding search
 * (title + description against everything captured in the last week, at a
 * bare 0.42 cosine floor) and showed whatever it found as a separate badge
 * underneath. Two problems, not one:
 *
 *   - 0.42 with no margin over the runner-up is exactly the kind of
 *     absolute similarity floor CLAUDE.md already found broken twice in
 *     this vector space (ATTACH_SIM_THRESHOLD, ORBIT_FLOOR) -- it doesn't
 *     discriminate a real connection from a coincidence, and it wasn't
 *     even scoped to this project.
 *   - Even a genuinely good match landed as a disconnected line below the
 *     model's own greeting rather than something the greeting could use --
 *     two systems that had never read each other's output, sitting in the
 *     same card.
 *
 * `fragments` is the app's own answer to "did this connect to the
 * project" (see fragments.ts's ATTACH_MARGIN) -- a capture only lands there
 * once it's already cleared that bar against every other project. So a
 * capture attached to THIS project since the last real session is real
 * evidence, not a guess, and it's handed to the same model call that
 * writes the greeting so it can be woven into one message instead of
 * bolted on as a second one. No embedding call, no threshold to get wrong
 * -- the grounding already happened at capture time.
 */

import { CHAT_TURN_RULES, PLAIN_ENGLISH_RULES } from './plain-english.js'

export type SessionBriefPhase = 'shaping' | 'building' | 'closing' | 'stale' | 'fresh'

export interface SessionBriefTask {
  id: string
  text: string
  done: boolean
  order: number
  task_type?: 'ignition' | 'core' | 'shutdown'
  completed_at?: string
  estimated_minutes?: number
}

/** A capture attached to this project (fragments.ts) since the project was
 *  last actually worked on -- real evidence of what changed, not a guess. */
export interface RecentCapture {
  text: string
  when: string
}

export interface SessionBrief {
  greeting: string
  phase: SessionBriefPhase
  phaseLabel: string
  focusSuggestion: string
  proactiveQuestion: string
  momentum: 'rising' | 'steady' | 'fading' | 'cold'
  completedSinceLastVisit: string[]
  stats: {
    totalTasks: number
    completedTasks: number
    daysSinceActive: number
    progressPercent: number
  }
}

export const SESSION_BRIEF_PHASE_LABELS: Record<SessionBriefPhase, string> = {
  shaping: 'Shaping',
  building: 'Building',
  closing: 'Home Stretch',
  stale: 'Picking Back Up',
  fresh: 'Just Started',
}

export function detectSessionBriefPhase(
  tasks: SessionBriefTask[],
  daysSinceActive: number,
  projectAge: number,
): SessionBriefPhase {
  const total = tasks.length
  const done = tasks.filter(t => t.done).length
  const progress = total > 0 ? done / total : 0
  // An empty list is the only "shaping" state now. A project used to be
  // called unshaped for having no finish line, which described most
  // ongoing crafts and made the app open by telling them so.
  if (total === 0) return 'shaping'
  if (daysSinceActive >= 14) return 'stale'
  if (projectAge <= 3) return 'fresh'
  if (progress >= 0.75 && total >= 3) return 'closing'
  return 'building'
}

export function detectSessionBriefMomentum(
  daysSinceActive: number,
  recentCompletions: number,
): SessionBrief['momentum'] {
  if (daysSinceActive >= 14) return 'cold'
  if (daysSinceActive >= 7) return 'fading'
  if (recentCompletions >= 2 && daysSinceActive <= 2) return 'rising'
  return 'steady'
}

export interface SessionBriefPromptInput {
  title: string
  description?: string | null
  motivation?: string | null
  endGoal?: string | null
  phase: SessionBriefPhase
  momentum: SessionBrief['momentum']
  daysSinceActive: number
  completedTasks: number
  totalTasks: number
  progressPercent: number
  incompleteTasks: { text: string; task_type?: string }[]
  recentCompletionTexts: string[]
  /** Captures attached to this project since it was last worked on. Real,
   *  grounded evidence -- the model may use it, but only if it actually
   *  bears on what comes next. */
  recentCaptures: RecentCapture[]
}

function taskSummary(incompleteTasks: { text: string; task_type?: string }[]): string {
  if (incompleteTasks.length === 0) return 'No tasks defined yet.'
  return `UPCOMING TASKS:\n${incompleteTasks
    .slice(0, 6)
    .map((t, i) => `${i + 1}. ${t.text}${t.task_type ? ` [${t.task_type}]` : ''}`)
    .join('\n')}`
}

function completionSummary(recentCompletionTexts: string[]): string {
  if (recentCompletionTexts.length === 0) return ''
  return `RECENTLY COMPLETED (last 7 days):\n${recentCompletionTexts.map(t => `✓ ${t}`).join('\n')}`
}

/** Empty when nothing was captured since the last session -- silence is
 *  the honest answer most of the time, and an empty section is cheaper
 *  than a conditional the model has to reason about. */
function capturesSummary(recentCaptures: RecentCapture[]): string {
  if (recentCaptures.length === 0) return ''
  return `NEW SINCE YOUR LAST SESSION ON THIS PROJECT:
${recentCaptures.map(c => `- (${c.when}) "${c.text}"`).join('\n')}

Only mention one of these if it actually changes what they'd work on next -- a real correction, a new constraint, something that makes the current plan wrong. If none of them do, ignore this section completely. Do not force a connection that isn't there just because something was captured.`
}

export function buildSessionBriefPrompt(input: SessionBriefPromptInput): string {
  const {
    title, description, motivation, endGoal, phase, momentum, daysSinceActive,
    completedTasks, totalTasks, progressPercent, incompleteTasks, recentCompletionTexts,
    recentCaptures,
  } = input
  const hasGoal = !!endGoal
  const hasTasks = totalTasks > 0

  const stateInstructions = !hasTasks
    ? `NOTHING ON THE LIST YET.
- greeting: Say that plainly in one line, and name what this project is, so the next line has something to hang off.
- focusSuggestion: Name the single most obvious first move, from what they've said about it.
- proactiveQuestion: "What's the first thing that has to exist for ${title}?"
Do NOT ask what done looks like. Plenty of real projects are ongoing and have no "done" — asking makes them invent one.
`
    : phase === 'stale'
    ? `THEY'VE BEEN AWAY FOR ${daysSinceActive} DAYS.
- greeting: Acknowledge the gap honestly and name the next step on the list, so picking it up is one decision, not two.
- focusSuggestion: One tiny concrete thing — not "get back into it" but e.g. "Open the file and read the last paragraph you wrote."
- proactiveQuestion: "What's the next step on [specific next task]?" -- about the work, not about them.
`
    : phase === 'closing'
    ? `HOME STRETCH — ${progressPercent}% of the current list done.
- greeting: Name what's left on the list.
- focusSuggestion: Name the specific remaining task most likely to close this out.
- proactiveQuestion: "What's the last thing on this list you'd want out of the way?"
`
    : `BUILDING — steps in flight.
- greeting: Reference what they last did or the next step by name.
- focusSuggestion: Name the specific step to do this session.
- proactiveQuestion: ONE practical question about the WORK. Examples: "Does [next task] still need doing, or has it moved on?" / "Is [next task] one sitting, or does it need splitting?" Never ask whether they're avoiding, resisting or putting something off -- you cannot see that, and guessing at it reads as an accusation.
`

  return `You are the finish-line coach for the project "${title}". Write the opening message someone sees when they open this project. Your job is to move them closer to DONE.

PROJECT: ${title}
${description ? `DESCRIPTION: ${description}` : ''}
${motivation ? `WHY: ${motivation}` : ''}
${endGoal ? `DONE LOOKS LIKE: ${endGoal}` : 'DONE: not stated — may be an ongoing thing, which is fine'}

PHASE: ${phase} (${SESSION_BRIEF_PHASE_LABELS[phase]})
MOMENTUM: ${momentum}
DAYS SINCE LAST VISIT: ${daysSinceActive}
PROGRESS: ${completedTasks}/${totalTasks} tasks (${progressPercent}%)

${taskSummary(incompleteTasks)}
${completionSummary(recentCompletionTexts)}
${capturesSummary(recentCaptures)}

═══════════════════════════════════════════════════════════════════
STATE-SPECIFIC INSTRUCTIONS — follow exactly
═══════════════════════════════════════════════════════════════════

${stateInstructions}

Rules for ALL states:
${CHAT_TURN_RULES}
${PLAIN_ENGLISH_RULES}
- No filler. No "Great to see you", "Welcome back", "Let's dive in", "Let's explore", "Time to kick off".
- Short sentences. Say it straight. Second person ("you").
- Always reference specific steps by name. Never be vague.
- Never ask what done looks like${hasGoal ? '' : ' — this project may be an ongoing thing with no end, and that is fine'}.
- Don't stack questions with "and".

Return JSON only:
{
  "greeting": "your opening line",
  "focusSuggestion": "your one-sentence focus suggestion",
  "proactiveQuestion": "your one question"
}`
}

export interface ParsedSessionBriefFallback {
  firstIncompleteTaskText: string | null
  title: string
}

/** Never let a malformed model response take the greeting down -- the
 *  fallback still says something concrete rather than a generic apology. */
export function parseSessionBriefResponse(
  raw: string,
  fallback: ParsedSessionBriefFallback,
): { greeting: string; focusSuggestion: string; proactiveQuestion: string } {
  try {
    const parsed = JSON.parse(raw)
    const greeting = typeof parsed.greeting === 'string' ? parsed.greeting.trim() : ''
    const focusSuggestion = typeof parsed.focusSuggestion === 'string' ? parsed.focusSuggestion.trim() : ''
    const proactiveQuestion = typeof parsed.proactiveQuestion === 'string' ? parsed.proactiveQuestion.trim() : ''
    if (greeting) return { greeting, focusSuggestion, proactiveQuestion }
  } catch {}

  return {
    greeting: 'Ready to pick up where you left off.',
    focusSuggestion: fallback.firstIncompleteTaskText || 'Say what the first move is and it will plan from there.',
    proactiveQuestion: fallback.firstIncompleteTaskText
      ? 'What would you work on if you had 30 minutes right now?'
      : `What's the first thing that has to exist for ${fallback.title}?`,
  }
}
