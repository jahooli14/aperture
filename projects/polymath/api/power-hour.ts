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
        const tasks = await generatePowerHourPlan(userId, targetProject)

        // 3. Proactive Enrichment: If enrich is true, save new tasks immediately
        if (req.query.enrich === 'true' && targetProject && tasks.length > 0) {
            console.log('[power-hour] Proactive enrichment triggered for project:', targetProject)
            const { data: project } = await supabase
                .from('projects')
                .select('metadata')
                .eq('id', targetProject)
                .single()

            if (project) {
                const newItems = tasks
                    .find(t => t.project_id === targetProject)
                    ?.checklist_items?.filter(i => i.is_new) || []

                if (newItems.length > 0) {
                    const existingTasks = project.metadata?.tasks || []
                    const freshTasks = newItems.map((item, idx) => ({
                        id: crypto.randomUUID(),
                        text: item.text,
                        done: false,
                        created_at: new Date().toISOString(),
                        order: existingTasks.length + idx
                    }))

                    await supabase
                        .from('projects')
                        .update({
                            metadata: {
                                ...project.metadata,
                                tasks: [...existingTasks, ...freshTasks]
                            }
                        })
                        .eq('id', targetProject)

                    console.log(`[power-hour] Enriched project ${targetProject} with ${freshTasks.length} new tasks.`)
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
