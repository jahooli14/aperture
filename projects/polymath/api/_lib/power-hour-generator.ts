
import { getSupabaseClient } from './supabase.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface PowerHourTask {
    project_id: string
    project_title: string
    task_title: string
    task_description: string
    impact_score: number
    fuel_id?: string
    fuel_title?: string
}

import { repairAllUserProjects } from './project-repair.js'

export async function generatePowerHourPlan(userId: string, projectId?: string): Promise<PowerHourTask[]> {
    const supabase = getSupabaseClient()
    console.log('[PowerHour] Generating plan for user:', userId, projectId ? `focused on ${projectId}` : '')

    // 0. Ensure existing projects have tasks (Auto-repair/scaffold)
    try {
        await repairAllUserProjects(userId)
    } catch (err) {
        console.error('[PowerHour] Project repair failed:', err)
    }

    // 1. Fetch active projects
    let query = supabase
        .from('projects')
        .select('id, title, description, status, metadata')
        .in('status', ['active', 'upcoming', 'maintaining', 'Active', 'Upcoming', 'Maintaining'])
        .eq('user_id', userId)

    if (projectId) {
        query = query.eq('id', projectId)
    } else {
        query = query.order('last_active', { ascending: false }).limit(5)
    }

    const { data: projects, error: projectsError } = await query

    if (projectsError) throw projectsError

    if (!projects || projects.length === 0) {
        return []
    }

    // 2. Fetch recent unread articles (Fuel)
    const { data: fuel, error: fuelError } = await supabase
        .from('reading_queue')
        .select('id, title, excerpt, content')
        .eq('status', 'unread')
        .eq('user_id', userId)
        .limit(10)

    if (fuelError) throw fuelError

    // 3. Use Gemini 3 Flash to synthesize Power Hour suggestions
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

    const projectsContext = projects.map(p => {
        const tasksList = (p.metadata?.tasks || [])
            .filter((t: any) => !t.completed)
            .map((t: any) => t.text)
            .join(', ')
        return `- ${p.title} (${p.status}) [ID: ${p.id}]: ${p.description}. Current Tasks: ${tasksList || 'None listed yet.'}`
    }).join('\n')

    const validFuelIds = new Set(fuel?.map(f => f.id) || [])
    const fuelContext = fuel?.slice(0, 5).map(f => `- ${f.title} [ID: ${f.id}]: ${f.excerpt}`).join('\n') || 'No new fuel available.'

    const prompt = `You are the APERTURE ENGINE. Your goal is MOMENTUM.
Reach 80% completion with 20% effort.

CURRENT PROJECTS:
${projectsContext}

AVAILABLE FUEL (Reading Material):
${fuelContext}

TASK:
Generate three high-impact "Power Hour" tasks (60 minutes each).
Each task must be tied to an active project and use specific fuel if available.
Focus on the "Next Step" that eliminates the most decision fatigue.

CRITICAL INSTRUCTIONS:
1. ONLY use Fuel Items from the list provided above. Do not invent articles.
2. If suggesting fuel, you MUST include the valid Fuel ID provided in square brackets.
3. If no relevant fuel exists, omit the fuel_id.

Output JSON only in this format:
{
  "tasks": [
    {
      "project_id": "string (must match source ID)",
      "project_title": "string",
      "task_title": "string",
      "task_description": "string (actionable, 1-2 sentences)",
      "impact_score": 0.1-1.0,
      "fuel_id": "string (optional valid id)",
      "fuel_title": "string (optional)"
    }
  ]
}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const tasksData = jsonMatch ? JSON.parse(jsonMatch[0]) : { tasks: [] }

    // 4. Validate Fuel IDs (Anti-Hallucination)
    const validatedTasks: PowerHourTask[] = tasksData.tasks.map((task: any) => {
        // Validate project_id exist in our list? (Optional, but good)

        // Validate Fuel ID
        let validFuelId = task.fuel_id
        let validFuelTitle = task.fuel_title

        if (validFuelId && !validFuelIds.has(validFuelId)) {
            console.warn('[PowerHour] Removing hallucinated fuel_id:', validFuelId)
            validFuelId = undefined
            validFuelTitle = undefined
        }

        return {
            ...task,
            fuel_id: validFuelId,
            fuel_title: validFuelTitle
        }
    })

    return validatedTasks
}
