/**
 * Todo NLP Parser
 *
 * Parses natural language todo input  la Things 3 / Todoist.
 *
 * Supported syntax:
 *   - Dates:     today/tod, tomorrow/tom/tmrw/tmr/tmrow, next monday, in 3 days,
 *                monday, fri, jan 15, 15 jan, march 5, next month, eow, eod,
 *                som (start of next month), eom (end of month)
 *   - Times:     at 3pm, at 9:30am, at noon, at midnight, at 14:00
 *                bare: 11am, 2pm, 9:30, 14:00, noon, midnight
 *                named: morning (9am), afternoon (2pm), evening (6pm), night (8pm)
 *   - Relative:  in 2h, in 30m, in 2 hours, in 45 minutes
 *   - Priority:  !high, !medium, !low, !1, !2, !3, !p1, !p2, !p3,
 *                urgent/critical  high, whenever/someday/maybe/later  low/someday
 *   - Tags:      #tag, #multi-word-tag
 *   - Area:      @area, @work, @home
 *   - Time est:  30min, 1h, 2h, 15m, 1.5h, 90m, half an hour
 *   - Someday:   someday, maybe, later, whenever
 */

export interface ParsedTodo {
  text: string              // Cleaned text with NLP tokens stripped
  scheduledDate?: string   // YYYY-MM-DD
  scheduledTime?: string   // HH:mm (24h)
  deadlineDate?: string    // YYYY-MM-DD (if preceded by "deadline:" or "due:")
  priority: number         // 0=none, 1=low, 2=med, 3=high
  tags: string[]
  areaName?: string        // Parsed @area name (lowercase)
  estimatedMinutes?: number
  isSomeday: boolean
}

//  Date helpers 

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
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

function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60 * 1000)
}

/** Next occurrence of a weekday (0=Sun6=Sat). If today is that day, returns next week. */
function nextWeekday(targetDay: number, fromNext = false): Date {
  const base = today()
  const diff = (targetDay - base.getDay() + 7) % 7
  return addDays(base, diff === 0 ? 7 : fromNext ? diff + 7 : diff)
}

/** Next Friday from today (for eow) */
function nextFriday(): Date {
  return nextWeekday(5, false)
}

/** First day of next month */
function startOfNextMonth(): Date {
  const d = today()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

/** Last day of current month */
function endOfCurrentMonth(): Date {
  const d = today()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

//  Time helpers 

/** Format hours/minutes into HH:mm */
function toHHMM(hours: number, minutes = 0): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Parse a bare time string (no leading "at") into HH:mm.
 * Handles: 11am, 2pm, 9:30, 9:30am, 14:00, noon, midnight
 * Returns undefined if the string doesn't look like a time.
 */
function parseBareTime(s: string): string | undefined {
  const t = s.trim().toLowerCase()
  if (t === 'noon') return '12:00'
  if (t === 'midnight') return '00:00'

  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!m) return undefined

  let h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2]) : 0
  const meridiem = m[3]

  if (meridiem === 'pm' && h !== 12) h += 12
  else if (meridiem === 'am' && h === 12) h = 0

  // Bare hour without meridiem: require 0-23 range
  if (!meridiem && (h < 0 || h > 23)) return undefined
  if (min < 0 || min > 59) return undefined
  // Bare hour without meridiem and no colon: only accept if it looks unambiguous
  // (i.e. has a colon for 24h, or has am/pm)  single numbers like "5" are ambiguous
  // so we require either a colon or a meridiem suffix for bare times
  if (!meridiem && !m[2]) return undefined

  return toHHMM(h, min)
}

//  Parser 

