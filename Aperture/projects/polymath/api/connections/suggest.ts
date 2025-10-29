/**
 * Real-Time Connection Suggestion API
 * Analyzes new content and suggests immediate connections to existing knowledge
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

interface ConnectionSuggestion {
  targetId: string
  targetType: 'memory' | 'project' | 'article'
  targetTitle: string
  reason: string
  confidence: number
  snippet?: string
}

/**
 * Generate connection suggestions for new content
 */
async function findConnections(
  contentType: 'memory' | 'article',
  contentId: string,
  contentText: string,
  contentTitle?: string
): Promise<ConnectionSuggestion[]> {
  try {
    // Get recent memories (last 50)
    const { data: memories } = await supabase
      .from('memories')
      .select('id, title, body, created_at')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(50)

    // Get active projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, description, status')
      .eq('user_id', USER_ID)
      .in('status', ['active', 'planning'])
      .limit(30)

    // Get recent articles
    const { data: articles } = await supabase
      .from('reading_queue')
      .select('id, title, excerpt, content')
      .eq('user_id', USER_ID)
      .eq('status', 'unread')
      .order('created_at', { ascending: false })
      .limit(30)

    // Prepare context for AI
    const memoriesContext = memories?.map(m =>
      `Memory [${m.id}]: "${m.title || m.body?.substring(0, 100)}"`
    ).join('\n') || ''

    const projectsContext = projects?.map(p =>
      `Project [${p.id}]: "${p.title}" - ${p.description?.substring(0, 100)}`
    ).join('\n') || ''

    const articlesContext = articles?.map(a =>
      `Article [${a.id}]: "${a.title}" - ${a.excerpt?.substring(0, 100)}`
    ).join('\n') || ''

    const prompt = `You are analyzing new content to find meaningful connections to existing knowledge.

NEW ${contentType.toUpperCase()}:
Title: ${contentTitle || 'Untitled'}
Content: ${contentText.substring(0, 1000)}

EXISTING KNOWLEDGE:

MEMORIES:
${memoriesContext}

PROJECTS:
${projectsContext}

ARTICLES:
${articlesContext}

Task: Identify 1-3 strong connections between the new ${contentType} and existing content. Look for:
- Shared concepts, themes, or topics
- Complementary ideas that could inform each other
- Related problems or solutions
- Similar patterns or insights
- Projects this content could contribute to

Return ONLY valid JSON array (no markdown):
[
  {
    "targetId": "uuid",
    "targetType": "memory|project|article",
    "targetTitle": "short title",
    "reason": "One sentence explaining the connection",
    "confidence": 0.0-1.0,
    "snippet": "relevant quote from target if helpful"
  }
]

Only include connections with confidence > 0.6. Maximum 3 suggestions.`

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Parse JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('[Connections] No valid JSON in response')
      return []
    }

    const suggestions: ConnectionSuggestion[] = JSON.parse(jsonMatch[0])

    // Validate and filter suggestions
    return suggestions
      .filter(s => s.confidence > 0.6 && s.targetId && s.reason)
      .slice(0, 3)

  } catch (error) {
    console.error('[Connections] Error finding connections:', error)
    return []
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { contentType, contentId, contentText, contentTitle } = req.body

    if (!contentType || !contentId || !contentText) {
      return res.status(400).json({
        error: 'Missing required fields: contentType, contentId, contentText'
      })
    }

    if (!['memory', 'article'].includes(contentType)) {
      return res.status(400).json({
        error: 'contentType must be "memory" or "article"'
      })
    }

    console.log(`[Connections] Finding connections for ${contentType}:`, contentId)

    const suggestions = await findConnections(
      contentType,
      contentId,
      contentText,
      contentTitle
    )

    console.log(`[Connections] Found ${suggestions.length} suggestions`)

    return res.status(200).json({
      success: true,
      suggestions,
      count: suggestions.length
    })

  } catch (error) {
    console.error('[Connections] API error:', error)
    return res.status(500).json({
      error: 'Failed to find connections',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
