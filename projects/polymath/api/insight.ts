/**
 * Contextual Insight API — lightweight, no LLM call.
 *
 * Returns a one-line insight about any item's position in the knowledge graph.
 * Pure data queries — fast and cheap.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'

export interface InsightResult {
  insight: string
  suggested_action?: {
    type: 'create_todo' | 'open_project'
    text: string
    id?: string
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id, type } = req.query
  if (!id || !type) return res.status(400).json({ error: 'id and type required' })

  const supabase = getSupabaseClient()

  try {
    const insights: string[] = []
    let suggestedAction: InsightResult['suggested_action'] = undefined

    // 1. Count connections (sparks)
    const { count: connectionCount } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .or(`source_id.eq.${id},target_id.eq.${id}`)

    if (connectionCount && connectionCount > 0) {
      insights.push(`Connected to ${connectionCount} other item${connectionCount !== 1 ? 's' : ''}`)
    }

    // 2. Check for linked todos
    if (type === 'thought') {
      const { data: linkedTodos } = await supabase
        .from('todos')
        .select('text, done')
        .eq('source_memory_id', id as string)
        .is('deleted_at', null)
        .limit(3)

      if (linkedTodos && linkedTodos.length > 0) {
        const active = linkedTodos.filter(t => !t.done)
        if (active.length > 0) {
          insights.push(`Has ${active.length} linked todo${active.length !== 1 ? 's' : ''}: "${active[0].text}"`)
        } else {
          insights.push(`All ${linkedTodos.length} linked todo${linkedTodos.length !== 1 ? 's' : ''} completed`)
        }
      } else {
        // No todos — suggest creating one
        suggestedAction = {
          type: 'create_todo',
          text: 'Create a todo from this thought',
        }
      }

      // 3. Check theme frequency
      const { data: memory } = await supabase
        .from('memories')
        .select('themes, created_at')
        .eq('id', id as string)
        .single()

      if (memory?.themes && memory.themes.length > 0) {
        const primaryTheme = memory.themes[0]
        const { count: themeCount } = await supabase
          .from('memories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .contains('themes', [primaryTheme])

        if (themeCount && themeCount > 2) {
          insights.push(`"${primaryTheme}" appears in ${themeCount} of your thoughts`)
        }
      }

      // 4. Check related projects
      const { data: relatedProjects } = await supabase
        .from('connections')
        .select('target_id, target_type, source_id, source_type')
        .or(`source_id.eq.${id},target_id.eq.${id}`)
        .in('source_type', ['project'])
        .limit(1)

      // Also check reverse
      const { data: reverseProjects } = await supabase
        .from('connections')
        .select('target_id, source_id, target_type, source_type')
        .or(`source_id.eq.${id},target_id.eq.${id}`)
        .in('target_type', ['project'])
        .limit(1)

      const projectConn = relatedProjects?.[0] || reverseProjects?.[0]
      if (projectConn) {
        const projectId = projectConn.source_type === 'project' ? projectConn.source_id : projectConn.target_id
        const { data: project } = await supabase
          .from('projects')
          .select('title')
          .eq('id', projectId)
          .single()

        if (project) {
          insights.push(`Related to project "${project.title}"`)
          if (!suggestedAction) {
            suggestedAction = {
              type: 'open_project',
              text: `Open ${project.title}`,
              id: projectId,
            }
          }
        }
      }
    }

    // Build final insight — pick the most valuable one
    const insight = insights.length > 0
      ? insights.join(' · ')
      : 'No connections yet — this thought is still finding its place'

    // If no connections and no todos, suggest creating a todo
    if (insights.length === 0 && !suggestedAction) {
      suggestedAction = {
        type: 'create_todo',
        text: 'Turn this into an action',
      }
    }

    return res.status(200).json({ insight, suggested_action: suggestedAction })
  } catch (error) {
    console.error('[insight] Error:', error)
    return res.status(500).json({ error: 'Failed to generate insight' })
  }
}
