import { getSupabaseClient } from './supabase.js'
import { generateText } from './gemini-chat.js'

const supabase = getSupabaseClient()

export async function identifyRottingProjects(userId: string): Promise<any[]> {
  const cutoffDays = 45 // Projects inactive for 45 days or more are "rotting"

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

export async function generateProjectEulogy(project: any): Promise<string> {
  const prompt = `You are a melancholic AI poet. Write a very brief, poignant eulogy (2-3 sentences) for a project that has been left to languish. 
  It should capture the project's original promise and the sadness of its neglect.

  Project Title: "${project.title}"
  Project Description: "${project.description || 'No description provided.'}"

  Eulogy:`

  try {
    const eulogy = await generateText(prompt, { temperature: 0.8, maxTokens: 100 })
    return eulogy.trim()
  } catch (error) {
    console.error('[generateProjectEulogy] Error generating eulogy:', error)
    return `Alas, the dream of "${project.title}" now sleeps, its purpose unfulfilled.`
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