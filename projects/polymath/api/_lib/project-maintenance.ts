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
  const prompt = `You are the APERTURE NARRATOR. This project is being archived. 
  Generate a high-contrast "Zebra Report" (max 150 words).
  
  Focus on:
  1. Lessons Learned: Why did we stall? What did we prove?
  2. Scavenge: Which parts of this project (code, ideas, research) should be saved for the next hunt?
  3. The 80/20 Exit: Why is 80% completion good enough for now?
  
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