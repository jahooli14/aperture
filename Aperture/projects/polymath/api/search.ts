/**
 * Universal Search API
 * Searches across memories, projects, reading articles, and suggestions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q } = req.query

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' })
    }

    const query = q.trim().toLowerCase()
    const searchPattern = `%${query}%`

    // Search memories
    const { data: memories, error: memoriesError } = await supabase
      .from('memories')
      .select('id, title, body, created_at, tags, entities, processed')
      .or(`title.ilike.${searchPattern},body.ilike.${searchPattern}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (memoriesError) {
      console.error('Error searching memories:', memoriesError)
    }

    // Search projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, title, description, status, created_at, updated_at, metadata')
      .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (projectsError) {
      console.error('Error searching projects:', projectsError)
    }

    // Search reading articles
    const { data: articles, error: articlesError } = await supabase
      .from('reading_queue')
      .select('id, title, url, notes, status, created_at, saved_at')
      .or(`title.ilike.${searchPattern},notes.ilike.${searchPattern}`)
      .order('saved_at', { ascending: false })
      .limit(20)

    if (articlesError) {
      console.error('Error searching articles:', articlesError)
    }

    // Search suggestions
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('project_suggestions')
      .select('id, title, description, created_at, synthesis_reasoning')
      .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .eq('rating', null) // Only unrated suggestions
      .order('created_at', { ascending: false })
      .limit(20)

    if (suggestionsError) {
      console.error('Error searching suggestions:', suggestionsError)
    }

    // Combine and format results
    const results: any[] = []

    // Add memories
    if (memories) {
      memories.forEach(memory => {
        results.push({
          type: 'memory',
          id: memory.id,
          title: memory.title || 'Untitled Memory',
          body: memory.body,
          created_at: memory.created_at,
          tags: memory.tags || [],
          entities: memory.entities,
          score: calculateScore(memory.title, memory.body, query)
        })
      })
    }

    // Add projects
    if (projects) {
      projects.forEach(project => {
        results.push({
          type: 'project',
          id: project.id,
          title: project.title,
          description: project.description,
          created_at: project.created_at,
          status: project.status,
          score: calculateScore(project.title, project.description, query)
        })
      })
    }

    // Add articles
    if (articles) {
      articles.forEach(article => {
        results.push({
          type: 'article',
          id: article.id,
          title: article.title,
          url: article.url,
          description: article.notes,
          created_at: article.saved_at || article.created_at,
          score: calculateScore(article.title, article.notes, query)
        })
      })
    }

    // Add suggestions
    if (suggestions) {
      suggestions.forEach(suggestion => {
        results.push({
          type: 'suggestion',
          id: suggestion.id,
          title: suggestion.title,
          description: suggestion.description,
          created_at: suggestion.created_at,
          score: calculateScore(suggestion.title, suggestion.description, query)
        })
      })
    }

    // Sort by score (relevance) and date
    results.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.1) {
        return b.score - a.score // Higher score first
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Calculate breakdown
    const breakdown = {
      memories: memories?.length || 0,
      projects: projects?.length || 0,
      articles: articles?.length || 0,
      suggestions: suggestions?.length || 0
    }

    return res.status(200).json({
      query,
      total: results.length,
      results: results.slice(0, 50), // Return top 50 results
      breakdown
    })

  } catch (error) {
    console.error('Search error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Calculate relevance score based on query match
 */
function calculateScore(title: string, content: string | null, query: string): number {
  const queryLower = query.toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const contentLower = (content || '').toLowerCase()

  let score = 0

  // Exact title match - highest priority
  if (titleLower === queryLower) {
    score += 10
  } else if (titleLower.includes(queryLower)) {
    score += 5
  }

  // Title word matches
  const queryWords = queryLower.split(/\s+/)
  queryWords.forEach(word => {
    if (titleLower.includes(word)) {
      score += 2
    }
  })

  // Content matches
  if (contentLower.includes(queryLower)) {
    score += 1
  }

  // Content word matches
  queryWords.forEach(word => {
    if (contentLower.includes(word)) {
      score += 0.5
    }
  })

  return score
}
