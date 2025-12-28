
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
        .select('id, title, description, status, metadata, last_active')
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

    // 2b. Fetch recent list items (Inspiration - films, books, etc.)
    // Cross-pollination: "Rothko documentary" → inspires "paint pouring project"
    const { data: listInspiration, error: listError } = await supabase
        .from('list_items')
        .select('id, content, metadata, list_id')
        .eq('user_id', userId)
        .eq('enrichment_status', 'complete')
        .order('created_at', { ascending: false })
        .limit(10)

    if (listError) console.warn('[PowerHour] Failed to fetch list inspiration:', listError)

    // 3. Use Gemini 1.5 Flash to synthesize Power Hour suggestions
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

    const now = Date.now()

    const projectsContext = projects.map(p => {
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

        return context
    }).join('\n')

    const validFuelIds = new Set(fuel?.map(f => f.id) || [])
    const fuelContext = fuel?.slice(0, 5).map(f => `- ${f.title} [ID: ${f.id}]: ${f.excerpt}`).join('\n') || 'No new fuel available.'

    // Build inspiration context from list items
    const inspirationContext = listInspiration?.slice(0, 5).map(item => {
        const meta = item.metadata || {}
        return `- ${item.content}: ${meta.subtitle || ''} ${meta.description ? `(${meta.description})` : ''}`
    }).join('\n') || 'No recent list items.'

    const prompt = `You are the APERTURE ENGINE. Your goal is JOYOUS MOMENTUM toward COMPLETION.
It is a "Power Hour" - 50 minutes of focused work (with 10 min buffer for planning/wrap-up).

CURRENT PROJECTS:
${projectsContext}

AVAILABLE FUEL (Reading Material):
${fuelContext}

RECENT INSPIRATION (Films, Books, etc. the user has saved):
${inspirationContext}
Use this as creative cross-pollination - a film about an artist might inspire techniques for a painting project, etc.

TASK:
Generate Power Hour session plans for each project above.
Each plan must be a joyous, motivating blueprint for ~50 minutes of focused work that MOVES THE PROJECT TOWARD COMPLETION.

GOAL-DRIVEN PRINCIPLE:
Look at each project's "Definition of Done" - this is the finish line. Every task you suggest should be a step TOWARD that finish line. If no Definition of Done is specified, infer what "done" would logically mean and help the user get there.

DO NOT suggest busywork. DO NOT add tasks for the sake of filling time. Every task should either:
- Move directly toward the Definition of Done, OR
- Remove a blocker preventing progress, OR
- Be an essential prerequisite for future work

For each plan:
1. Select a focus project (use the exact project_id from the list above).
2. Create a "Task Title" (the core theme of the session - should relate to the Definition of Done).
3. Create a "Task Description" (the high-level mission - how this session advances toward completion).
4. Create a "Session Summary" - A 2-sentence motivating vision that explicitly connects to the project's Motivation and Definition of Done. Show the user WHY these tasks matter and HOW they get closer to "done".
5. Create a "Checklist Hit-List" with 3-5 tasks:
   - Include any relevant existing unfinished tasks from the project (set is_new: false)
   - Add NEW suggested tasks (is_new: true) ONLY if "Available Slots for New Tasks" > 0
   - The number of new tasks MUST NOT exceed the "Available Slots for New Tasks" shown for that project
   - New tasks should DIRECTLY ADVANCE toward the Definition of Done
   - New tasks should be concrete, actionable steps starting with verbs
   - PRIORITIZE existing incomplete tasks over adding new ones - focus on FINISHING, not expanding scope

STALE TASK HANDLING:
- If a project has ⚠️ STALE TASKS listed, these have been incomplete for 14+ days
- Suggest revisiting stale tasks: either complete them OR recommend removing/updating them
- In session_summary, acknowledge if stale tasks are being addressed: "Let's finally tackle X that's been waiting..."

REJECTION MEMORY:
- If a project has 🚫 DO NOT SUGGEST items, NEVER suggest those tasks again
- The user has explicitly removed these before - suggesting them again would erode trust
- Instead, find genuinely different work that advances the goal

PROGRESS AWARENESS:
- Each project shows "Progress: X% complete"
- For projects at 70%+, focus on FINISHING - suggest the final push tasks
- For projects at <30%, focus on MOMENTUM - suggest quick wins to build confidence

RECURRING PROJECT MODE:
- Projects marked 🔄 RECURRING are ongoing habits (e.g., "Stay fit", "Learn Japanese")
- These have NO end goal - they are about CONSISTENCY, not completion
- For recurring projects:
  - Suggest habit/routine tasks: "30 min practice", "Review vocabulary", "Quick workout"
  - Focus on what to do THIS session, not driving toward "done"
  - Celebrate streak/consistency instead of completion percentage
  - Suggest variety to keep habits fresh (different exercises, new topics)

DORMANT PROJECT RECOVERY (CRITICAL FOR USER RE-ENGAGEMENT):
- Projects marked 😴 DORMANT or 💤 VERY DORMANT haven't been touched in 2+ weeks
- These need EXCITEMENT and RECONNECTION, not guilt or pressure
- For dormant projects, your session plan MUST:

  1. REFRAME AS REDISCOVERY:
     - Task Title should feel like returning to something beloved, not catching up
     - Examples: "Rediscover Your [Project]", "Fresh Eyes on [Project]", "Reconnect with [Project]"
     - NOT: "Catch up on [Project]", "Get back to [Project]", "Finally work on [Project]"

  2. REMIND THEM WHY:
     - Session Summary MUST reference their original Motivation
     - Connect to emotions: "Remember when you started this because [motivation]? That spark is still there."
     - Show what they've already accomplished to build confidence

  3. LOWER THE BAR:
     - For dormant projects, set total_estimated_minutes to 25-30 (NOT 50)
     - First task should be easy: "Review where you left off" (5 min)
     - Focus on ONE small win, not catching up on everything

  4. OFFER AN OUT (in session_summary):
     - Acknowledge it's okay if priorities changed
     - Example: "...or if this no longer sparks joy, today's a good day to archive it and free your mental space."

  5. SHOW CONTEXT:
     - If "Last completed" is shown, reference it: "You were making progress on X..."
     - Help them remember WHERE they were, not just WHAT to do

  Example session_summary for dormant project:
  "It's been a while since you touched [Project], and that's okay. You started this because [motivation], and you've already [progress]. Let's spend 25 minutes reconnecting - review where you left off and find one small win. Or if this no longer excites you, consider archiving it guilt-free."

DURATION ESTIMATION (REQUIRED for every checklist item):

Each task MUST include an "estimated_minutes" field. Use these buckets:
- 5 min: Quick tasks (send a message, make a small tweak, review something brief)
- 15 min: Short tasks (write a function, sketch an idea, research a topic)
- 25 min: Standard tasks (implement a feature, write a section, design a component)
- 45 min: Deep work (complex debugging, architectural decisions, creative flow work)

The total "total_estimated_minutes" for all checklist items should be 40-55 minutes (ideal: ~50).
If the total exceeds 55 minutes, remove lower-priority tasks until it fits.

CRITICAL RULES FOR NEW TASKS (is_new: true):

1. HARD CAP: Each project has a maximum of 12 incomplete tasks. Check "Available Slots for New Tasks" - if it's 0, DO NOT suggest any new tasks for that project.

2. NO SEMANTIC DUPLICATES: Before suggesting a new task, analyze the MEANING of every existing task (completed and remaining). Ask yourself:
   - "Does this new task describe the same work as an existing task, just worded differently?"
   - "Would completing this new task also complete an existing task, or vice versa?"
   If YES to either question, DO NOT suggest that task.

   Examples of DUPLICATE tasks to AVOID:
   - Existing: "Write tests" → DO NOT suggest: "Add unit tests", "Create test coverage", "Implement testing"
   - Existing: "Set up deployment" → DO NOT suggest: "Configure deployment pipeline", "Deploy to production"
   - Existing: "Design the UI" → DO NOT suggest: "Create user interface", "Build the frontend design"

3. GENUINELY NEW WORK ONLY: New tasks must represent work that is NOT covered by any existing task. They should fill GAPS - things the user hasn't thought of yet that will move the project forward.

4. PLAIN ENGLISH: Write tasks in simple, clear language. No jargon, no fancy rewording. If the user wrote "Make homepage", don't suggest "Architect the landing experience" - instead suggest something genuinely different like "Add contact form" or "Optimize images".

5. EVERY checklist item MUST have "is_new" as a boolean AND "estimated_minutes" as a number.

6. ONLY use Fuel Items from the list provided above. Do not invent articles.

7. If suggesting fuel, you MUST include the valid Fuel ID provided in square brackets.

8. If no relevant fuel exists, omit the fuel_id.

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
        { "text": "string", "is_new": true, "estimated_minutes": 25 },
        { "text": "string", "is_new": false, "estimated_minutes": 15 }
      ],
      "total_estimated_minutes": 50,
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
