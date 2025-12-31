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
        // 1. Check for cached plan
        // A. Project-Specific Cache (from separate suggestions field)
        if (targetProject && !isRefresh) {
            const { data: project } = await supabase
                .from('projects')
                .select('metadata')
                .eq('id', targetProject)
                .single()

            const suggested = project?.metadata?.suggested_power_hour_tasks
            const timestamp = project?.metadata?.suggested_power_hour_timestamp

            if (suggested && timestamp) {
                const age = Date.now() - new Date(timestamp).getTime()
                // Valid if < 20 hours old
                if (age < 20 * 60 * 60 * 1000) {
                    console.log('[power-hour] Returning project-specific suggestions from metadata')
                    return res.status(200).json({ tasks: suggested, cached: true })
                }
            }
        }

        // B. Daily Global Cache (if not targeting a specific project)
        if (!isRefresh && !targetProject) {
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

        // 3. Proactive Enrichment: If enrich is true, save suggestions to metadata (BUT DON'T ADD TO MAIN LIST)
        if (req.query.enrich === 'true' && targetProject) {
            if (tasks.length === 0) {
                console.log('[power-hour] No tasks generated, skipping enrichment')
            } else {
                console.log('[power-hour] Saving suggestions for project:', targetProject)

                // Fetch current metadata to preserve other fields
                const { data: project } = await supabase
                    .from('projects')
                    .select('metadata')
                    .eq('id', targetProject)
                    .single()

                if (project) {
                    // Extract the specific task plan for this project
                    // The generator returns an array of tasks (one per project usually, or multiple if general)
                    // If focusing on targetProject, tasks should contain just that one, or we find it
                    const matchingTask = tasks.find(t =>
                        t.project_id === targetProject ||
                        t.project_id?.toLowerCase() === targetProject.toLowerCase()
                    ) || tasks[0] // Fallback to first if only one generated

                    if (matchingTask) {
                        // We wrap it in an array to match the "tasks" structure the frontend expects for Power Hour
                        // (The Power Hour UI expects an array of plans, even if just one)
                        const suggestionsToSave = [matchingTask]

                        const { error: updateError } = await supabase
                            .from('projects')
                            .update({
                                metadata: {
                                    ...project.metadata,
                                    suggested_power_hour_tasks: suggestionsToSave,
                                    suggested_power_hour_timestamp: new Date().toISOString()
                                }
                            })
                            .eq('id', targetProject)

                        if (updateError) {
                            console.error(`[power-hour] Failed to save suggestions:`, updateError)
                        } else {
                            console.log(`[power-hour] Successfully saved suggestions to metadata.`)
                        }
                    }
                }
            }
        }

        // Cache it for next time (Global cache only if not specific project refresh? Or always?)
        // If we generated a general plan, cache it.
        // If we generated a specific project plan, we already saved it to metadata.
        if (!targetProject && tasks.length > 0) {
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
