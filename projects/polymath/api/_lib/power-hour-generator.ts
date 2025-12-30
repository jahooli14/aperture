
import { getSupabaseClient } from './supabase.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface PowerHourTask {
    project_id: string
    project_title: string
    task_title: string
    task_description: string // High-level objective for the session
    session_summary: string   // Joyous, motivating summary

    // The Session Arc
    ignition_tasks: { text: string; is_new: boolean }[] // Micro-tasks to break inertia (< 2 mins)
    checklist_items: { text: string; is_new: boolean }[] // The Core Flow (includes "Setup" if needed)
    shutdown_tasks: { text: string; is_new: boolean }[] // Parking & Cleanup

    impact_score: number
    fuel_id?: string
    fuel_title?: string
    overhead_type?: 'Mental' | 'Physical' | 'Tech' | 'Digital'
    duration_minutes: number

    // Metadata for UI
    is_dormant?: boolean
    days_dormant?: number
}

import { repairAllUserProjects } from './project-repair.js'

export async function generatePowerHourPlan(userId: string, projectId?: string, durationMinutes: number = 60): Promise<PowerHourTask[]> {
    const supabase = getSupabaseClient()
    console.log('[ContextualSession] Generating plan for user:', userId, `Duration: ${durationMinutes}m`, projectId ? `Focused on ${projectId}` : '')

    // 0. Ensure existing projects have tasks (Auto-repair/scaffold)
    try {
        await repairAllUserProjects(userId)
    } catch (err) {
        console.error('[ContextualSession] Project repair failed:', err)
    }

    // 1. Fetch active projects
    let query = supabase
        .from('projects')
        .select('id, title, description, status, type, metadata, last_active, embedding')
        .in('status', ['active', 'upcoming', 'maintaining', 'Active', 'Upcoming', 'Maintaining'])
        .eq('user_id', userId)

    if (projectId) {
        query = query.eq('id', projectId)
    } else {
        query = query.order('last_active', { ascending: false }).limit(5)
    }

    const { data: projects, error: projectsError } = await query
    if (projectsError) throw projectsError
    if (!projects || projects.length === 0) return []

    // 2. Fetch recent unread articles (Fuel) with embeddings
    const { data: fuel, error: fuelError } = await supabase
        .from('reading_queue')
        .select('id, title, excerpt, content, embedding')
        .eq('status', 'unread')
        .eq('user_id', userId)
        .limit(10)

    if (fuelError) throw fuelError

    // 2b. Fetch recent list items (Inspiration) with embeddings
    const { data: listInspiration, error: listError } = await supabase
        .from('list_items')
        .select('id, content, metadata, list_id, embedding')
        .eq('user_id', userId)
        .eq('enrichment_status', 'complete')
        .order('created_at', { ascending: false })
        .limit(10)

    if (listError) console.warn('[PowerHour] Failed to fetch list inspiration:', listError)

    // 3. Prepare Context for Prompt
    const now = Date.now()

    // Generate context for each project with semantically matched fuel/inspiration
    const projectsContext = (await Promise.all(projects.map(async p => {
        // Find relevant fuel and inspiration for this specific project using vector search
        let relevantFuel: any[] = []
        let relevantInspiration: any[] = []

        if (p.embedding) {
            // Match fuel articles to project (graceful fallback if vector search unavailable)
            if (fuel && fuel.length > 0) {
                try {
                    const { data: matchedFuel, error } = await supabase.rpc('match_reading', {
                        query_embedding: p.embedding,
                        filter_user_id: userId,
                        match_threshold: 0.6,
                        match_count: 3
                    })
                    if (!error && matchedFuel) {
                        relevantFuel = matchedFuel
                    }
                } catch (err) {
                    console.warn('[PowerHour] Vector search for fuel unavailable, using general fuel:', err)
                }
            }

            // Match list items to project (graceful fallback if vector search unavailable)
            if (listInspiration && listInspiration.length > 0) {
                try {
                    const { data: matchedList, error } = await supabase.rpc('match_list_items', {
                        query_embedding: p.embedding,
                        filter_user_id: userId,
                        match_threshold: 0.6,
                        match_count: 3
                    })
                    if (!error && matchedList) {
                        relevantInspiration = matchedList
                    }
                } catch (err) {
                    console.warn('[PowerHour] Vector search for inspiration unavailable, using general list:', err)
                }
            }
        }

        const allTasks = p.metadata?.tasks || []
        const unfinishedTasks = allTasks.filter((t: any) => !t.done)
        const completedTasks = allTasks.filter((t: any) => t.done)
        const totalIncomplete = unfinishedTasks.length

        // Calculate dormancy - days since last_active
        const lastActiveDate = p.last_active ? new Date(p.last_active).getTime() : now
        const daysDormant = Math.floor((now - lastActiveDate) / (1000 * 60 * 60 * 24))
        const isDormant = daysDormant >= 14
        const isVeryDormant = daysDormant >= 30

        // Find the last completed task for context
        const lastCompletedTask = completedTasks
            .filter((t: any) => t.completed_at)
            .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]

        // Identify stale tasks (incomplete for > 14 days)
        const staleTasks = unfinishedTasks.filter((t: any) => {
            if (!t.created_at) return false
            const ageInDays = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)
            return ageInDays > 14
        }).map((t: any) => t.text)

        // Get rejected/removed suggestions to avoid repeating
        const rejectedSuggestions = p.metadata?.rejected_suggestions || []

        const unfinishedList = unfinishedTasks.length > 0
            ? unfinishedTasks.map((t: any) => t.text).join(', ')
            : 'None yet'
        const completedList = completedTasks.length > 0
            ? completedTasks.slice(-5).map((t: any) => t.text).join(', ')
            : 'None yet'

        // Get motivation and end_goal for goal-driven AI
        const motivation = p.metadata?.motivation || ''
        const endGoal = p.metadata?.end_goal || ''
        const projectMode = p.metadata?.project_mode || 'completion'
        const isRecurring = projectMode === 'recurring'

        let context = `- [${p.type || 'General'}] ${p.title} (${p.status}) [ID: ${p.id}]: ${p.description || 'No description'}
    Motivation: ${motivation || 'Not specified'}
    Project Mode: ${isRecurring ? '🔄 RECURRING (ongoing habit - no end goal)' : 'Completion-based'}
    ${isRecurring ? 'Focus: Consistency and habit-building, not finishing' : `Definition of Done: ${endGoal || 'Not specified - help user define completion'}`}
    Completed Tasks: ${completedList}
    Remaining Tasks: ${unfinishedList}`

        // Add dormancy context
        if (isVeryDormant) {
            context += `\n    💤 VERY DORMANT (${daysDormant} days since last session) - needs gentle re-engagement`
        } else if (isDormant) {
            context += `\n    😴 DORMANT (${daysDormant} days since last session)`
        }

        // Add stale task warning if any
        if (staleTasks.length > 0) {
            context += `\n    ⚠️ STALE TASKS (>14 days old): ${staleTasks.join(', ')}`
        }

        // Add rejected suggestions to avoid repeating
        if (rejectedSuggestions.length > 0) {
            context += `\n    🚫 DO NOT SUGGEST: ${rejectedSuggestions.slice(-10).join(', ')}`
        }

        // Add project-specific fuel and inspiration
        if (relevantFuel.length > 0) {
            const fuelList = relevantFuel.map(f => `- ${f.title} [ID: ${f.id}]`).join('\n      ')
            context += `\n    📚 RELEVANT FUEL:\n      ${fuelList}`
        }
        if (relevantInspiration.length > 0) {
            const inspirationList = relevantInspiration.map(i => `- ${i.content}`).join('\n      ')
            context += `\n    💡 RELEVANT INSPIRATION:\n      ${inspirationList}`
        }

        return context
    }))).join('\n')

    // 4. Gemini 1.5 Flash - The "Sherpa" Prompt
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

    const prompt = `You are the APERTURE SHERPA. Your goal is to engineer a JOYOUS, FRICTIONLESS work session.
    
SESSION PARAMETERS:
- Duration: ${durationMinutes} minutes.
- User Context: Personal Projects (Writing, Art, Tech, etc).

Available Projects:
${projectsContext}

YOUR MISSION:
Design 3 distinct Session Arcs. Each must follow this "Flow Engineering" structure:
1. IGNITION (0-5m): Micro-tasks to break physical/mental inertia. (e.g., "Fill water cup", "Open repo").
2. THE FLOW (Bulk): The core work.
   - IMPERATIVE: If the project is "High Friction" (Art, Hardware) and duration is >= 60m, you MUST include explicit "Setup" tasks (e.g. "Get paints out") as the first item in the Checklist.
   - IMPERATIVE: If duration is 25m ("Spark" mode), ONLY suggest "Dry" tasks (Planning, Digital, Buying). DO NOT suggest "Wet" tasks (Painting, Building) for a 25m slot.
3. PARKING (Last 5m): Tasks to close the loop and reduce friction for *next time*. (e.g. "Clean brushes", "Leave notebook open").

PROJECT TYPE LOGIC:
- WRITING: Mental Friction. Ignition = "Mood Prep" (Playlist, clear desk).
- ART: Physical Friction. Ignition = Micro-habit (Apron on). Checklist MUST include Setup (Paints out). Parking MUST include Cleanup.
- TECH: Low Friction. Ignition = Context load.
- GENERAL: Assess friction based on description.

Output JSON only:
{
  "tasks": [
    {
      "project_id": "string",
      "project_title": "string",
      "task_title": "string (The Session Theme)",
      "task_description": "string (High level mission)",
      "session_summary": "string (Motivating vision of the result)",
      "overhead_type": "Mental" | "Physical" | "Tech" | "Digital",
      "ignition_tasks": [ { "text": "string", "is_new": true } ],
      "checklist_items": [ { "text": "string", "is_new": boolean } ], 
      "shutdown_tasks": [ { "text": "string", "is_new": true } ],
      "impact_score": 0.1-1.0,
      "fuel_id": "string (optional)",
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

    // 5. Validate & Return
    const validatedTasks: PowerHourTask[] = tasksData.tasks.map((task: any) => {
        // Look up dormancy info for this project to pass through
        const project = projects.find(p => p.id === task.project_id)
        const lastActiveDate = project?.last_active ? new Date(project.last_active).getTime() : now
        const daysDormant = Math.floor((now - lastActiveDate) / (1000 * 60 * 60 * 24))
        const isDormant = daysDormant >= 14

        return {
            ...task,
            duration_minutes: durationMinutes,
            is_dormant: isDormant,
            days_dormant: daysDormant
        }
    })

    return validatedTasks
}
