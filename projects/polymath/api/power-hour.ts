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

    const { refresh, projectId } = req.query
    const isRefresh = refresh === 'true' || !!projectId
    const targetProject = projectId as string | undefined

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
            tasks = await generatePowerHourPlan(userId, targetProject)
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

                // A. Task Cap Shield (Max 12 tasks)
                if (existingTasks.length >= 12) {
                    console.log(`[power-hour] Project ${targetProject} at capacity (${existingTasks.length} tasks). Skipping enrichment.`)
                } else {
                    const newItems = tasks
                        .find(t => t.project_id === targetProject)
                        ?.checklist_items?.filter(i => i.is_new) || []

                    console.log(`[power-hour] Found ${newItems.length} new items to potentially add:`, newItems.map(i => i.text))

                    if (newItems.length === 0) {
                        console.log(`[power-hour] No new items marked as is_new=true. Check AI response.`)
                        const allItems = tasks.find(t => t.project_id === targetProject)?.checklist_items || []
                        console.log(`[power-hour] All checklist items (${allItems.length}):`, allItems)
                    }

                    if (newItems.length > 0) {
                        // B. De-Duplication Logic
                        const isSimilar = (a: string, b: string) => {
                            const s1 = a.toLowerCase().trim()
                            const s2 = b.toLowerCase().trim()
                            if (s1 === s2) return true
                            if (s1.includes(s2) || s2.includes(s1)) return true

                            // Simple Levenshtein for typos/minor phrasing diffs
                            const track = Array(s2.length + 1).fill(null).map(() =>
                                Array(s1.length + 1).fill(null))
                            for (let i = 0; i <= s1.length; i += 1) track[0][i] = i
                            for (let j = 0; j <= s2.length; j += 1) track[j][0] = j
                            for (let j = 1; j <= s2.length; j += 1) {
                                for (let i = 1; i <= s1.length; i += 1) {
                                    const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1
                                    track[j][i] = Math.min(
                                        track[j][i - 1] + 1,
                                        track[j - 1][i] + 1,
                                        track[j - 1][i - 1] + indicator,
                                    )
                                }
                            }
                            const distance = track[s2.length][s1.length]
                            const maxLength = Math.max(s1.length, s2.length)
                            // If difference is less than 30% of length, call it a duplicate
                            return distance < (maxLength * 0.3)
                        }

                        // Filter out duplicates against ALL existing tasks
                        const uniqueNewTasks = newItems.filter(newItem => {
                            const duplicate = existingTasks.some((existing: any) => isSimilar(existing.text, newItem.text))
                            if (duplicate) console.log(`[power-hour] Deduped: "${newItem.text}"`)
                            return !duplicate
                        })

                        console.log(`[power-hour] After deduplication: ${uniqueNewTasks.length} unique tasks remain`)

                        // Only add what fits under the cap
                        const slotsRemaining = 12 - existingTasks.length
                        const tasksToAdd = uniqueNewTasks.slice(0, slotsRemaining)

                        console.log(`[power-hour] Slots remaining: ${slotsRemaining}, will add ${tasksToAdd.length} tasks`)

                        if (tasksToAdd.length > 0) {
                            const freshTasks = tasksToAdd.map((item, idx) => ({
                                id: crypto.randomUUID(),
                                text: item.text,
                                done: false,
                                created_at: new Date().toISOString(),
                                order: existingTasks.length + idx
                            }))

                            const { error: updateError } = await supabase
                                .from('projects')
                                .update({
                                    metadata: {
                                        ...project.metadata,
                                        tasks: [...existingTasks, ...freshTasks]
                                    }
                                })
                                .eq('id', targetProject)

                            if (updateError) {
                                console.error(`[power-hour] Failed to update project ${targetProject}:`, updateError)
                            } else {
                                console.log(`[power-hour] Enriched project ${targetProject} with ${freshTasks.length} new tasks.`)
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
