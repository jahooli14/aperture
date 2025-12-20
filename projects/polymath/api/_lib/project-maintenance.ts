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
    const report = await generateText(prompt, { temperature: 0.7, maxTokens: 300 })
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