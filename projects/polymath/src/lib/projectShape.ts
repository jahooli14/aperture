/**
 * What shape a project is, which decides how the app treats it everywhere:
 * the page, the home card, what Update does, how it finishes.
 *
 *   quick    -- a weekend job: a coaster, the t-shirts. Its next move and a
 *               "Finished it". Nothing else to keep up.
 *   big      -- weeks or months with a finish line: the novel. What it is
 *               now, things to tick off, threads. Update ticks rows and the
 *               paragraph follows.
 *   ongoing  -- no finish line, or one that repeats: DJ mixes. Threads, and
 *               which one you're on.
 *
 * Chosen when the project is made (metadata.shape) and switchable with the
 * pill on its page. Older projects are worked out from what they carry,
 * never asked. Pure; tested.
 */

import type { Project } from '../types'
import { readThemes } from './projectThemes'

export type ProjectShape = 'quick' | 'big' | 'ongoing'

export const SHAPES: { id: ProjectShape; label: string; hint: string }[] = [
  { id: 'quick', label: 'Quick job', hint: 'A few hours or a weekend' },
  { id: 'big', label: 'Big project', hint: 'Weeks or months, with an end' },
  { id: 'ongoing', label: 'Something to keep at', hint: 'You come back to it for good' },
]

type Shaped = Pick<Project, 'metadata' | 'is_priority'> & { created_at?: string | null; title?: string; description?: string | null }

function meta(p: Shaped): Record<string, unknown> {
  return (p.metadata as Record<string, unknown> | null | undefined) ?? {}
}

export function readParts(metadata: unknown): { id: string; label: string; done: boolean }[] {
  const raw = (metadata as { parts?: unknown } | null)?.parts
  return Array.isArray(raw) ? raw.filter(p => p && typeof p.id === 'string' && typeof p.label === 'string') : []
}

const BIG_WORK = /\b(book|novel|novella|album|ep|film|screenplay|game|app|website)\b/i

export function projectShape(project: Shaped): ProjectShape {
  const m = meta(project)
  if (m.shape === 'quick' || m.shape === 'big' || m.shape === 'ongoing') return m.shape
  if (m.cycle) return 'ongoing'
  if (readParts(m).length > 0) return 'big'
  const hasLines = readThemes(project.metadata).length > 0
  const hasEnd = typeof m.end_goal === 'string' && m.end_goal.trim().length > 0
  if (m.kind === 'ongoing') return hasEnd ? 'big' : 'ongoing'
  if (m.kind === 'one-off') return 'quick'
  // Older projects: lines plus a finish line is a big one (the novel);
  // lines with no end is something you keep at.
  if (hasLines) return hasEnd ? 'big' : 'ongoing'
  // A book, an album, an app is never a weekend job, whatever else it carries.
  if (BIG_WORK.test(`${(project as { title?: string }).title ?? ''} ${(project as { description?: string | null }).description ?? ''}`)) return 'big'
  return 'quick'
}

/** What's stored when the shape is chosen. `kind` is kept for older code. */
export function shapeMetadata(shape: ProjectShape): { shape: ProjectShape; kind: 'one-off' | 'ongoing' } {
  return { shape, kind: shape === 'quick' ? 'one-off' : 'ongoing' }
}

/** The pill cycles through the three. */
export function nextShape(shape: ProjectShape): ProjectShape {
  return shape === 'quick' ? 'big' : shape === 'big' ? 'ongoing' : 'quick'
}

/** The first row not yet ticked, for the home card: "Next: Chapter 2". */
export function nextPart(metadata: unknown): string | null {
  return readParts(metadata).find(p => !p.done)?.label ?? null
}

/** Every row ticked: time to call it finished. */
export function allPartsDone(metadata: unknown): boolean {
  const parts = readParts(metadata)
  return parts.length > 0 && parts.every(p => p.done)
}
