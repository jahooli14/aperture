
import { getSupabaseClient } from './supabase.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface PowerHourTask {
    project_id: string
    project_title: string
    task_title: string
    task_description: string // High-level objective for the hour
    session_summary: string   // Joyous, motivating summary of what will be achieved
    checklist_items: {
        text: string
        is_new: boolean
    }[] // The specific "hit list" for the hour
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

    // 3. Use Gemini 1.5 Flash to synthesize Power Hour suggestions
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

    const projectsContext = projects.map(p => {
        const tasksList = (p.metadata?.tasks || [])
            .filter((t: any) => !t.done)
            .map((t: any) => t.text)
            .join(', ')
        return `- ${p.title} (${p.status}) [ID: ${p.id}]: ${p.description}. Existing Unfinished Tasks: ${tasksList || 'None listed yet.'}`
    }).join('\n')

    const validFuelIds = new Set(fuel?.map(f => f.id) || [])
    const fuelContext = fuel?.slice(0, 5).map(f => `- ${f.title} [ID: ${f.id}]: ${f.excerpt}`).join('\n') || 'No new fuel available.'

    const prompt = `You are the APERTURE ENGINE. Your goal is JOYOUS MOMENTUM.
It is a "Power Hour" - 60 minutes of high-focus, high-impact work.

CURRENT PROJECTS:
${projectsContext}

AVAILABLE FUEL (Reading Material):
${fuelContext}

TASK:
Generate Power Hour session plans for each project above.
Each plan must be a joyous, motivating blueprint for 60 minutes of work.

For each plan:
1. Select a focus project (use the exact project_id from the list above).
2. Create a "Task Title" (the core theme of the hour).
3. Create a "Task Description" (the high-level mission).
4. Create a "Session Summary" - A 2-sentence motivating vision of exactly what will be better in the user's world after this hour.
5. Create a "Checklist Hit-List" with 3-5 tasks:
   - Include any relevant existing unfinished tasks from the project (set is_new: false)
   - MUST include 2-3 NEW suggested tasks (set is_new: true) - these are AI recommendations
   - New tasks should be concrete, actionable steps starting with verbs
   - Examples: "Set up CI/CD pipeline", "Write unit tests", "Create user documentation", "Implement error handling"

CRITICAL RULES:
1. EVERY checklist item MUST have "is_new" as a boolean (true for AI suggestions, false for existing tasks).
2. You MUST suggest at least 2 new tasks per project with is_new: true.
3. ONLY use Fuel Items from the list provided above. Do not invent articles.
4. If suggesting fuel, you MUST include the valid Fuel ID provided in square brackets.
5. If no relevant fuel exists, omit the fuel_id.

Output JSON only (no markdown, no explanation):
{
  "tasks": [
    {
      "project_id": "exact-uuid-from-above",
      "project_title": "string",
      "task_title": "string",
      "task_description": "string",
      "session_summary": "string",
      "checklist_items": [
        { "text": "string", "is_new": true },
        { "text": "string", "is_new": false }
      ],
      "impact_score": 0.1-1.0,
      "fuel_id": "string (optional valid id)",
      "fuel_title": "string (optional)"
    }
  ]
}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    console.log('[PowerHour] Raw Gemini response (first 500 chars):', responseText.substring(0, 500))
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const tasksData = jsonMatch ? JSON.parse(jsonMatch[0]) : { tasks: [] }
    console.log('[PowerHour] Parsed tasks data:', JSON.stringify(tasksData, null, 2))

    // 4. Validate Fuel IDs & Cleanup
    const validatedTasks: PowerHourTask[] = tasksData.tasks.map((task: any) => {
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
