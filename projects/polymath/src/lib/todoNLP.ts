/**
 * Todo NLP Parser
 *
 * Parses natural language todo input à la Things 3 / Todoist.
 *
 * Supported syntax:
 *   - Dates:     today, tomorrow, next monday, in 3 days, monday, fri
 *   - Priority:  !high, !medium, !low, !1, !2, !3, !p1, !p2, !p3
 *   - Tags:      #tag, #multi-word-tag
 *   - Area:      @area, @work, @home
 *   - Time est:  30min, 1h, 2h, 15m
 *   - Someday:   someday, maybe, later
 */

export interface ParsedTodo {
  text: string              // Cleaned text with NLP tokens stripped
  scheduledDate?: string   // YYYY-MM-DD
  deadlineDate?: string    // YYYY-MM-DD (if preceded by "deadline:" or "due:")
  priority: number         // 0=none, 1=low, 2=med, 3=high
  tags: string[]
  areaName?: string        // Parsed @area name (lowercase)
  estimatedMinutes?: number
  isSomeday: boolean
}

// ─── Date helpers ───────────────────────────────────────────

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0]
}

function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Next occurrence of a weekday (0=Sun…6=Sat). If today is that day, returns next week. */
function nextWeekday(targetDay: number, fromNext = false): Date {
  const base = today()
  const diff = (targetDay - base.getDay() + 7) % 7
  return addDays(base, diff === 0 ? 7 : fromNext ? diff + 7 : diff)
}

// ─── Parser ─────────────────────────────────────────────────

