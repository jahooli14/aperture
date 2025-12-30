
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
        estimated_minutes: number // Duration estimate: 5, 15, 25, or 45
    }[] // The specific "hit list" for the hour
    total_estimated_minutes: number // Sum of all checklist item durations
    impact_score: number
    fuel_id?: string
    fuel_title?: string
    is_dormant?: boolean      // Project hasn't been touched in 14+ days
    days_dormant?: number     // How many days since last activity
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
        .select('id, title, description, status, metadata, last_active, embedding')
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

    // 3. Use Gemini 1.5 Flash to synthesize Power Hour suggestions
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

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
        const slotsAvailable = Math.max(0, 12 - totalIncomplete)

        // Calculate progress toward goal
        const totalTasks = allTasks.length
        const progress = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0

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

        let context = `- ${p.title} (${p.status}) [ID: ${p.id}]: ${p.description || 'No description'}
    Motivation: ${motivation || 'Not specified'}
    Project Mode: ${isRecurring ? '🔄 RECURRING (ongoing habit - no end goal)' : 'Completion-based'}
    ${isRecurring ? 'Focus: Consistency and habit-building, not finishing' : `Definition of Done: ${endGoal || 'Not specified - help user define completion'}`}
    ${!isRecurring ? `Progress: ${progress}% complete (${completedTasks.length}/${totalTasks} tasks done)` : `Sessions completed: ${completedTasks.length} tasks done historically`}
    Completed Tasks: ${completedList}
    Remaining Tasks (${totalIncomplete}/12 slots used): ${unfinishedList}
    Available Slots for New Tasks: ${slotsAvailable}`

        // Add dormancy context - this is key for re-engagement
        if (isVeryDormant) {
            context += `\n    💤 VERY DORMANT (${daysDormant} days since last session) - needs gentle re-engagement, not pressure`
            if (lastCompletedTask) {
                context += `\n    Last completed: "${lastCompletedTask.text}"`
            }
        } else if (isDormant) {
            context += `\n    😴 DORMANT (${daysDormant} days since last session) - help user reconnect with why this mattered`
            if (lastCompletedTask) {
                context += `\n    Last completed: "${lastCompletedTask.text}"`
            }
        }

        // Add stale task warning if any
        if (staleTasks.length > 0) {
            context += `\n    ⚠️ STALE TASKS (>14 days old, may need review): ${staleTasks.join(', ')}`
        }

        // Add rejected suggestions to avoid repeating
        if (rejectedSuggestions.length > 0) {
            context += `\n    🚫 DO NOT SUGGEST (user removed these before): ${rejectedSuggestions.slice(-10).join(', ')}`
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

    // Build valid fuel IDs for validation
    const validFuelIds = new Set(fuel?.map(f => f.id) || [])

    const prompt = `Generate Power Hour plans (50 min) for projects. Each project has semantically matched fuel/inspiration.

PROJECTS (with relevant fuel/inspiration):
${projectsContext}

Create 3-5 tasks per project moving toward "Definition of Done". Prioritize existing tasks.

RULES:
- Use exact project_id
- Session Summary: 2 sentences on motivation & goal
- Respect "Available Slots for New Tasks"
- Avoid 🚫 items (user rejected)
- Address ⚠️ STALE TASKS
- 70%+ progress: FINISH. <30%: quick wins
- 🔄 RECURRING: habits, not completion
- 😴/💤 DORMANT: 25-30 min, easy start, offer archive option
- No duplicates
- Minutes: 5/15/25/45. Total: 40-55
- Use provided fuel IDs only

JSON:
{"tasks":[{"project_id":"uuid","project_title":"str","task_title":"str","task_description":"str","session_summary":"str","checklist_items":[{"text":"str","is_new":bool,"estimated_minutes":num}],"total_estimated_minutes":num,"impact_score":0-1,"fuel_id":"str|null","fuel_title":"str|null"}]}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    console.log('[PowerHour] Raw Gemini response (first 500 chars):', responseText.substring(0, 500))
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const tasksData = jsonMatch ? JSON.parse(jsonMatch[0]) : { tasks: [] }
    console.log('[PowerHour] Parsed tasks data:', JSON.stringify(tasksData, null, 2))

    // 4. Validate Fuel IDs, Duration Estimates & Cleanup
    const validDurations = [5, 15, 25, 45]

    const validatedTasks: PowerHourTask[] = tasksData.tasks.map((task: any) => {
        let validFuelId = task.fuel_id
        let validFuelTitle = task.fuel_title

        if (validFuelId && !validFuelIds.has(validFuelId)) {
            console.warn('[PowerHour] Removing hallucinated fuel_id:', validFuelId)
            validFuelId = undefined
            validFuelTitle = undefined
        }

        // Validate and normalize duration estimates for each checklist item
        const validatedItems = (task.checklist_items || []).map((item: any) => {
            let estimatedMinutes = item.estimated_minutes

            // If missing or invalid, assign a reasonable default based on is_new
            if (typeof estimatedMinutes !== 'number' || !validDurations.includes(estimatedMinutes)) {
                // Default: 15 min for existing tasks, 25 min for new suggestions
                estimatedMinutes = item.is_new ? 25 : 15
                console.warn(`[PowerHour] Fixed invalid duration for "${item.text}": ${estimatedMinutes}min`)
            }

            return {
                ...item,
                estimated_minutes: estimatedMinutes
            }
        })

        // Calculate total estimated minutes
        const totalEstimatedMinutes = validatedItems.reduce(
            (sum: number, item: any) => sum + (item.estimated_minutes || 15),
            0
        )

        // Look up dormancy info for this project
        const project = projects.find(p => p.id === task.project_id)
        const lastActiveDate = project?.last_active ? new Date(project.last_active).getTime() : now
        const daysDormant = Math.floor((now - lastActiveDate) / (1000 * 60 * 60 * 24))
        const isDormant = daysDormant >= 14

        return {
            ...task,
            checklist_items: validatedItems,
            total_estimated_minutes: totalEstimatedMinutes,
            fuel_id: validFuelId,
            fuel_title: validFuelTitle,
            is_dormant: isDormant,
            days_dormant: daysDormant
        }
    })

    console.log('[PowerHour] Validated tasks with durations:', validatedTasks.map(t => ({
        project: t.project_title,
        total_minutes: t.total_estimated_minutes,
        is_dormant: t.is_dormant,
        days_dormant: t.days_dormant,
        items: t.checklist_items.map((i: any) => `${i.text} (${i.estimated_minutes}min)`)
    })))

    return validatedTasks
}
