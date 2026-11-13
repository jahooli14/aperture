/**
 * Words for the daily "say something" push. An offer tied to what the person
 * is already carrying (the take they haven't answered, or the live project),
 * not a bare chore. Plain English; no streaks, no "you missed".
 */

const MAX_TAKE_CHARS = 90

export interface ReminderCopy {
  title: string
  body: string
}

function shorten(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= MAX_TAKE_CHARS) return t
  const cut = t.slice(0, MAX_TAKE_CHARS)
  const space = cut.lastIndexOf(' ')
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[.,;:!?]+$/, '')}…`
}

export function voiceReminderCopy(input: { take?: string | null; project?: string | null }): ReminderCopy {
  const take = input.take?.trim()
  if (take) {
    return { title: 'Still thinking about this?', body: `“${shorten(take)}” Say what you think.` }
  }
  const project = input.project?.trim()
  if (project) {
    return { title: `Where are you with ${project}?`, body: 'Say it out loud — tomorrow’s take can use it.' }
  }
  return { title: 'What’s on your mind?', body: 'Say it out loud — tomorrow’s take can use it.' }
}
