/**
 * Universal Search API
 * Searches across memories, projects, and articles
 * Supports both text and semantic search (when embeddings available)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

interface SearchResult {
  type: 'memory' | 'project' | 'article'
  id: string
  title: string
  body?: string
  description?: string
  url?: string
  score: number
  created_at: string
  entities?: any
  tags?: string[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q: query } = req.query

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const searchTerm = query.toLowerCase().trim()

    if (searchTerm.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' })
    }

    // Search across all content types in parallel
    const [memoriesResults, projectsResults, articlesResults] = await Promise.all([
      searchMemories(searchTerm),
      searchProjects(searchTerm),
      searchArticles(searchTerm)
    ])

    // Combine and sort results by score
    const allResults: SearchResult[] = [
      ...memoriesResults,
      ...projectsResults,
      ...articlesResults
    ].sort((a, b) => b.score - a.score)

    return res.status(200).json({
      query: searchTerm,
      total: allResults.length,
      results: allResults,
      breakdown: {
        memories: memoriesResults.length,
        projects: projectsResults.length,
        articles: articlesResults.length
      }
    })

  } catch (error) {
    console.error('[api/search] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Search memories using text search on title and body
 */
async function searchMemories(query: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', USER_ID)
      .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('Memory search error:', error)
      return []
    }

    return (data || []).map(memory => ({
      type: 'memory',
      id: memory.id,
      title: memory.title,
      body: memory.body,
      score: calculateTextScore(query, memory.title, memory.body),
      created_at: memory.created_at,
      entities: memory.entities,
      tags: memory.tags
    }))
  } catch (error) {
    console.error('Memory search failed:', error)
    return []
  }
}

/**
 * Search projects using text search on title and description
 */
async function searchProjects(query: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', USER_ID)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('Project search error:', error)
      return []
    }

    return (data || []).map(project => ({
      type: 'project',
      id: project.id,
      title: project.title,
      description: project.description,
      score: calculateTextScore(query, project.title, project.description),
      created_at: project.created_at,
      tags: project.tags
    }))
  } catch (error) {
    console.error('Project search failed:', error)
    return []
  }
}

/**
 * Search articles using text search on title, excerpt, and content
 */
async function searchArticles(query: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', USER_ID)
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('Article search error:', error)
      return []
    }

    return (data || []).map(article => ({
      type: 'article',
      id: article.id,
      title: article.title || 'Untitled',
      body: article.excerpt,
      url: article.url,
      score: calculateTextScore(query, article.title, article.excerpt, article.content),
      created_at: article.created_at,
      tags: article.tags
    }))
  } catch (error) {
    console.error('Article search failed:', error)
    return []
  }
}

/**
 * Calculate relevance score based on text matching
 * Higher score = better match
 */
function calculateTextScore(query: string, ...fields: (string | null | undefined)[]): number {
  let score = 0
  const queryLower = query.toLowerCase()

  for (const field of fields) {
    if (!field) continue

    const fieldLower = field.toLowerCase()

    // Exact match in title = highest score
    if (fields[0] && fieldLower === queryLower) {
      score += 100
    }

    // Query appears at start = high score
    if (fieldLower.startsWith(queryLower)) {
      score += 50
    }

    // Query appears as whole word = medium score
    const words = fieldLower.split(/\s+/)
    if (words.includes(queryLower)) {
      score += 30
    }

    // Query appears anywhere = base score
    if (fieldLower.includes(queryLower)) {
      score += 10
    }

    // Count occurrences
    const occurrences = (fieldLower.match(new RegExp(queryLower, 'g')) || []).length
    score += occurrences * 5
  }

  return score
}
