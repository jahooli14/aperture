import { getSupabaseClient } from './supabase.js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'

const supabase = getSupabaseClient()

export async function identifyRottingProjects(userId: string): Promise<any[]> {
  const cutoffDays = 14 // Projects inactive for 14 days or more are "rotting"

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, last_active, created_at, status')
    .eq('user_id', userId)
    .in('status', ['active', 'dormant', 'upcoming']) // Only consider projects that are not yet buried/completed

  if (error) {
    console.error('[identifyRottingProjects] Error fetching projects:', error)
    throw error
  }

  const rottingProjects = projects.filter(p => {
    const lastActive = new Date(p.last_active || p.created_at)
    const now = new Date()
    const daysInactive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
    return daysInactive >= cutoffDays
  })

  return rottingProjects
}

export async function generateZebraReport(project: any): Promise<string> {
  const prompt = `This project is being shelved. Write a one-paragraph honest summary (under 150 words): what worked, what stalled, what parts are worth saving for later.

  Project Title: "${project.title}"
  Project Description: "${project.description || 'No description provided.'}"

  ${PLAIN_ENGLISH_RULES}
  One paragraph. No bullets.`

  try {
    const report = await generateText(prompt, { temperature: 0.7, maxTokens: 500 })
    return report.trim()
  } catch (error) {
    console.error('[generateZebraReport] Error generating report:', error)
    return `The hunt for "${project.title}" has concluded. Lessons archived.`
  }
}

export async function buryProject(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ status: 'graveyard' })
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) {
    console.error(`[buryProject] Error burying project ${projectId}:`, error)
    throw error
  }
}

export async function resurrectProject(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ status: 'active', last_active: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) {
    console.error(`[resurrectProject] Error resurrecting project ${projectId}:`, error)
    throw error
  }
}

/**
 * Picks the best graveyard project candidate to surface in synthesis.
 * Scoring: older burial = higher priority (they've been forgotten longest),
 * with a recency boost if the project has relevant metadata (capabilities/tags).
 * Returns null if no graveyard projects exist.
 */
export async function pickSynthesisResurfaceCandidate(userId: string): Promise<any | null> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, metadata, updated_at, created_at, status')
    .eq('user_id', userId)
    .eq('status', 'graveyard')

  if (error) {
    console.error('[pickSynthesisResurfaceCandidate] Error fetching graveyard projects:', error)
    return null
  }

  if (!projects || projects.length === 0) return null

  // Score each project: older burial wins (longest forgotten), capped at 365 days
  const now = Date.now()
  const scored = projects.map(p => {
    const buriedMs = now - new Date(p.updated_at || p.created_at).getTime()
    const daysBuried = Math.min(buriedMs / (1000 * 60 * 60 * 24), 365)
    // Bonus if project has capabilities or tags (more context = better synthesis)
    const hasContext = (p.metadata?.capabilities?.length > 0 || p.metadata?.tags?.length > 0) ? 20 : 0
    return { project: p, score: daysBuried + hasContext }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].project
}

/**
 * Reshape dormant non-focused projects.
 *
 * Mode 2b in product terms: "you started this when you were a different
 * person — here's the version that fits who you are now." The reshape
 * uses post-original signals (thoughts captured since the project went
 * quiet, recently completed projects, list items the user reacted to)
 * to ground the new framing in who the user has become since.
 */