export function parseTodo(raw: string): ParsedTodo {
  let input = raw
  let scheduledDate: string | undefined
  let scheduledTime: string | undefined
  let deadlineDate: string | undefined
  let priority = 0
  const tags: string[] = []
  let areaName: string | undefined
  let estimatedMinutes: number | undefined
  let isSomeday = false

  //  Someday keywords (including "whenever") 
  const somedayRe = /\b(someday|maybe|later|whenever)\b/i
  if (somedayRe.test(input)) {
    isSomeday = true
    input = input.replace(somedayRe, '').trim()
  }

  //  Natural priority words: urgent/critical  high, low-priority  low 
  // These are parsed before the ! syntax so they don't interfere
  if (!priority) {
    const urgentRe = /\b(urgent|critical|asap)\b/i
    if (urgentRe.test(input)) {
      priority = 3
      input = input.replace(urgentRe, '').trim()
    }
  }

  //  Deadline date: "due:friday", "due:in 3 days", "deadline:next week" 
  // Capture up to 3 words but stop at NLP-special chars (!, #, @)
  const deadlineRe = /\b(?:due|deadline):((?:[^!#@\s]+\s*){1,3})/i
  const deadlineMatch = input.match(deadlineRe)
  if (deadlineMatch) {
    deadlineDate = parseDate(deadlineMatch[1])
    input = input.replace(deadlineMatch[0], '').trim()
  }

  //  Time estimate (must come BEFORE bare-time parsing to avoid conflicts) 
  // Handles: 30min, 1h, 2h, 15m, 1.5h, 90m, "half an hour", "half hour"
  const halfHourRe = /\bhalf(?:\s+an?)?\s+hour\b/i
  if (halfHourRe.test(input)) {
    estimatedMinutes = 30
    input = input.replace(halfHourRe, '').trim()
  }

  if (!estimatedMinutes) {
    // Decimal hours: 1.5h, 0.5h  must come before integer match
    const decimalHourRe = /\b(\d+\.\d+)\s*h(?:ours?)?\b/i
    const decHMatch = input.match(decimalHourRe)
    if (decHMatch) {
      estimatedMinutes = Math.round(parseFloat(decHMatch[1]) * 60)
      input = input.replace(decHMatch[0], '').trim()
    }
  }

  if (!estimatedMinutes) {
    const timeEstRe = /\b(\d+)\s*(min(?:utes?)?|h(?:ours?)?)\b/i
    const timeEstMatch = input.match(timeEstRe)
    if (timeEstMatch) {
      const n = parseInt(timeEstMatch[1])
      const unit = timeEstMatch[2].toLowerCase()
      estimatedMinutes = unit.startsWith('h') ? n * 60 : n
      input = input.replace(timeEstMatch[0], '').trim()
    }
  }

  //  "in Nh/Nm" relative time from now (e.g. "in 2h", "in 30m") 
  // Must come AFTER time estimate parsing to avoid double-matching
  const inRelTimeRe = /\bin\s+(\d+)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?)\b/i
  const inRelTimeMatch = input.match(inRelTimeRe)
  if (inRelTimeMatch && !estimatedMinutes) {
    // Only treat as schedule offset if it wasn't already consumed as an estimate
    const n = parseInt(inRelTimeMatch[1])
    const unit = inRelTimeMatch[2].toLowerCase()
    const totalMinutes = unit.startsWith('h') ? n * 60 : n
    const target = addMinutes(new Date(), totalMinutes)
    scheduledDate = toYMD(target)
    scheduledTime = toHHMM(target.getHours(), target.getMinutes())
    input = input.replace(inRelTimeMatch[0], '').trim()
  } else if (inRelTimeMatch) {
    // Already used as estimate  remove from input anyway to avoid text leak
    input = input.replace(inRelTimeMatch[0], '').trim()
  }

  //  Named time-of-day phrases (morning, afternoon, evening, night) 
  // These map to specific hours per Todoist conventions
  const namedTimeRe = /\b(morning|afternoon|evening|night)\b/i
  const namedTimeMatch = input.match(namedTimeRe)
  if (namedTimeMatch && !scheduledTime) {
    const phrase = namedTimeMatch[1].toLowerCase()
    if (phrase === 'morning') scheduledTime = '09:00'
    else if (phrase === 'afternoon') scheduledTime = '14:00'
    else if (phrase === 'evening') scheduledTime = '18:00'
    else if (phrase === 'night') scheduledTime = '20:00'
    input = input.replace(namedTimeMatch[0], '').trim()
  }

  //  Explicit time: "at 3pm", "at 9:30am", "at noon", "at midnight", "at 14:00" 
  const atTimeRe = /\bat\s+(?:(noon)|(midnight)|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/i
  const atTimeMatch = input.match(atTimeRe)
  if (atTimeMatch && !scheduledTime) {
    if (atTimeMatch[1]) {
      scheduledTime = '12:00'
    } else if (atTimeMatch[2]) {
      scheduledTime = '00:00'
    } else {
      let h = parseInt(atTimeMatch[3])
      const m = atTimeMatch[4] ? parseInt(atTimeMatch[4]) : 0
      const meridiem = atTimeMatch[5]?.toLowerCase()
      if (meridiem === 'pm' && h !== 12) h += 12
      else if (meridiem === 'am' && h === 12) h = 0
      if (h >= 0 && h <= 23) scheduledTime = toHHMM(h, m)
    }
    input = input.replace(atTimeMatch[0], '').trim()
  }

  //  Bare times (no "at"): 11am, 2pm, 9:30, 14:00, noon, midnight 
  // Must run after time estimate removal so "30min" isn't mistaken for a time
  if (!scheduledTime) {
    // noon / midnight as standalone words
    const namedAbsTimeRe = /\b(noon|midnight)\b/i
    const namedAbsMatch = input.match(namedAbsTimeRe)
    if (namedAbsMatch) {
      scheduledTime = namedAbsMatch[1].toLowerCase() === 'noon' ? '12:00' : '00:00'
      input = input.replace(namedAbsMatch[0], '').trim()
    }
  }

  if (!scheduledTime) {
    // am/pm bare time: "11am", "2:30pm", "9:30"
    // For safety, require meridiem OR colon to avoid swallowing bare numbers
    const bareTimeRe = /\b(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm)))\b/i
    const bareTimeMatch = input.match(bareTimeRe)
    if (bareTimeMatch) {
      const parsed = parseBareTime(bareTimeMatch[1])
      if (parsed) {
        scheduledTime = parsed
        input = input.replace(bareTimeMatch[0], '').trim()
      }
    }
  }

  if (!scheduledTime) {
    // 24h colon time: "14:00", "09:30"
    const colonTimeRe = /\b(\d{1,2}:\d{2})\b/
    const colonTimeMatch = input.match(colonTimeRe)
    if (colonTimeMatch) {
      const parsed = parseBareTime(colonTimeMatch[1])
      if (parsed) {
        scheduledTime = parsed
        input = input.replace(colonTimeMatch[0], '').trim()
      }
    }
  }

  //  Scheduled date tokens 

  // EOD  end of day  today at 5pm
  if (!scheduledDate) {
    if (/\beod\b/i.test(input)) {
      scheduledDate = toYMD(today())
      if (!scheduledTime) scheduledTime = '17:00'
      input = input.replace(/\beod\b/i, '').trim()
    }
  }

  // EOW  end of week  next Friday
  if (!scheduledDate) {
    if (/\beow\b/i.test(input)) {
      scheduledDate = toYMD(nextFriday())
      input = input.replace(/\beow\b/i, '').trim()
    }
  }

  // SOM  start of (next) month
  if (!scheduledDate) {
    if (/\bsom\b/i.test(input)) {
      scheduledDate = toYMD(startOfNextMonth())
      input = input.replace(/\bsom\b/i, '').trim()
    }
  }

  // EOM  end of (current) month
  if (!scheduledDate) {
    if (/\beom\b/i.test(input)) {
      scheduledDate = toYMD(endOfCurrentMonth())
      input = input.replace(/\beom\b/i, '').trim()
    }
  }

  // "in N days/weeks"
  if (!scheduledDate) {
    const inNDaysRe = /\bin\s+(\d+)\s+(days?|weeks?)\b/i
    const inNMatch = input.match(inNDaysRe)
    if (inNMatch) {
      const n = parseInt(inNMatch[1])
      const unit = inNMatch[2].toLowerCase()
      scheduledDate = toYMD(addDays(today(), unit.startsWith('week') ? n * 7 : n))
      input = input.replace(inNMatch[0], '').trim()
    }
  }

  // "next month"
  if (!scheduledDate) {
    if (/\bnext\s+month\b/i.test(input)) {
      scheduledDate = toYMD(startOfNextMonth())
      input = input.replace(/\bnext\s+month\b/i, '').trim()
    }
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

  // Month-name dates: "jan 15", "15 jan", "march 5", "5 march 2026"
  if (!scheduledDate) {
    const monthKeys = Object.keys(MONTH_NAMES).join('|')
    // "jan 15" or "january 15" (optional year)
    const monthDayRe = new RegExp(`\\b(${monthKeys})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?\\b`, 'i')
    const monthDayMatch = input.match(monthDayRe)
    if (monthDayMatch) {
      const monthIdx = MONTH_NAMES[monthDayMatch[1].toLowerCase()]
      const day = parseInt(monthDayMatch[2])
      const yearOverride = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : undefined
      scheduledDate = resolveMonthDay(monthIdx, day, yearOverride)
      input = input.replace(monthDayMatch[0], '').trim()
    }
  }

  if (!scheduledDate) {
    const monthKeys = Object.keys(MONTH_NAMES).join('|')
    // "15 jan" or "15 january" (optional year)
    const dayMonthRe = new RegExp(`\\b(\\d{1,2})\\s+(${monthKeys})(?:\\s+(\\d{4}))?\\b`, 'i')
    const dayMonthMatch = input.match(dayMonthRe)
    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1])
      const monthIdx = MONTH_NAMES[dayMonthMatch[2].toLowerCase()]
      const yearOverride = dayMonthMatch[3] ? parseInt(dayMonthMatch[3]) : undefined
      scheduledDate = resolveMonthDay(monthIdx, day, yearOverride)
      input = input.replace(dayMonthMatch[0], '').trim()
    }
  }

  // today / tomorrow and abbreviations
  if (!scheduledDate) {
    // tomorrow abbreviations first (most specific)
    if (/\b(tomorrow|tmrw|tmr|tmrow|tom)\b/i.test(input)) {
      scheduledDate = toYMD(addDays(today(), 1))
      input = input.replace(/\b(tomorrow|tmrw|tmr|tmrow|tom)\b/i, '').trim()
    } else if (/\b(today|tod)\b/i.test(input)) {
      scheduledDate = toYMD(today())
      input = input.replace(/\b(today|tod)\b/i, '').trim()
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

  //  Priority: !high !medium !low !1 !2 !3 !p1 !p2 !p3 
  if (!priority) {
    const priorityRe = /!(high|h|medium|med|m|low|l|p?[123])\b/i
    const prioMatch = input.match(priorityRe)
    if (prioMatch) {
      const p = prioMatch[1].toLowerCase().replace('p', '')
      if (p === 'high' || p === 'h' || p === '1') priority = 3
      else if (p === 'medium' || p === 'med' || p === 'm' || p === '2') priority = 2
      else if (p === 'low' || p === 'l' || p === '3') priority = 1
      input = input.replace(prioMatch[0], '').trim()
    }
  }

  //  Tags: #tag (allow hyphens/underscores, no spaces) 
  const tagRe = /#([\w-]+)/g
  let tagMatch
  while ((tagMatch = tagRe.exec(input)) !== null) {
    tags.push(tagMatch[1].toLowerCase())
  }
  input = input.replace(/#[\w-]+/g, '').trim()

  //  Area: @area 
  const areaRe = /@([\w-]+)/
  const areaMatch = input.match(areaRe)
  if (areaMatch) {
    areaName = areaMatch[1].toLowerCase()
    input = input.replace(areaMatch[0], '').trim()
  }

  // Clean up extra spaces / punctuation at end
  const text = input.replace(/\s{2,}/g, ' ').replace(/[,;.]+$/, '').trim()

  return {
    text,
    scheduledDate: isSomeday ? undefined : scheduledDate,
    scheduledTime,
    deadlineDate,
    priority,
    tags,
    areaName,
    estimatedMinutes,
    isSomeday,
  }
}

/**
 * Resolve a month index (0-based) + day-of-month into a YYYY-MM-DD.
 * If the resulting date is in the past, advance to next year.
 */
function resolveMonthDay(monthIdx: number, day: number, year?: number): string {
  const t = today()
  const yr = year ?? t.getFullYear()
  const candidate = new Date(yr, monthIdx, day)
  candidate.setHours(0, 0, 0, 0)
  if (!year && candidate < t) {
    // Already passed this year  use next year
    candidate.setFullYear(yr + 1)
  }
  return toYMD(candidate)
}

/** Parse a date string token into YYYY-MM-DD. Returns undefined if not parseable. */
function parseDate(token: string): string | undefined {
  const t = token.toLowerCase().trim()
  if (t === 'today' || t === 'tod') return toYMD(today())
  if (t === 'eod') return toYMD(today())
  if (/^(tomorrow|tmrw|tmr|tmrow|tom)$/.test(t)) return toYMD(addDays(today(), 1))
  if (t === 'next week') return toYMD(addDays(today(), 7))
  if (t === 'next month') return toYMD(startOfNextMonth())
  if (t === 'eow') return toYMD(nextFriday())
  if (t === 'eom') return toYMD(endOfCurrentMonth())
  if (t === 'som') return toYMD(startOfNextMonth())
  if (DAY_NAMES[t] !== undefined) return toYMD(nextWeekday(DAY_NAMES[t]))

  // "next <weekday>"
  const nextDayMatch = t.match(/^next\s+(\w+)$/)
  if (nextDayMatch && DAY_NAMES[nextDayMatch[1]] !== undefined) {
    return toYMD(nextWeekday(DAY_NAMES[nextDayMatch[1]], true))
  }

  // "in N days/weeks"
  const inNDaysMatch = t.match(/^in\s+(\d+)\s+(days?|weeks?)$/)
  if (inNDaysMatch) {
    const n = parseInt(inNDaysMatch[1])
    const unit = inNDaysMatch[2]
    return toYMD(addDays(today(), unit.startsWith('week') ? n * 7 : n))
  }

  // Month-name dates: "jan 15", "january 15 2027", "15 jan", "5 march 2026"
  const monthKeys = Object.keys(MONTH_NAMES).join('|')
  const monthDayRe = new RegExp(`^(${monthKeys})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?$`)
  const mDayMatch = t.match(monthDayRe)
  if (mDayMatch) {
    return resolveMonthDay(MONTH_NAMES[mDayMatch[1]], parseInt(mDayMatch[2]), mDayMatch[3] ? parseInt(mDayMatch[3]) : undefined)
  }
  const dayMonthRe = new RegExp(`^(\\d{1,2})\\s+(${monthKeys})(?:\\s+(\\d{4}))?$`)
  const dMonthMatch = t.match(dayMonthRe)
  if (dMonthMatch) {
    return resolveMonthDay(MONTH_NAMES[dMonthMatch[2]], parseInt(dMonthMatch[1]), dMonthMatch[3] ? parseInt(dMonthMatch[3]) : undefined)
  }

  // Try native Date parse as last resort
  const d = new Date(token)
  if (!isNaN(d.getTime())) return toYMD(d)
  return undefined
}

//  Human-readable descriptions 

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

export function describeTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m, 0, 0)
  return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: m > 0 ? '2-digit' : undefined, hour12: true })
}

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

export const PRIORITY_COLORS: Record<number, string> = {
  0: 'text-[var(--brand-text-primary)]/30',
  1: 'text-brand-primary',
  2: 'text-brand-text-secondary',
  3: 'text-brand-text-secondary',
}

/** Format a minute count for display: 30  "30m", 60  "1h", 75  "1h 15m" */
export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
