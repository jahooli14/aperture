import { describe, it, expect } from 'vitest'
import { canMorphProject } from './morph.js'

/**
 * The real bug: the generate-morph cron handler in api/utilities.ts used
 * to call canMorphProject(project.last_session_ended_at) -- session
 * recency, a different question from "was this project morphed
 * recently". canMorphProject itself is correct; this is about what the
 * CALLER passes it, which a pure unit test on the function alone can
 * never catch. Mirrors the fix: the handler now looks up the most recent
 * 'morph' proposal per project from the proposals table (which already
 * existed -- no schema change needed) and passes THAT.
 */
function mostRecentMorphPerProject(proposals: { project_id: string; created_at: string }[]): Map<string, string> {
  const byProject = new Map<string, string>()
  // Mirrors the handler: proposals arrive newest-first, first-seen wins.
  for (const row of proposals) {
    if (!byProject.has(row.project_id)) byProject.set(row.project_id, row.created_at)
  }
  return byProject
}

describe('morph eligibility uses morph history, not session recency', () => {
  const now = new Date('2026-09-01T12:00:00Z')
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

  it('a project worked on yesterday but never morphed is eligible', () => {
    // The old bug: last_session_ended_at = yesterday would have made this
    // project permanently ineligible for as long as sessions kept
    // happening on it -- exactly backwards, since this is the project
    // with the freshest fragments to draw a morph from.
    const lastMorphed = mostRecentMorphPerProject([]).get('proj-active') ?? null
    expect(canMorphProject(lastMorphed, now)).toBe(true)
  })

  it('a project morphed 3 days ago is still in cooldown', () => {
    const proposals = [{ project_id: 'proj-active', created_at: daysAgo(3) }]
    const lastMorphed = mostRecentMorphPerProject(proposals).get('proj-active') ?? null
    expect(canMorphProject(lastMorphed, now)).toBe(false)
  })

  it('a project morphed 20 days ago is eligible again', () => {
    const proposals = [{ project_id: 'proj-active', created_at: daysAgo(20) }]
    const lastMorphed = mostRecentMorphPerProject(proposals).get('proj-active') ?? null
    expect(canMorphProject(lastMorphed, now)).toBe(true)
  })

  it('takes the MOST RECENT morph when a project has several, not the oldest', () => {
    const proposals = [
      { project_id: 'proj-a', created_at: daysAgo(1) },
      { project_id: 'proj-a', created_at: daysAgo(30) },
    ]
    const lastMorphed = mostRecentMorphPerProject(proposals).get('proj-a') ?? null
    expect(lastMorphed).toBe(daysAgo(1))
    expect(canMorphProject(lastMorphed, now)).toBe(false)
  })

  it("one project's morph history does not affect another project's eligibility", () => {
    const proposals = [{ project_id: 'proj-a', created_at: daysAgo(1) }]
    const byProject = mostRecentMorphPerProject(proposals)
    expect(canMorphProject(byProject.get('proj-b') ?? null, now)).toBe(true)
  })
})