export async function reshapeDormantProjects(userId: string): Promise<number> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, metadata, last_active, status, is_priority, heat_score, heat_reason, created_at')
    .eq('user_id', userId)
    .in('status', ['dormant', 'on-hold', 'upcoming'])
    .eq('is_priority', false)

  if (error || !projects?.length) return 0

  // Only reshape projects dormant 30+ days that haven't been reshaped recently
  const now = Date.now()
  const candidates = projects.filter(p => {
    const lastActive = new Date(p.last_active || '2000-01-01').getTime()
    const daysDormant = (now - lastActive) / (1000 * 60 * 60 * 24)
    const lastReshaped = p.metadata?.last_reshaped ? new Date(p.metadata.last_reshaped).getTime() : 0
    const daysSinceReshape = (now - lastReshaped) / (1000 * 60 * 60 * 24)
    return daysDormant >= 30 && daysSinceReshape >= 14
  })

  if (candidates.length === 0) return 0

  // Reshape up to 3 per run
  let reshaped = 0
  for (const project of candidates.slice(0, 3)) {
    try {
      // Post-original signals: who has the user become since this project
      // went quiet? We use last_active (or created_at as a fallback) as
      // the cutoff and pull the strongest signals from after that point.
      const since = project.last_active || project.created_at || new Date(Date.now() - 365 * 86_400_000).toISOString()

      const [recentThoughtsRes, completedProjectsRes, sparkedItemsRes] = await Promise.all([
        supabase
          .from('memories')
          .select('title, body, themes, created_at')
          .eq('user_id', userId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase
          .from('projects')
          .select('title, description, updated_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('list_items')
          .select('content, metadata, lists(type)')
          .eq('user_id', userId)
          .gte('created_at', since)
          .in('metadata->>reaction', ['sparked', 'make'])
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const recentThoughts = (recentThoughtsRes.data ?? [])
        .map((m: any) => `- "${(m.title || '').trim()}": ${(m.body || '').trim().slice(0, 200)}`)
        .filter((s: string) => s.length > 6)
        .join('\n')

      const completedProjects = (completedProjectsRes.data ?? [])
        .map((p: any) => `- ${p.title}${p.description ? ` — ${p.description.slice(0, 120)}` : ''}`)
        .join('\n')

      const sparkedItems = (sparkedItemsRes.data ?? [])
        .map((li: any) => {
          const reaction = li.metadata?.reaction === 'make' ? 'wants to make' : 'sparked them'
          const type = li.lists?.type || 'item'
          return `- ${type}: "${(li.content || '').trim().slice(0, 120)}" (${reaction})`
        })
        .join('\n')

      const dormancyDays = Math.floor((Date.now() - new Date(project.last_active || project.created_at || Date.now()).getTime()) / 86_400_000)
      const storedBlocker = (project.metadata as any)?.blocker as string | undefined
      const blockerLine = storedBlocker
        ? `\nBlocker captured at the moment of pause: "${storedBlocker}"`
        : ''

      const prompt = `A dormant creative project. The user started it ${dormancyDays} days ago and hasn't touched it in a while. Honor what they originally meant — then offer a version that fits who they've become since.

ORIGINAL PROJECT:
Title: "${project.title}"
Description: "${project.description || 'No description'}"${blockerLine}

WHO THEY'VE BECOME SINCE (use this — these are the signals that should reshape the project):
${recentThoughts ? `\nRecent thoughts:\n${recentThoughts}` : ''}
${completedProjects ? `\nProjects they finished since:\n${completedProjects}` : ''}
${sparkedItems ? `\nFilms/books/places they reacted to:\n${sparkedItems}` : ''}
${!recentThoughts && !completedProjects && !sparkedItems ? '\n(no recent signal — keep the reshape close to the original)' : ''}

WRITE:
- evolved_description: ONE sentence (max 18 words). Same core idea, reframed for who they are now. Reference at least one specific thing from the post-original signals if any are present. Don't say "evolved" or "reimagined." Just say what it is.
- heat_reason: ONE sentence (max 12 words). What recent signal makes this worth revisiting RIGHT NOW. Name the specific item.

${PLAIN_ENGLISH_RULES}
- Don't write a tagline. Write what the project would actually become.
- BAD: "An evolved exploration of constraint that unlocks your authentic creative voice." GOOD: "A 30-day album recorded only on the train, after the woodworking course taught you what scarcity feels like."

Return JSON only:
{
  "evolved_description": "...",
  "heat_reason": "..."
}`

      const raw = await generateText(prompt, { temperature: 0.85, maxTokens: 280 })
      const parsed = JSON.parse(raw)

      // If the model produced nothing concrete, write null fields rather
      // than vague filler — silence beats "Reshaped — worth another look."
      const evolvedDescription = (parsed.evolved_description || '').trim() || null
      const heatReason = (parsed.heat_reason || '').trim() || null

      await supabase
        .from('projects')
        .update({
          heat_score: Math.max(project.heat_score || 0, 5),
          heat_reason: heatReason,
          metadata: {
            ...project.metadata,
            evolved_description: evolvedDescription,
            last_reshaped: new Date().toISOString(),
          },
        })
        .eq('id', project.id)

      reshaped++
    } catch (err) {
      console.error(`[reshapeDormantProjects] Failed to reshape ${project.id}:`, err)
    }
  }

  return reshaped
}