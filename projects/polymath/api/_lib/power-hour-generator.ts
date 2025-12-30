
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

export async function generatePowerHourPlan(userId: string, projectId?: string, durationMinutes: number = 60, deviceContext: 'mobile' | 'desktop' = 'desktop'): Promise<PowerHourTask[]> {
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

        // Analyze task completion patterns (what works for this user)
        const completedWithTiming = completedTasks.filter((t: any) => t.created_at && t.completed_at)
        const quickWins = completedWithTiming.filter((t: any) => {
            const created = new Date(t.created_at).getTime()
            const completed = new Date(t.completed_at).getTime()
            return (completed - created) < (24 * 60 * 60 * 1000) // Completed same day
        }).slice(-3).map((t: any) => t.text)

        const draggedTasks = completedWithTiming.filter((t: any) => {
            const created = new Date(t.created_at).getTime()
            const completed = new Date(t.completed_at).getTime()
            return (completed - created) > (7 * 24 * 60 * 60 * 1000) // Took over a week
        }).slice(-3).map((t: any) => t.text)

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

        // Get last session context for continuity
        const lastSession = p.metadata?.last_session

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
    ${quickWins.length > 0 ? `- Quick wins (completed same day): ${quickWins.join(', ')}` : ''}
    ${draggedTasks.length > 0 ? `- Tasks that dragged (>1 week): ${draggedTasks.join(', ')} - suggest smaller alternatives` : ''}

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

        // Add last session context for continuity
        if (lastSession) {
            const sessionAge = Math.floor((now - new Date(lastSession.started_at).getTime()) / (1000 * 60 * 60 * 24))
            if (sessionAge < 7) { // Only show if within last week
                context += `\n    📍 LAST SESSION (${sessionAge === 0 ? 'today' : sessionAge === 1 ? 'yesterday' : `${sessionAge} days ago`}):`
                context += `\n       - Outcome: "${lastSession.session_outcome}"`
                if (lastSession.parking_tasks?.length > 0) {
                    context += `\n       - Parked for next time: ${lastSession.parking_tasks.join(', ')}`
                }
            }
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
   - Think: "What can be DONE AND DUSTED in 25 minutes?"

   PROJECT-TYPE SPECIFIC GUIDANCE FOR 25m:
   - ART: Reference hunting, buying supplies online, color palette planning, technique research, cleaning/organizing tools
   - TECH: Code review, bug triage, writing docs, PR reviews, dependency updates, reading/commenting on specs
   - WRITING: Outlining, research, editing a section, brainstorming, character notes, world-building notes
   - CREATIVE: Mood boards, inspiration collection, planning, quick sketches (if tools already out)

   NEVER FOR 25m:
   - "Start painting...", "Begin building...", "Set up and work on..."
   - Any task requiring physical setup (studio, materials, equipment)
   - Tasks that will feel incomplete when time runs out

   OUTPUT: 1-2 checklist items MAX. Quality over quantity.`
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
Device: ${deviceContext}
${deviceContext === 'mobile' ? '⚠️ MOBILE USER: Only suggest tasks achievable on a phone (no studio work, no physical materials, no desktop-only software)' : ''}
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

TASK PATTERN LEARNING:
If quick wins are shown: suggest similar-sized, actionable tasks
If dragged tasks are shown: break down similar tasks into smaller pieces - the user struggles with large/vague tasks

COMPLETION PROXIMITY RULES:
- If progress is 0-30% (Early): Focus on momentum-building, quick wins
- If progress is 30-70% (Middle): Focus on core work, steady progress
- If progress is 70-90% (Approaching): Focus on clearing blockers, polishing
- If progress is 90%+ (Final Stretch): FINISH IT. No new tasks, only completion tasks
  - Do NOT expand scope
  - Do NOT suggest "nice to haves"
  - Only suggest what closes the remaining gap to "done"

SETUP TIME ACCOUNTING (for Art/Hardware projects):
- Setup typically takes 15-20 minutes
- 60m session with setup = ~40m of actual work
- Only suggest physical work if duration allows for setup + meaningful work + cleanup
- For ${durationMinutes}m: ${durationMinutes <= 25 ? 'NO physical setup - not enough time' : durationMinutes <= 60 ? 'Minimal setup only if absolutely necessary' : 'Full setup acceptable'}

TASK SPECIFICITY REQUIREMENTS:
Every task must be SPECIFIC and MEASURABLE. The user should know exactly when it's done.

BANNED PHRASES (vague, unactionable):
- "Work on...", "Continue...", "Make progress on..."
- "Start...", "Begin...", "Get started with..."
- "Think about...", "Consider...", "Look into..."
- "Improve...", "Enhance...", "Refine..." (without specifics)

REQUIRED PATTERNS (specific, completable):
- "Complete [specific thing]" - what exactly?
- "Write [X words/pages/section]" - measurable output
- "Fix [specific bug/issue]" - clear success criteria
- "Research and decide on [X vs Y]" - decision made = done
- "Order [specific item]" - action complete when ordered

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

=== SESSION CONTINUITY ===
If the project has LAST SESSION context:
- Check if parked tasks are still relevant - pick up where they left off
- Build on the previous session's outcome, don't repeat it
- If they completed something yesterday, suggest the natural next step

=== TASK DEPENDENCIES ===
Check remaining tasks for logical order:
- Some tasks can't start until others are done (sketch before paint, plan before build)
- If a blocker task exists in the list, suggest it first
- Don't suggest "paint the canvas" if "buy paints" is still incomplete

=== SESSION ARC STRUCTURE ===
1. IGNITION (2-5m): Quick mental/physical warm-up
2. THE FLOW: The core outcome work
3. PARKING (3-5m): Clean close and prep for next time

=== OUTPUT FORMAT ===
${durationMinutes === 25
    ? `Generate 1 session for the MOST RELEVANT project only.
   - 25m Spark sessions = single project focus, no context switching
   - Pick the project that has the clearest quick-win opportunity`
    : `Generate sessions for up to 3 projects (prioritize by last_active).`}

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
