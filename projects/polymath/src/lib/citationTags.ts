import type { Project } from '../types'

/**
 * Evidence tags like [e1] that a model once wrote into prose and that got
 * saved with the project. The server strips them now (api/_lib/citation-tags.ts);
 * this cleans what is already stored, wherever projects enter the app, so
 * nothing on screen has to remember to.
 */
const TAG = /\s*\[\s*e\d+(?:\s*[,;]\s*e\d+)*\s*\]/gi

export function stripCitationTags(text: string): string {
  return text.replace(TAG, '').replace(/\s{2,}/g, ' ').trim()
}

const clean = (v: unknown): unknown => (typeof v === 'string' ? stripCitationTags(v) : v)

export function cleanProjectCitations(p: Project): Project {
  const meta = (p.metadata ?? {}) as Record<string, unknown>
  const dirty =
    TAG.test(p.title ?? '') || TAG.test(p.description ?? '') ||
    JSON.stringify(meta).search(/\[\s*e\d+/i) !== -1
  TAG.lastIndex = 0
  if (!dirty) return p

  const tasks = Array.isArray(meta.tasks)
    ? (meta.tasks as Array<Record<string, unknown>>).map(t => ({ ...t, text: clean(t.text), progress_note: clean(t.progress_note) }))
    : meta.tasks
  const nextMove = meta.next_move && typeof meta.next_move === 'object'
    ? { ...(meta.next_move as Record<string, unknown>), text: clean((meta.next_move as Record<string, unknown>).text) }
    : meta.next_move

  return {
    ...p,
    title: stripCitationTags(p.title ?? ''),
    description: p.description ? stripCitationTags(p.description) : p.description,
    metadata: {
      ...meta,
      end_goal: clean(meta.end_goal),
      evolved_description: clean(meta.evolved_description),
      tasks,
      next_move: nextMove,
    } as Project['metadata'],
  }
}
