/**
 * Related Items API
 * Finds contextually related thoughts, projects, and articles using the knowledge graph
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id, type, text } = req.query

    if (!id || !type) {
      return res.status(400).json({ error: 'id and type required' })
    }

    const related = await findRelatedItems(
      id as string,
      type as 'thought' | 'project' | 'article',
      text as string | undefined
    )

    return res.status(200).json({ related })

  } catch (error) {
    console.error('[api/related] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function findRelatedItems(
  sourceId: string,
  sourceType: 'thought' | 'project' | 'article',
  sourceText?: string
): Promise<any[]> {
  const related: any[] = []

  // Strategy 1: Find items linked via source_reference
  if (sourceType === 'article') {
    const { data: linkedThoughts } = await supabase
      .from('memories')
      .select('id, title, body')
      .contains('source_reference', { type: 'article', id: sourceId })
      .limit(5)

    if (linkedThoughts) {
      related.push(...linkedThoughts.map(t => ({
        id: t.id,
        type: 'thought',
        title: t.title || 'Untitled thought',
        snippet: t.body?.substring(0, 100),
        relevance: 1.0
      })))
    }
  }

  // Strategy 2: Find projects with matching capabilities
  if (sourceType === 'thought' || sourceType === 'project') {
    // Get source project's capabilities
    const { data: sourceProject } = await supabase
      .from('projects')
      .select('metadata')
      .eq('id', sourceType === 'project' ? sourceId : null)
      .single()

    const capabilities = sourceProject?.metadata?.capabilities || []

    if (capabilities.length > 0) {
      const { data: relatedProjects } = await supabase
        .from('projects')
        .select('id, title, description, metadata')
        .neq('id', sourceId)
        .limit(10)

      const scored = relatedProjects
        ?.map(p => {
          const projectCaps = p.metadata?.capabilities || []
          const overlap = capabilities.filter((c: string) => projectCaps.includes(c)).length
          const relevance = overlap / Math.max(capabilities.length, projectCaps.length, 1)

          return {
            id: p.id,
            type: 'project',
            title: p.title,
            snippet: p.description,
            relevance
          }
        })
        .filter(p => p.relevance > 0.2)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3)

      if (scored) {
        related.push(...scored)
      }
    }
  }

  // Strategy 3: Find articles with matching tags/themes (simple text match for now)
  if (sourceText && sourceType !== 'article') {
    const keywords = extractKeywords(sourceText)

    if (keywords.length > 0) {
      const { data: articles } = await supabase
        .from('reading_articles')
        .select('id, title, url, summary')
        .eq('user_id', USER_ID)
        .neq('status', 'archived')
        .limit(10)

      const scored = articles
        ?.map(a => {
          const articleText = `${a.title} ${a.summary || ''}`.toLowerCase()
          const matches = keywords.filter(k => articleText.includes(k.toLowerCase())).length
          const relevance = matches / keywords.length

          return {
            id: a.id,
            type: 'article',
            title: a.title,
            snippet: a.summary?.substring(0, 100),
            url: a.url,
            relevance
          }
        })
        .filter(a => a.relevance > 0.3)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3)

      if (scored) {
        related.push(...scored)
      }
    }
  }

  // Strategy 4: Recent activity (fallback)
  if (related.length < 3) {
    const { data: recentProjects } = await supabase
      .from('projects')
      .select('id, title, description')
      .eq('user_id', USER_ID)
      .eq('status', 'active')
      .neq('id', sourceId)
      .order('last_active', { ascending: false })
      .limit(3)

    if (recentProjects) {
      related.push(...recentProjects.map(p => ({
        id: p.id,
        type: 'project',
        title: p.title,
        snippet: p.description,
        relevance: 0.5
      })))
    }
  }

  // Deduplicate and limit
  const seen = new Set()
  return related
    .filter(item => {
      const key = `${item.type}:${item.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 5)
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - split on whitespace, remove common words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are'])

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10)
}
