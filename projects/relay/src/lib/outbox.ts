/**
 * Nothing you've written should be lost to a bad connection.
 *
 * A line that fails to send is kept here, in this browser, and retried when
 * the connection comes back. Drafts work the same way: what you type is saved
 * as you type it, so closing the tab mid-thought costs nothing.
 *
 * Every read and write is wrapped, because storage throws outright in private
 * mode on some browsers and a lost draft must never take the app down.
 */
export interface QueuedLine {
  storyId: string
  body: string
  chapterTitle?: string
  queuedAt: string
}

const OUTBOX_KEY = 'relay:outbox'
const DRAFT_PREFIX = 'relay:draft:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked. Losing a draft is bad; crashing is worse.
  }
}

/** Lines that failed to send, oldest first. */
export function queuedLines(): QueuedLine[] {
  return read<QueuedLine[]>(OUTBOX_KEY, [])
}

export function queueLine(entry: Omit<QueuedLine, 'queuedAt'>): void {
  const queue = queuedLines()
  // One unsent line per story. A second attempt replaces the first rather
  // than quietly building a backlog you never agreed to send.
  const withoutStory = queue.filter((item) => item.storyId !== entry.storyId)
  write(OUTBOX_KEY, [...withoutStory, { ...entry, queuedAt: new Date().toISOString() }])
}

export function dequeueLine(storyId: string): void {
  write(OUTBOX_KEY, queuedLines().filter((item) => item.storyId !== storyId))
}

export function queuedFor(storyId: string): QueuedLine | null {
  return queuedLines().find((item) => item.storyId === storyId) ?? null
}

/** What you were typing, kept per story. */
export function readDraft(storyId: string): string {
  try {
    return localStorage.getItem(DRAFT_PREFIX + storyId) ?? ''
  } catch {
    return ''
  }
}

export function saveDraft(storyId: string, body: string): void {
  try {
    if (body.trim()) localStorage.setItem(DRAFT_PREFIX + storyId, body)
    else localStorage.removeItem(DRAFT_PREFIX + storyId)
  } catch {
    // As above.
  }
}

export function clearDraft(storyId: string): void {
  saveDraft(storyId, '')
}
