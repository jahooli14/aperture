/**
 * Onboarding API
 *
 * Two resources in one file (respecting 12-API cap):
 *   GET  ?resource=book-search&q=...  — Google Books auto-complete
 *   POST ?resource=analyze             — Analyse 5 voice transcripts + books → themes, insight, project suggestions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_lib/auth.js'
import { generateText } from './_lib/gemini-chat.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const resource = req.query.resource as string

  if (req.method === 'GET' && resource === 'book-search') {
    return handleBookSearch(req, res)
  }

  if (req.method === 'POST' && resource === 'analyze') {
    return handleAnalyze(req, res)
  }

  return res.status(404).json({ error: 'Not found' })
}

// ── Book Search ────────────────────────────────────────────────────────────
async function handleBookSearch(req: VercelRequest, res: VercelResponse) {
  const query = (req.query.q as string || '').trim()
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query too short' })
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Books API key not configured' })
  }

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data: any = await response.json()
    const results = (data.items || []).map((item: any) => {
      const info = item.volumeInfo || {}
      return {
        title: info.title || 'Untitled',
        author: (info.authors || []).join(', ') || 'Unknown author',
        thumbnail: (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '').replace('http://', 'https://'),
        description: (info.description || '').slice(0, 200),
      }
    })

    return res.status(200).json({ results })
  } catch (error: any) {
    console.error('[Onboarding] Book search error:', error.message)
    return res.status(500).json({ error: 'Book search failed' })
  }
}

// ── Analyze ────────────────────────────────────────────────────────────────
async function handleAnalyze(req: VercelRequest, res: VercelResponse) {
  const { responses, books } = req.body as {
    responses: Array<{ transcript: string; question_number: number }>
    books?: Array<{ title: string; author: string }>
  }

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return res.status(400).json({ error: 'No responses provided' })
  }

  const questions = [
    "What's been on your mind lately — something you're in the middle of?",
    "What's something you made or figured out recently that felt good?",
    "Pick a topic you're genuinely curious about and just talk about it.",
    "What's something you're good at that most people wouldn't guess?",
    "What's an idea you keep coming back to — something you'd love to build or try?",
  ]

  try {
    const transcriptBlock = responses
      .map((r) => `Q${r.question_number} ("${questions[r.question_number - 1] || ''}"): "${r.transcript}"`)
      .join('\n\n')

    const bookBlock = books && books.length > 0
      ? `\n\nThey also shared 3 books they've enjoyed:\n${books.map((b, i) => `${i + 1}. "${b.title}" by ${b.author}`).join('\n')}`
      : ''

    const prompt = `You are an insightful analyst helping someone discover hidden patterns in how they think.

Below are their responses to 5 onboarding questions, spoken out loud as voice notes — so the language is natural and conversational. ${books && books.length > 0 ? 'They also shared 3 books they\'ve enjoyed.' : ''}

${transcriptBlock}${bookBlock}

Your job is to read deeply between the lines — not just summarise what they said, but surface the **non-obvious connections** between their interests, skills, and the things they care about. Treat each response as a window into how their mind works.

Return a JSON object with these fields:

{
  "themes": ["...", "..."],
  // 4-6 recurring themes. Use short phrases (2-4 words), not single words.
  // Look for themes that connect ACROSS multiple responses, not just within one.

  "capabilities": ["...", "..."],
  // 3-5 skills or abilities evident from their responses.
  // Include both explicit skills they mentioned AND implicit ones
  // (e.g. if they described debugging a complex system, "systematic debugging" is a capability).

  "patterns": ["...", "..."],
  // 2-3 meta-patterns about HOW they think (not just what they think about).
  // e.g. "You gravitate toward problems where craft and logic intersect"

  "entities": {
    "people": [],
    "places": [],
    "topics": ["...", "..."],
    "skills": ["...", "..."]
  },

  "first_insight": "...",
  // THIS IS THE MOST IMPORTANT FIELD. 2-3 sentences.
  // Connect at least 2 of their responses${books && books.length > 0 ? ' AND reference one of their books' : ''} in a way they probably haven't noticed themselves.
  // Be SPECIFIC — quote or reference actual things they said. No generic platitudes.
  // The reader should feel "wow, I never connected those two things before."
  // Write in second person ("You mentioned..." / "There's an interesting thread between your...")

  "project_suggestions": [
    {
      "title": "...",
      // Catchy, 3-6 words. Should feel exciting, not corporate.

      "description": "...",
      // 1-2 sentences. Concrete and actionable — someone should be able to picture what this IS.

      "reasoning": "..."
      // 1-2 sentences explaining WHY this fits them specifically.
      // Reference their actual responses and/or books. Don't be generic.
      // The reader should think "that's so me."
    }
  ]
  // Generate exactly 3 project suggestions.
  // Each should combine at least 2 different capabilities or interests from their responses.
  // Make them diverse: one practical/buildable, one creative/expressive, one ambitious/stretch.
  // They should feel personal and surprising — not obvious.

  "graph_preview": { "nodes": [], "edges": [] }
  // Leave empty, not used.
}

Be warm but not sycophantic. Be specific, not generic. Surprise them.`

    const result = await generateText(prompt, {
      maxTokens: 2048,
      temperature: 0.8,
      responseFormat: 'json',
    })

    const analysis = JSON.parse(result)

    // Ensure required fields exist
    const response = {
      capabilities: analysis.capabilities || [],
      themes: analysis.themes || [],
      patterns: analysis.patterns || [],
      entities: analysis.entities || { people: [], places: [], topics: [], skills: [] },
      first_insight: analysis.first_insight || 'Your thoughts are saved. Start a project to see how they connect.',
      graph_preview: { nodes: [], edges: [] },
      project_suggestions: (analysis.project_suggestions || []).slice(0, 3),
    }

    return res.status(200).json(response)
  } catch (error: any) {
    console.error('[Onboarding] Analysis error:', error.message)
    // Return minimal fallback so the user isn't stuck
    return res.status(200).json({
      capabilities: [],
      themes: [],
      patterns: [],
      entities: { people: [], places: [], topics: [], skills: [] },
      first_insight: 'Your thoughts are saved. Start a project to see how they connect.',
      graph_preview: { nodes: [], edges: [] },
      project_suggestions: [],
    })
  }
}
