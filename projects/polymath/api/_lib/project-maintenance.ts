import { getSupabaseClient } from './supabase.js'
import { generateText } from './gemini-chat.js'

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
  const prompt = `This project is being shelved. Write a quick honest summary (under 150 words): what worked, what stalled, and what parts are worth saving for later.
  
  Project Title: "${project.title}"
  Project Description: "${project.description || 'No description provided.'}"
  
  Format: Bold, bulleted, high-impact.`

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
 * Instead of nagging the user, the engine quietly evolves dormant project
 * descriptions to stay relevant, then surfaces them in "Try Something New".
 */
export async function reshapeDormantProjects(userId: string): Promise<number> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, metadata, last_active, status, is_priority, heat_score, heat_reason')
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
      const prompt = `This is a dormant creative project that someone started but hasn't touched in a while. Your job is to reimagine it — same core idea, but evolved. Make it feel fresh, not stale.

Project: "${project.title}"
Description: "${project.description || 'No description'}"

Write a 1-sentence evolved description that:
- Keeps the core essence but reframes it in a way that feels new
- Suggests a different angle or approach they might not have considered
- Makes the user think "oh, I could do THAT instead"

Also write a heat_reason — a 1-sentence explanation of why this is worth revisiting now.

Return JSON only:
{
  "evolved_description": "...",
  "heat_reason": "..."
}`

      const raw = await generateText(prompt, { temperature: 0.85, maxTokens: 200 })
      const parsed = JSON.parse(raw)

      await supabase
        .from('projects')
        .update({
          heat_score: Math.max(project.heat_score || 0, 5),
          heat_reason: parsed.heat_reason || 'Reshaped — worth another look',
          metadata: {
            ...project.metadata,
            evolved_description: parsed.evolved_description,
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