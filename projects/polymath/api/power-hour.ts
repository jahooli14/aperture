import { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { generatePowerHourPlan } from './_lib/power-hour-generator.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const userId = getUserId()
    const supabase = getSupabaseClient()
    console.log('[power-hour] Fetching tasks for user:', userId)

    const { refresh, projectId, duration } = req.query
    const isRefresh = refresh === 'true' || !!projectId
    const targetProject = projectId as string | undefined
    const durationMinutes = duration ? parseInt(duration as string, 10) : 60

    // Detect device type from User-Agent (no frontend changes needed)
    const userAgent = req.headers['user-agent'] || ''
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(userAgent)
    const deviceContext = isMobile ? 'mobile' : 'desktop'

    try {
        // 1. Check for cached plan from today ( < 20 hours old )
        // Bypass if refresh=true
        if (!isRefresh) {
            const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()

            const { data: cached, error: cacheError } = await supabase
                .from('daily_power_hour')
                .select('*')
                .eq('user_id', userId)
                .gt('created_at', cutoff)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (cached && cached.tasks) {
                console.log('[power-hour] Returning cached plan from:', cached.created_at)
                return res.status(200).json({ tasks: cached.tasks, cached: true })
            }
        }

        // 2. No cache? Generate on the fly (and cache it)
        console.log('[power-hour] No cache found or forced refresh. Generating on-fly...')
        let tasks
        try {
            tasks = await generatePowerHourPlan(userId, targetProject, durationMinutes, deviceContext)
            console.log(`[power-hour] Generated ${tasks.length} power hour tasks`)
        } catch (error) {
            console.error('[power-hour] Error generating power hour plan:', error)
            return res.status(500).json({ error: 'Failed to generate power hour plan' })
        }

        // 3. Proactive Enrichment: If enrich is true, save new tasks immediately
        if (req.query.enrich === 'true' && targetProject) {
            if (tasks.length === 0) {
                console.log('[power-hour] No tasks generated, skipping enrichment')
            } else {
                console.log('[power-hour] Proactive enrichment triggered for project:', targetProject)
                const { data: project } = await supabase
                    .from('projects')
                    .select('metadata')
                    .eq('id', targetProject)
                    .single()

                if (project) {
                    const existingTasks = project.metadata?.tasks || []
                    const incompleteTasks = existingTasks.filter((t: any) => !t.done)
                    const existingTaskTexts = existingTasks.map((t: any) => t.text?.toLowerCase().trim())

                    // A. Task Cap Shield (Max 12 INCOMPLETE tasks)
                    if (incompleteTasks.length >= 12) {
                        console.log(`[power-hour] Project ${targetProject} at capacity (${incompleteTasks.length} incomplete tasks). Skipping enrichment.`)
                    } else {
                        // Find the matching task for this project (handle UUID matching flexibly)
                        const matchingTask = tasks.find(t =>
                            t.project_id === targetProject ||
                            t.project_id?.toLowerCase() === targetProject.toLowerCase()
                        )

                        if (!matchingTask) {
                            console.log(`[power-hour] No matching task found for project ${targetProject}. Available project_ids:`, tasks.map(t => t.project_id))
                        }

                        const allItems = matchingTask?.checklist_items || []
                        console.log(`[power-hour] All checklist items (${allItems.length}):`, allItems)

                        // Check for is_new (handle both boolean true and string "true")
                        let newItems = allItems.filter((i: any) => i.is_new === true || i.is_new === 'true')

                        // FALLBACK: If no items marked as is_new, try to infer new items
                        // by checking if they don't exist in current tasks
                        if (newItems.length === 0 && allItems.length > 0) {
                            console.log(`[power-hour] No is_new=true items found. Using fallback: inferring new tasks...`)

                            // Infer new tasks as those that don't match existing tasks
                            newItems = allItems.filter((item: any) => {
                                const itemText = item.text?.toLowerCase().trim()
                                const isExisting = existingTaskTexts.some((existing: string) => {
                                    if (!existing || !itemText) return false
                                    return existing === itemText ||
                                        existing.includes(itemText) ||
                                        itemText.includes(existing)
                                })
                                return !isExisting
                            })

                            console.log(`[power-hour] Fallback inferred ${newItems.length} new tasks from ${allItems.length} total`)
                        }

                        console.log(`[power-hour] Found ${newItems.length} new items to potentially add:`, newItems.map((i: any) => i.text))

                        if (newItems.length > 0) {
                            // B. SMART STUB REPLACEMENT (Refinement over Duplication)
                            // Instead of complex math, we look for "Stubs" that the AI has expanded.
                            // e.g. "1" -> "1. Research API" or "fix bug" -> "Fix bug in saving logic"

                            const tasksToCreate: any[] = []
                            const tasksToUpdate: any[] = []

                            for (const newItem of newItems) {
                                const newText = newItem.text?.trim() || ''
                                if (!newText) continue

                                // Check for stub match in existing tasks
                                // A "Stub" is an existing task that is:
                                // 1. A prefix of the new task (e.g. "Research" vs "Research API")
                                // 2. A number matching the start (e.g. "1" vs "1. Do thing")
                                // 3. Very short (< 15 chars) and contained in the new task
                                const stubMatch = existingTasks.find((t: any) => {
                                    const oldText = t.text?.trim() || ''
                                    if (!oldText) return false

                                    // Exact duplicate? Skip it (already exists)
                                    if (oldText.toLowerCase() === newText.toLowerCase()) return true

                                    // Is it a number stub? (e.g. "1" matching "1. ...")
                                    if (/^\d+\.?$/.test(oldText)) {
                                        return newText.startsWith(oldText)
                                    }

                                    // Is it a short text stub?
                                    if (oldText.length < 20 && newText.toLowerCase().includes(oldText.toLowerCase())) {
                                        return true
                                    }

                                    return false
                                })

                                if (stubMatch) {
                                    // If exact match, do nothing (it's already there)
                                    if (stubMatch.text.toLowerCase() === newText.toLowerCase()) {
                                        console.log(`[power-hour] Exact match found, skipping: "${newText}"`)
                                        continue
                                    }

                                    // If it's a stub, we UPDATE the existing task
                                    console.log(`[power-hour] Refining stub "${stubMatch.text}" -> "${newText}"`)
                                    stubMatch.text = newText
                                    if (newItem.estimated_minutes) stubMatch.estimated_minutes = newItem.estimated_minutes
                                    if (newItem.ai_reasoning) stubMatch.ai_reasoning = newItem.ai_reasoning // If generator provides it
                                    stubMatch.is_ai_suggested = true

                                    tasksToUpdate.push({
                                        id: stubMatch.id,
                                        text: newText,
                                        estimated_minutes: newItem.estimated_minutes
                                    })
                                } else {
                                    // It's genuinely new
                                    tasksToCreate.push(newItem)
                                }
                            }

                            // 1. Perform Updates (Refine existing stubs)
                            if (tasksToUpdate.length > 0) {
                                console.log(`[power-hour] Updating ${tasksToUpdate.length} existing tasks...`)
                                // In-memory update is already done on 'existingTasks' via 'stubMatch' reference
                            }

                            // 2. Append New Tasks
                            const slotsRemaining = Math.max(0, 12 - incompleteTasks.length)
                            const safeToAdd = tasksToCreate.slice(0, slotsRemaining)

                            if (safeToAdd.length > 0) {
                                const freshTasks = safeToAdd.map((item, idx) => ({
                                    id: crypto.randomUUID(),
                                    text: item.text,
                                    done: false,
                                    created_at: new Date().toISOString(),
                                    order: existingTasks.length + idx,
                                    is_ai_suggested: true,
                                    estimated_minutes: item.estimated_minutes || 15,
                                    ai_reasoning: "Suggested by Power Hour AI to fill gaps."
                                }))

                                // Add to our memory list
                                existingTasks.push(...freshTasks)
                                console.log(`[power-hour] Adding ${freshTasks.length} new tasks`)
                            }

                            // 3. Save the Unified List (Updates + New)
                            if (tasksToUpdate.length > 0 || safeToAdd.length > 0) {
                                const { error: updateError } = await supabase
                                    .from('projects')
                                    .update({
                                        metadata: {
                                            ...project.metadata,
                                            tasks: existingTasks
                                        }
                                    })
                                    .eq('id', targetProject)

                                if (updateError) {
                                    console.error(`[power-hour] Failed to update project tasks:`, updateError)
                                } else {
                                    console.log(`[power-hour] Successfully synced project tasks.`)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Cache it for next time
        if (tasks.length > 0) {
            await supabase.from('daily_power_hour').insert({
                user_id: userId,
                tasks: tasks,
                created_at: new Date().toISOString()
            })
        }

        return res.status(200).json({ tasks })

    } catch (error) {
        console.error('Power Hour Error:', error)
        return res.status(500).json({ error: 'Failed to generate Power Hour tasks', details: error instanceof Error ? error.message : String(error) })
    }
}
