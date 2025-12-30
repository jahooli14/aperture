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
                        // B. Enhanced De-Duplication Logic (syntactic + semantic)

                        // Extract core action words (verbs/nouns) for semantic matching
                        const extractKeywords = (text: string): Set<string> => {
                            const stopWords = new Set(['the', 'a', 'an', 'to', 'for', 'of', 'and', 'or', 'in', 'on', 'at', 'up', 'out', 'with', 'this', 'that', 'it', 'is', 'be', 'do', 'does', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall'])
                            const words = text.toLowerCase()
                                .replace(/[^a-z0-9\s]/g, ' ')
                                .split(/\s+/)
                                .filter(w => w.length > 2 && !stopWords.has(w))
                            return new Set(words)
                        }

                        // Calculate keyword overlap ratio
                        const keywordOverlap = (a: string, b: string): number => {
                            const setA = extractKeywords(a)
                            const setB = extractKeywords(b)
                            if (setA.size === 0 || setB.size === 0) return 0

                            let overlap = 0
                            for (const word of setA) {
                                if (setB.has(word)) overlap++
                            }
                            // Return the higher ratio (overlap relative to smaller set)
                            const minSize = Math.min(setA.size, setB.size)
                            return overlap / minSize
                        }

                        const isSimilar = (a: string, b: string) => {
                            const s1 = a.toLowerCase().trim()
                            const s2 = b.toLowerCase().trim()
                            if (s1 === s2) return true
                            if (s1.includes(s2) || s2.includes(s1)) return true

                            // Check keyword overlap (semantic similarity)
                            // If 60%+ of keywords overlap, consider it a semantic duplicate
                            if (keywordOverlap(s1, s2) >= 0.6) {
                                console.log(`[power-hour] Semantic overlap detected: "${a}" vs "${b}"`)
                                return true
                            }

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

                        // Only add what fits under the cap (12 incomplete tasks max)
                        // STRICT ENFORCEMENT: Never exceed 12 incomplete tasks total
                        const slotsRemaining = Math.max(0, 12 - incompleteTasks.length)
                        const tasksToAdd = uniqueNewTasks.slice(0, slotsRemaining)

                        console.log(`[power-hour] Slots remaining: ${slotsRemaining} (${incompleteTasks.length}/12 incomplete), will add ${tasksToAdd.length} tasks`)

                        // Safety check: Skip entirely if at or over capacity
                        if (slotsRemaining <= 0) {
                            console.log(`[power-hour] Project at capacity, skipping task addition`)
                        }

                        if (tasksToAdd.length > 0) {
                            const freshTasks = tasksToAdd.map((item, idx) => ({
                                id: crypto.randomUUID(),
                                text: item.text,
                                done: false,
                                created_at: new Date().toISOString(),
                                order: existingTasks.length + idx,
                                is_ai_suggested: true // Mark as AI-suggested task
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
