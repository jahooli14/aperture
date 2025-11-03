/**
 * Monitoring API
 * GET /api/monitoring - Get AI system stats and health
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './lib/supabase.js'
import { getUserId } from './lib/auth.js'
import { getUsageStats } from './lib/gemini-embeddings.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = getSupabaseClient()
  const userId = getUserId()

  try {
    // Get embedding stats
    const { count: projectsWithEmbeddings } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('embedding', 'is', null)

    const { count: totalProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: thoughtsWithEmbeddings } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('embedding', 'is', null)

    const { count: totalThoughts } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: articlesWithEmbeddings } = await supabase
      .from('reading_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('embedding', 'is', null)

    const { count: totalArticles } = await supabase
      .from('reading_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get connection stats
    const { count: aiConnections } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', 'ai')

    const { count: manualConnections } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', 'user')

    const { count: totalConnections } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })

    const { count: pendingSuggestions } = await supabase
      .from('connection_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')

    // Calculate coverage percentages
    const projectCoverage = totalProjects ? Math.round((projectsWithEmbeddings! / totalProjects) * 100) : 0
    const thoughtCoverage = totalThoughts ? Math.round((thoughtsWithEmbeddings! / totalThoughts) * 100) : 0
    const articleCoverage = totalArticles ? Math.round((articlesWithEmbeddings! / totalArticles) * 100) : 0

    // Get recent activity (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { count: recentConnections } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', 'ai')
      .gte('created_at', yesterday)

    const { count: recentSuggestions } = await supabase
      .from('connection_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', yesterday)

    // Get Gemini API usage stats
    const geminiUsage = getUsageStats()

    const stats = {
      gemini_api: {
        single_embeddings: geminiUsage.single_embeddings,
        batch_embeddings: geminiUsage.batch_embeddings,
        total_items_embedded: geminiUsage.total_items_embedded,
        errors: geminiUsage.errors,
        retries: geminiUsage.retries,
        success_rate: geminiUsage.total_items_embedded > 0
          ? Math.round((1 - (geminiUsage.errors / (geminiUsage.single_embeddings + geminiUsage.batch_embeddings + geminiUsage.errors))) * 100)
          : 100,
        last_reset: geminiUsage.last_reset
      },
      embeddings: {
        projects: {
          total: totalProjects || 0,
          with_embeddings: projectsWithEmbeddings || 0,
          coverage: projectCoverage,
          missing: (totalProjects || 0) - (projectsWithEmbeddings || 0)
        },
        thoughts: {
          total: totalThoughts || 0,
          with_embeddings: thoughtsWithEmbeddings || 0,
          coverage: thoughtCoverage,
          missing: (totalThoughts || 0) - (thoughtsWithEmbeddings || 0)
        },
        articles: {
          total: totalArticles || 0,
          with_embeddings: articlesWithEmbeddings || 0,
          coverage: articleCoverage,
          missing: (totalArticles || 0) - (articlesWithEmbeddings || 0)
        },
        overall: {
          total_items: (totalProjects || 0) + (totalThoughts || 0) + (totalArticles || 0),
          with_embeddings: (projectsWithEmbeddings || 0) + (thoughtsWithEmbeddings || 0) + (articlesWithEmbeddings || 0),
          coverage: Math.round(
            ((projectsWithEmbeddings || 0) + (thoughtsWithEmbeddings || 0) + (articlesWithEmbeddings || 0)) /
            Math.max((totalProjects || 0) + (totalThoughts || 0) + (totalArticles || 0), 1) * 100
          )
        }
      },
      connections: {
        total: totalConnections || 0,
        ai_created: aiConnections || 0,
        manual_created: manualConnections || 0,
        pending_suggestions: pendingSuggestions || 0,
        ai_percentage: totalConnections ? Math.round((aiConnections! / totalConnections) * 100) : 0
      },
      recent_activity_24h: {
        connections_created: recentConnections || 0,
        suggestions_generated: recentSuggestions || 0
      },
      health: {
        status: projectCoverage >= 80 && thoughtCoverage >= 80 ? 'healthy' : 'needs_backfill',
        gemini_configured: !!process.env.GEMINI_API_KEY,
        recommendations: []
      }
    }

    // Add recommendations
    if (stats.embeddings.projects.missing > 0) {
      stats.health.recommendations.push(`Run backfill for ${stats.embeddings.projects.missing} projects`)
    }
    if (stats.embeddings.thoughts.missing > 0) {
      stats.health.recommendations.push(`Run backfill for ${stats.embeddings.thoughts.missing} thoughts`)
    }
    if (stats.embeddings.articles.missing > 0) {
      stats.health.recommendations.push(`Run backfill for ${stats.embeddings.articles.missing} articles`)
    }
    if (!stats.health.gemini_configured) {
      stats.health.recommendations.push('Configure GEMINI_API_KEY environment variable')
    }

    return res.status(200).json(stats)

  } catch (error) {
    console.error('[monitoring] Error:', error)
    return res.status(500).json({
      error: 'Failed to fetch monitoring stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
