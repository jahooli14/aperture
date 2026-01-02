import { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { generatePowerHourPlan } from './_lib/power-hour-generator.js'
import {
    shouldUseCachedPowerHour,
    savePowerHourCache,
    canRegenerateProject,
    markProjectRegenerated
} from './_lib/power-hour-cache.js'

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
        // 1. Check for cached plan using smart cache manager
        const { useCache, cachedTasks, source } = await shouldUseCachedPowerHour(
            userId,
            targetProject,
            isRefresh
        )

        if (useCache && cachedTasks) {
            console.log(`[power-hour] Returning cached plan (source: ${source})`)
            return res.status(200).json({ tasks: cachedTasks, cached: true })
        }

        // 1b. Rate limiting: Check if we can regenerate this project
        if (targetProject && !canRegenerateProject(targetProject)) {
            console.log('[power-hour] Rate limited - regenerated too recently')
            // Return empty or old cache with warning
            return res.status(429).json({
                error: 'Power Hour for this project was regenerated recently. Please wait before refreshing again.',
                cached: false
            })
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

        // 4. Cache the generated plan using smart cache manager
        if (tasks.length > 0) {
            await savePowerHourCache(userId, tasks, targetProject)

            // Mark project as regenerated for rate limiting
            if (targetProject) {
                markProjectRegenerated(targetProject)
            }
        }

        return res.status(200).json({ tasks, cached: false })

    } catch (error) {
        console.error('Power Hour Error:', error)
        return res.status(500).json({ error: 'Failed to generate Power Hour tasks', details: error instanceof Error ? error.message : String(error) })
    }
}