export function parseTodo(raw: string): ParsedTodo {
  let input = raw
  let scheduledDate: string | undefined
  let deadlineDate: string | undefined
  let priority = 0
  const tags: string[] = []
  let areaName: string | undefined
  let estimatedMinutes: number | undefined
  let isSomeday = false

  // ── Someday keywords ──
  const somedayRe = /\b(someday|maybe|later)\b/i
  if (somedayRe.test(input)) {
    isSomeday = true
    input = input.replace(somedayRe, '').trim()
  }

  // ── Deadline date: "due:friday" or "deadline:next week" ──
  const deadlineRe = /\b(?:due|deadline):(\S+(?:\s+\S+)?)/i
  const deadlineMatch = input.match(deadlineRe)
  if (deadlineMatch) {
    deadlineDate = parseDate(deadlineMatch[1])
    input = input.replace(deadlineMatch[0], '').trim()
  }

  // ── Scheduled date tokens ──
  // "in N days/weeks"
  const inNDaysRe = /\bin\s+(\d+)\s+(days?|weeks?)\b/i
  const inNMatch = input.match(inNDaysRe)
  if (inNMatch) {
    const n = parseInt(inNMatch[1])
    const unit = inNMatch[2].toLowerCase()
    scheduledDate = toYMD(addDays(today(), unit.startsWith('week') ? n * 7 : n))
    input = input.replace(inNMatch[0], '').trim()
  }

  // "next <weekday>" or "next week"
  if (!scheduledDate) {
    const nextRe = /\bnext\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i
    const nextMatch = input.match(nextRe)
    if (nextMatch) {
      const token = nextMatch[1].toLowerCase()
      if (token === 'week') {
        scheduledDate = toYMD(addDays(today(), 7))
      } else if (DAY_NAMES[token] !== undefined) {
        scheduledDate = toYMD(nextWeekday(DAY_NAMES[token], true))
      }
      input = input.replace(nextMatch[0], '').trim()
    }
  }

  // "this <weekday>"
  if (!scheduledDate) {
    const thisRe = /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i
    const thisMatch = input.match(thisRe)
    if (thisMatch) {
      const token = thisMatch[1].toLowerCase()
      if (DAY_NAMES[token] !== undefined) {
        scheduledDate = toYMD(nextWeekday(DAY_NAMES[token], false))
      }
      input = input.replace(thisMatch[0], '').trim()
    }
  }

  // Bare weekday name e.g. "monday", "fri"
  if (!scheduledDate) {
    const dayRe = new RegExp(`\\b(${Object.keys(DAY_NAMES).join('|')})\\b`, 'i')
    const dayMatch = input.match(dayRe)
    if (dayMatch) {
      const token = dayMatch[1].toLowerCase()
      scheduledDate = toYMD(nextWeekday(DAY_NAMES[token], false))
      input = input.replace(dayMatch[0], '').trim()
    }
  }

  // "today" / "tomorrow"
  if (!scheduledDate) {
    if (/\btoday\b/i.test(input)) {
      scheduledDate = toYMD(today())
      input = input.replace(/\btoday\b/i, '').trim()
    } else if (/\btomorrow\b/i.test(input)) {
      scheduledDate = toYMD(addDays(today(), 1))
      input = input.replace(/\btomorrow\b/i, '').trim()
    }
  }

  // ── Priority: !high !medium !low !1 !2 !3 !p1 !p2 !p3 ──
  const priorityRe = /!(high|h|medium|med|m|low|l|p?[123])\b/i
  const prioMatch = input.match(priorityRe)
  if (prioMatch) {
    const p = prioMatch[1].toLowerCase().replace('p', '')
    if (p === 'high' || p === 'h' || p === '1') priority = 3
    else if (p === 'medium' || p === 'med' || p === 'm' || p === '2') priority = 2
    else if (p === 'low' || p === 'l' || p === '3') priority = 1
    input = input.replace(prioMatch[0], '').trim()
  }

  // ── Tags: #tag (allow hyphens/underscores, no spaces) ──
  const tagRe = /#([\w-]+)/g
  let tagMatch
  while ((tagMatch = tagRe.exec(input)) !== null) {
    tags.push(tagMatch[1].toLowerCase())
  }
  input = input.replace(/#[\w-]+/g, '').trim()

  // ── Area: @area ──
  const areaRe = /@([\w-]+)/
  const areaMatch = input.match(areaRe)
  if (areaMatch) {
    areaName = areaMatch[1].toLowerCase()
    input = input.replace(areaMatch[0], '').trim()
  }

  // ── Time estimate: 30min, 1h, 2h, 15m ──
  const timeRe = /\b(\d+)\s*(min(?:utes?)?|h(?:ours?)?)\b/i
  const timeMatch = input.match(timeRe)
  if (timeMatch) {
    const n = parseInt(timeMatch[1])
    const unit = timeMatch[2].toLowerCase()
    estimatedMinutes = unit.startsWith('h') ? n * 60 : n
    input = input.replace(timeMatch[0], '').trim()
  }

  // Clean up extra spaces / punctuation at end
  const text = input.replace(/\s{2,}/g, ' ').replace(/[,;.]+$/, '').trim()

  return {
    text,
    scheduledDate: isSomeday ? undefined : scheduledDate,
    deadlineDate,
    priority,
    tags,
    areaName,
    estimatedMinutes,
    isSomeday,
  }
}

/** Parse a date string token into YYYY-MM-DD. Returns undefined if not parseable. */
function parseDate(token: string): string | undefined {
  const t = token.toLowerCase().trim()
  if (t === 'today') return toYMD(today())
  if (t === 'tomorrow') return toYMD(addDays(today(), 1))
  if (t === 'next week') return toYMD(addDays(today(), 7))
  if (DAY_NAMES[t] !== undefined) return toYMD(nextWeekday(DAY_NAMES[t]))
  // Try native Date parse as last resort
  const d = new Date(token)
  if (!isNaN(d.getTime())) return toYMD(d)
  return undefined
}

// ─── Human-readable description of parsed date ───────────────

export function describeDate(ymd: string): string {
  const t = today()
  const d = new Date(ymd + 'T00:00:00')
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 6) {
    return d.toLocaleDateString('en-GB', { weekday: 'long' })
  }
  if (diff > 6 && diff <= 13) {
    return 'Next ' + d.toLocaleDateString('en-GB', { weekday: 'long' })
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

export const PRIORITY_COLORS: Record<number, string> = {
  0: 'text-white/30',
  1: 'text-blue-400',
  2: 'text-amber-400',
  3: 'text-red-400',
}
