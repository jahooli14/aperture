/**
 * A note recorded on a project's own page is about that project: the client
 * sends `source_reference: "project:<id>"`. The AI's guess at which project a
 * note belongs to (triage) must not overrule that. Until this existed the
 * link was only a `connections` row made after the fact, which nothing that
 * reads a project's notes (the "Keep in mind" lines, the catch-up, the days
 * you touched it) ever looked at, so a note said on the page changed nothing.
 */

export function explicitProjectId(sourceReference: unknown): string | null {
  if (typeof sourceReference === 'string') {
    const m = /^project:([0-9a-fA-F-]{8,})$/.exec(sourceReference.trim())
    return m ? m[1] : null
  }
  const o = sourceReference as { type?: unknown; id?: unknown } | null
  if (o && o.type === 'project' && typeof o.id === 'string' && o.id) return o.id
  return null
}

/** The model's triage with the project pinned to the one the note was said on. */
export function pinnedTriage(triage: unknown, projectId: string): Record<string, unknown> {
  const base = (triage && typeof triage === 'object' ? triage : {}) as Record<string, unknown>
  return { ...base, category: 'task_update', project_id: projectId, confidence: 1 }
}
