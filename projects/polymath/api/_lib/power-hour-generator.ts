
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
        const totalTasks = allTasks.length

        // Calculate project progress and phase
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0
        const projectPhase = progressPercent === 0 ? 'Just Started'
            : progressPercent < 30 ? 'Early Stage'
            : progressPercent < 70 ? 'Making Progress'
            : progressPercent < 90 ? 'Approaching Completion'
            : 'Final Stretch'

        // Calculate recent momentum (tasks completed in last 7 days)
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
        const recentCompletions = completedTasks.filter((t: any) =>
            t.completed_at && new Date(t.completed_at).getTime() > sevenDaysAgo
        ).length

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

    📊 PROJECT ROADMAP:
    - Phase: ${projectPhase} (${progressPercent}% complete, ${completedTasks.length}/${totalTasks} tasks done)
    - Recent Momentum: ${recentCompletions} task${recentCompletions === 1 ? '' : 's'} completed in last 7 days
    ${lastCompletedTask ? `- Last Achievement: "${lastCompletedTask.text}"` : ''}

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

    // Duration-specific session philosophy
    const sessionPhilosophy = durationMinutes === 25
        ? `SPARK SESSION (25m) - MICRO-OUTCOME PHILOSOPHY:
   This is a SHORT, DISCRETE session. The user will FINISH and walk away.

   CRITICAL RULES FOR 25-MINUTE SESSIONS:
   - Design ONE small, completable outcome - not a step in a larger task
   - NEVER suggest setup-heavy tasks (getting out paints, setting up equipment)
   - NEVER suggest tasks that "start" something that needs continuation
   - ONLY suggest: planning, research, digital tasks, quick decisions, ordering supplies, brainstorming
   - Think: "What can be DONE AND DUSTED in 25 minutes?"
   - Examples of GOOD 25m tasks: "Research 3 brush options and pick one to order", "Outline the next chapter", "Review and comment on draft"
   - Examples of BAD 25m tasks: "Start painting the background", "Set up studio and begin work", "Continue the illustration"

   OUTPUT: 1-2 checklist items MAX. Quality over quantity. The session should feel achievable, not overwhelming.`
        : durationMinutes === 150
        ? `DEEP DIVE (150m) - IMMERSIVE OUTCOME PHILOSOPHY:
   This is an extended, focused session for substantial progress.

   CRITICAL RULES FOR DEEP DIVES:
   - Design ONE substantial, meaningful outcome that moves the project forward significantly
   - Setup time is acceptable - the user has runway
   - Include proper warm-up, deep work, cool-down arc
   - Think in terms of "project milestones" not "task lists"
   - This should represent meaningful progress toward the Definition of Done

   OUTPUT: 3-5 checklist items representing a coherent work block, not disconnected tasks.`
        : `POWER HOUR (60m) - FOCUSED OUTCOME PHILOSOPHY:
   This is a focused work session for real progress.

   CRITICAL RULES FOR POWER HOURS:
   - Design ONE clear outcome that the user can point to when done
   - If setup is needed (Art, Hardware), account for it in the time budget
   - 60 minutes with 15m setup = only 45m of actual work - plan accordingly
   - The outcome should be substantial but achievable
   - Think: "What's the ONE thing they'll have accomplished?"

   OUTPUT: 2-4 checklist items representing focused progress, not a scattered to-do list.`

    const prompt = `You are the APERTURE SHERPA. Your goal is to design a DISCRETE, ACHIEVABLE work session with ONE clear outcome.

=== SESSION PARAMETERS ===
Duration: ${durationMinutes} minutes
${sessionPhilosophy}

=== AVAILABLE PROJECTS ===
${projectsContext}

=== DESIGN PHILOSOPHY ===

THINK ABOUT THE PROJECT HOLISTICALLY:
For each project, consider:
1. What is the Definition of Done? What does "finished" look like?
2. Where is the user in the project journey? (just started, middle, near completion)
3. What's the logical NEXT step to move toward completion?
4. What can realistically be ACHIEVED (not just started) in ${durationMinutes} minutes?

DO NOT JUST LIST TASKS:
- Bad: "Work on painting", "Continue writing", "Make progress on feature"
- Good: "Complete the sky gradient section", "Write and polish the opening paragraph", "Implement and test the login validation"

DISCRETE SESSIONS:
Each session should feel complete on its own. The user should be able to:
- Start the session
- Do the work
- Finish with something DONE
- Walk away satisfied

A ${durationMinutes}-minute session should NOT:
- Leave the user mid-task needing to continue
- Create anxiety about unfinished work
- Suggest more than can reasonably be completed
- Include setup time for physical tasks unless duration allows (60m+)

=== SESSION ARC STRUCTURE ===
1. IGNITION (2-5m): Quick mental/physical warm-up
2. THE FLOW: The core outcome work
3. PARKING (3-5m): Clean close and prep for next time

=== OUTPUT FORMAT ===
Generate sessions for up to 3 projects (prioritize by last_active).

{
  "tasks": [
    {
      "project_id": "string",
      "project_title": "string",
      "task_title": "string (The discrete OUTCOME, not activity - e.g., 'Complete the hero section' not 'Work on homepage')",
      "task_description": "string (What will be DONE when this session ends)",
      "session_summary": "string (Joyful vision: 'By the end, you'll have...')",
      "overhead_type": "Mental" | "Physical" | "Tech" | "Digital",
      "ignition_tasks": [ { "text": "string", "is_new": true, "estimated_minutes": number } ],
      "checklist_items": [ { "text": "string", "is_new": boolean, "estimated_minutes": number } ],
      "shutdown_tasks": [ { "text": "string", "is_new": true, "estimated_minutes": number } ],
      "impact_score": 0.1-1.0 (how much this moves the project toward completion),
      "fuel_id": "string (optional - if relevant reading exists)",
      "fuel_title": "string (optional)"
    }
  ]
}

REMEMBER: The user wants to ACCOMPLISH something in ${durationMinutes} minutes, not receive a list of everything that needs doing. Design for achievement, not overwhelm.`

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
