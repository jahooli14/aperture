/**
 * Project Genesis Detector
 *
 * Scans for emergent project territory that the user is clearly building toward
 * but hasn't formalised yet. Two detection methods:
 *
 * 1. Theme clustering: 3+ memories sharing the same theme within 60 days,
 *    with no active project covering that territory.
 *
 * 2. Velocity spikes: a theme that has appeared more in the last 14 days
 *    than in the prior 46 days — a signal that something is heating up.
 *
 * Results are written as GeneratedInsight[] rows into synthesis_insights so the
 * ItemInsightStrip on reader/list pages can surface them.
 */

import { getSupabaseClient } from './supabase.js'

interface InsightData {
  evidence?: string[]
  recommendation?: string
  how_long?: string
  project_name?: string
  [key: string]: unknown
}

export interface GeneratedInsight {
  type: 'collision' | 'pattern' | 'evolution' | 'opportunity' | 'shadow_project'
  title: string
  description: string
  data: InsightData
  actionable: boolean
  action?: string
  is_new?: boolean
  status?: 'new' | 'strengthened' | 'evolved' | 'persistent'
  first_seen?: string
}

const LOOKBACK_DAYS = 60
const VELOCITY_WINDOW_DAYS = 14
const MIN_CLUSTER_SIZE = 3

interface ThemeCluster {
  theme: string
  count: number
  recentCount: number  // captures in the last VELOCITY_WINDOW_DAYS
  titles: string[]
  oldestDate: string
}

export async function detectProjectGenesis(userId: string): Promise<GeneratedInsight[]> {
  const supabase = getSupabaseClient()

  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)

  const velocityCutoff = new Date()
  velocityCutoff.setDate(velocityCutoff.getDate() - VELOCITY_WINDOW_DAYS)

  const [memoriesResult, projectsResult] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, themes, created_at')
      .eq('user_id', userId)
      .eq('processed', true)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('title, description, status')
      .eq('user_id', userId)
      .in('status', ['active', 'paused']),
  ])

  const memories = memoriesResult.data || []
  const projects = projectsResult.data || []

  if (memories.length < MIN_CLUSTER_SIZE) return []

  // Build a single lowercase string of all project content for coverage checking
  const projectCoverage = projects
    .map(p => `${p.title} ${p.description || ''}`.toLowerCase())
    .join(' ')

  // Aggregate theme clusters
  const clusters = new Map<string, ThemeCluster>()

  for (const memory of memories) {
    const isRecent = new Date(memory.created_at) >= velocityCutoff

    for (const theme of memory.themes || []) {
      const key = theme.toLowerCase().trim()
      if (!key) continue

      const existing = clusters.get(key) ?? {
        theme: key,
        count: 0,
        recentCount: 0,
        titles: [] as string[],
        oldestDate: memory.created_at,
      }

      existing.count++
      if (isRecent) existing.recentCount++
      if (existing.titles.length < 5) existing.titles.push(memory.title || 'Untitled')
      // Track oldest date (memories are newest-first so the last one we see is oldest)
      existing.oldestDate = memory.created_at

      clusters.set(key, existing)
    }
  }

  // Filter: must have MIN_CLUSTER_SIZE+ mentions AND no active project covers it
  const orphans: ThemeCluster[] = []
  for (const cluster of clusters.values()) {
    if (cluster.count < MIN_CLUSTER_SIZE) continue
    if (projectCoverage.includes(cluster.theme)) continue
    orphans.push(cluster)
  }

  if (orphans.length === 0) return []

  // Score: prioritise by recency spike, then raw count
  orphans.sort((a, b) => {
    const aScore = a.recentCount * 3 + a.count
    const bScore = b.recentCount * 3 + b.count
    return bScore - aScore
  })

  const now = new Date().toISOString()
  const insights: GeneratedInsight[] = []

  // Surface top 2 orphans at most — avoid flooding the insights panel
  for (const orphan of orphans.slice(0, 2)) {
    const oldestDate = new Date(orphan.oldestDate)
    const daysSince = Math.round((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    const timeLabel = daysSince < 14
      ? 'over the past fortnight'
      : daysSince < 35
        ? 'over the past month'
        : `since ${oldestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

    const isVelocitySpike = orphan.recentCount >= 2 && orphan.recentCount / orphan.count > 0.5
    const projectName = orphan.theme.charAt(0).toUpperCase() + orphan.theme.slice(1)

    insights.push({
      type: 'opportunity',
      title: isVelocitySpike
        ? `${projectName} is heating up — no project exists for it yet`
        : `${projectName} keeps appearing — this might need its own home`,
      description: isVelocitySpike
        ? `You've captured ${orphan.recentCount} thoughts about ${orphan.theme} in the last ${VELOCITY_WINDOW_DAYS} days alone (${orphan.count} total ${timeLabel}). The pace is increasing. This isn't background interest — something is crystallising.`
        : `${orphan.count} of your captures ${timeLabel} touch on ${orphan.theme}, but none of your active projects cover this territory. The thinking is already there. It just needs a container.`,
      data: {
        evidence: orphan.titles,
        project_name: projectName,
        recommendation: `Create a project for your ${orphan.theme} thinking`,
        how_long: timeLabel,
      },
      actionable: true,
      action: `Create project: "${projectName}"`,
      is_new: true,
      status: 'new',
      first_seen: now,
    })
  }

  return insights
}

/**
 * Upsert genesis insights into synthesis_insights, deduplicating by title.
 * Creates the row if missing so the first-ever memory for a user still works.
 */
export async function mergeGenesisInsights(
  userId: string,
  genesisInsights: GeneratedInsight[]
): Promise<void> {
  if (genesisInsights.length === 0) return
  const supabase = getSupabaseClient()

  const { data } = await supabase
    .from('synthesis_insights')
    .select('insights')
    .eq('user_id', userId)
    .single()

  const existing = (data?.insights as GeneratedInsight[]) || []
  const existingTitles = new Set(existing.map(i => i.title.trim().toLowerCase()))

  const toAdd = genesisInsights.filter(
    i => !existingTitles.has(i.title.trim().toLowerCase())
  )
  if (toAdd.length === 0) return

  const merged = [...existing, ...toAdd]

  if (data) {
    await supabase
      .from('synthesis_insights')
      .update({ insights: merged })
      .eq('user_id', userId)
  } else {
    await supabase
      .from('synthesis_insights')
      .insert({ user_id: userId, insights: merged, generated_at: new Date().toISOString() })
  }

  console.log(`[project-genesis] Merged ${toAdd.length} genesis insight(s) for user ${userId}`)
}

/**
 * Read cached insights from synthesis_insights for UI consumers.
 */
export async function getCachedInsights(userId: string): Promise<{
  insights: GeneratedInsight[]
  generated_at: string | null
}> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('synthesis_insights')
    .select('insights, generated_at')
    .eq('user_id', userId)
    .single()

  return {
    insights: (data?.insights as GeneratedInsight[]) || [],
    generated_at: data?.generated_at || null,
  }
}
