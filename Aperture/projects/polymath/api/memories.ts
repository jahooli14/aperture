import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './lib/supabase.js'
import { getUserId } from './lib/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import formidable from 'formidable'
import type { File as FormidableFile } from 'formidable'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Disable default body parser for multipart/form-data (transcription endpoint)
export const config = {
  api: {
    bodyParser: false,
  },
}

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

/**
 * Unified Memories API
 * GET /api/memories - List all memories
 * GET /api/memories?q=xxx - Universal search across memories, projects, and articles
 * GET /api/memories?resurfacing=true - Get memories to resurface (spaced repetition)
 * GET /api/memories?themes=true - Get theme clusters
 * GET /api/memories?prompts=true - Get memory prompts with status
 * GET /api/memories?bridges=true&id=xxx - Get bridges for memory
 * POST /api/memories - Mark memory as reviewed (requires id in body)
 * POST /api/memories?capture=true - Voice capture with transcript parsing (requires transcript in body)
 * POST /api/memories?action=transcribe - Transcribe audio file (merged from transcribe.ts)
 * POST /api/memories?action=process - Background memory processing (merged from process.ts)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const userId = getUserId()

  try {
    const { resurfacing, bridges, themes, prompts, id, capture, submit_response, q, action } = req.query

    // POST: Transcribe audio (merged from transcribe.ts)
    if (req.method === 'POST' && action === 'transcribe') {
      return await handleTranscribe(req, res)
    }

    // POST: Background processing (merged from process.ts)
    if (req.method === 'POST' && action === 'process') {
      return await handleProcess(req, res)
    }

    // POST: Submit foundational thought response
    if (req.method === 'POST' && submit_response === 'true') {
      return await handleSubmitResponse(req, res, supabase, userId)
    }

    // POST: Voice capture (supports both capture=true and action=capture)
    if (req.method === 'POST' && (capture === 'true' || action === 'capture')) {
      return await handleCapture(req, res, supabase)
    }

    // POST: Mark memory as reviewed
    if (req.method === 'POST') {
      const memoryId = req.body.id || id
      return await handleReview(memoryId as string, res, supabase)
    }

    // GET: Search (merged from search.ts)
    if (req.method === 'GET' && q) {
      return await handleSearch(q as string, supabase, userId, res)
    }

    // GET: Memory prompts
    if (req.method === 'GET' && prompts === 'true') {
      return await handlePrompts(req, res, supabase, userId)
    }

    // GET: Theme clusters
    if (req.method === 'GET' && themes === 'true') {
      return await handleThemes(res, supabase)
    }

    // GET: Bridges for memory
    if (req.method === 'GET' && bridges === 'true') {
      return await handleBridges(id as string | undefined, res, supabase)
    }

    // GET: Resurfacing queue
    if (req.method === 'GET' && resurfacing === 'true') {
      return await handleResurfacing(res, supabase)
    }

    // GET: List all memories (default)
    if (req.method === 'GET') {
      const { data: memories, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[memories] GET error:', error)
        return res.status(500).json({
          error: 'Failed to fetch memories',
          details: error.message
        })
      }

      return res.status(200).json({ memories })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/* UNUSED - kept for reference
 * Attempt to repair incomplete JSON from Gemini
 * Handles cases like: {"title": "something
 */
/* function repairIncompleteJSON(jsonStr: string): string {
  let repaired = jsonStr.trim()

  // Count braces to see if incomplete
  const openBraces = (repaired.match(/\{/g) || []).length
  const closeBraces = (repaired.match(/\}/g) || []).length

  // If missing closing brace
  if (openBraces > closeBraces) {
    // Check if last field value is incomplete (missing closing quote)
    if (repaired.match(/"[^"]*$/)) {
      repaired += '"'  // Close the string
    }

    // Add missing bullets field if it's missing
    if (!repaired.includes('"bullets"')) {
      // Extract the title if possible
      const titleMatch = repaired.match(/"title"\s*:\s*"([^"]*)"/)
      if (titleMatch) {
        // Create a simple bullet from the title
        repaired = repaired.replace(/"title"\s*:\s*"([^"]*)"[^}]*$/,
          `"title": "${titleMatch[1]}", "bullets": ["${titleMatch[1]}"]`)
      } else {
        // Fallback: add empty bullets
        if (!repaired.endsWith(',')) {
          repaired += ','
        }
        repaired += ' "bullets": ["Quick thought"]'
      }
    }

    // Add missing closing braces
    for (let i = 0; i < (openBraces - closeBraces); i++) {
      repaired += '}'
    }
  }

  return repaired
} */

/**
 * Handle voice capture - uses raw transcript, then full AI processing enriches it
 */
async function handleCapture(req: VercelRequest, res: VercelResponse, supabase: any) {
  const startTime = Date.now()
  const { transcript, body, source_reference } = req.body

  // Accept both 'transcript' (voice) and 'body' (manual text) field names
  const text = transcript || body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'transcript or body field required' })
  }

  console.log('[handleCapture] Starting capture processing')

  // Use raw transcript - full AI processing will add all enrichment
  // Initial Gemini call for title/bullets is unreliable (returns empty), so skip it
  const parsedTitle = text.substring(0, 100) + (text.length > 100 ? '...' : '')
  const parsedBullets = [text]
  console.log('[handleCapture] Using raw transcript - full processing will handle AI enrichment')

  /* DISABLED: Initial Gemini call returns empty responses
  try {
    // Parse transcript with Gemini FIRST (should be < 5 seconds)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      }
    })

    const prompt = `Transform this text into a clear, first-person thought.

Extract:
1. Title (5-10 words, first person)
2. 2-4 bullet points (first person, capturing key ideas)

Text: ${text}

Return ONLY JSON:
{"title": "...", "bullets": ["...", "..."]}`

    console.log('[handleCapture] Calling Gemini...')

    // Add timeout wrapper
    const geminiPromise = model.generateContent(prompt)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout')), 10000)
    )

    const result = await Promise.race([geminiPromise, timeoutPromise]) as any
    console.log(`[handleCapture] Gemini responded in ${Date.now() - startTime}ms`)

    // Check for safety filters or blocked content
    const response = result.response
    if (response.promptFeedback?.blockReason) {
      console.warn('[handleCapture] Content blocked:', response.promptFeedback.blockReason)
      throw new Error(`Content blocked: ${response.promptFeedback.blockReason}`)
    }

    const geminiResponse = response.text()
    console.log('[handleCapture] Raw response length:', geminiResponse?.length || 0)
    if (geminiResponse) {
      console.log('[handleCapture] Raw response:', geminiResponse.substring(0, 200))
    }

    // Check if response is empty
    if (!geminiResponse || geminiResponse.trim().length === 0) {
      console.warn('[handleCapture] Empty Gemini response, using fallback')
      throw new Error('Empty Gemini response')
    }

    // Parse Gemini response - try multiple strategies
    let parsed: any = null

    // Strategy 1: Extract from markdown code block (```json ... ```)
    const codeBlockMatch = geminiResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      try {
        parsed = JSON.parse(codeBlockMatch[1].trim())
        console.log('[handleCapture] Parsed from markdown code block')
      } catch (e) {
        console.log('[handleCapture] Code block parse failed, trying repair:', e)
        // Try to repair incomplete JSON in code block
        try {
          const repaired = repairIncompleteJSON(codeBlockMatch[1].trim())
          parsed = JSON.parse(repaired)
          console.log('[handleCapture] Repaired and parsed code block JSON')
        } catch (e2) {
          console.log('[handleCapture] JSON repair failed:', e2)
        }
      }
    }

    // Strategy 2: Extract raw JSON object
    if (!parsed) {
      const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
          console.log('[handleCapture] Parsed from raw JSON')
        } catch (e) {
          console.log('[handleCapture] Raw JSON parse failed, trying repair:', e)
          // Try to repair incomplete JSON
          try {
            const repaired = repairIncompleteJSON(jsonMatch[0])
            parsed = JSON.parse(repaired)
            console.log('[handleCapture] Repaired and parsed raw JSON')
          } catch (e2) {
            console.log('[handleCapture] JSON repair failed:', e2)
          }
        }
      }
    }

    // Strategy 3: Try parsing the entire response as JSON
    if (!parsed) {
      try {
        parsed = JSON.parse(geminiResponse.trim())
        console.log('[handleCapture] Parsed entire response as JSON')
      } catch (e) {
        console.log('[handleCapture] Full text parse failed:', e)
      }
    }

    // If we successfully parsed, use those values
    if (parsed && parsed.title && parsed.bullets) {
      parsedTitle = parsed.title
      parsedBullets = parsed.bullets
      console.log('[handleCapture] Successfully parsed Gemini response')
    } else {
      console.warn('[handleCapture] Could not parse Gemini response, using fallback')
      if (parsed) {
        console.warn('[handleCapture] Parsed but invalid format:', JSON.stringify(parsed))
      }
    }
  } catch (geminiError) {
    // Gemini failed - log but continue with fallback
    console.error('[handleCapture] Gemini error, using fallback:', geminiError)
  }
  */

  // Always create memory with raw transcript
  try {
    const now = new Date().toISOString()
    const body = Array.isArray(parsedBullets) ? parsedBullets.join('\n\n') : text

    // Generate unique ID with timestamp + random component to prevent collisions on retry
    const uniqueId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const newMemory = {
      audiopen_id: uniqueId,
      title: parsedTitle,
      body,
      orig_transcript: text,
      tags: ['voice-note'],
      audiopen_created_at: now,
      memory_type: null,
      entities: null,
      themes: null,
      emotional_tone: null,
      source_reference: source_reference || null,
      embedding: null,
      processed: false, // Will be fully processed in background
      processed_at: null,
      error: null,
    }

    const { data: memory, error: insertError } = await supabase
      .from('memories')
      .insert(newMemory)
      .select()
      .single()

    if (insertError) {
      console.error('[handleCapture] Database insert error:', insertError)
      throw insertError
    }

    console.log(`[handleCapture] Memory created, total time: ${Date.now() - startTime}ms`)

    // Process memory inline with Gemini (tags, summary, linking, etc.)
    console.log(`[handleCapture] Starting inline AI processing for memory ${memory.id}`)

    try {
      // Import processMemory function
      const { processMemory } = await import('../lib/process-memory.js')

      // Process the memory (extract entities, generate embeddings, etc.)
      await processMemory(memory.id)

      console.log(`[handleCapture] ✅ AI processing complete for ${memory.id}`)

      // Fetch the updated memory to return to client
      const { data: updatedMemory, error: fetchError } = await supabase
        .from('memories')
        .select('*')
        .eq('id', memory.id)
        .single()

      if (!fetchError && updatedMemory) {
        console.log(`[handleCapture] Response sent with processed memory, total time: ${Date.now() - startTime}ms`)

        return res.status(201).json({
          success: true,
          memory: updatedMemory,
          message: 'Voice note saved and AI analysis complete!'
        })
      }
    } catch (processingError) {
      // Log error but still return the memory - it will be picked up by cron later
      console.error(`[handleCapture] AI processing failed, memory saved but not processed:`, processingError)
    }

    // Fallback: return the unprocessed memory if processing failed
    console.log(`[handleCapture] Response sent, total time: ${Date.now() - startTime}ms`)
    return res.status(201).json({
      success: true,
      memory,
      message: 'Voice note saved! AI processing in progress...'
    })

  } catch (error) {
    console.error('[handleCapture] Error:', error)
    return res.status(500).json({
      error: 'Failed to capture thought',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Mark memory as reviewed
 */
async function handleReview(memoryId: string, res: VercelResponse, supabase: any) {
  if (!memoryId) {
    return res.status(400).json({ error: 'Memory ID required' })
  }

  try {
    // First, get current review count
    const { data: existing } = await supabase
      .from('memories')
      .select('review_count')
      .eq('id', memoryId)
      .single()

    // Update review metadata
    const { data: memory, error } = await supabase
      .from('memories')
      .update({
        last_reviewed_at: new Date().toISOString(),
        review_count: (existing?.review_count || 0) + 1
      })
      .eq('id', memoryId)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: 'Failed to mark as reviewed' })
    }

    return res.status(200).json({
      success: true,
      memory
    })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get bridges for memory
 */
async function handleBridges(memoryId: string | undefined, res: VercelResponse, supabase: any) {
  try {
    if (memoryId) {
      // Get bridges for specific memory
      const { data: bridges, error } = await supabase
        .from('bridges')
        .select(`
          *,
          memory_a:memories!bridges_memory_a_fkey(id, title, created_at),
          memory_b:memories!bridges_memory_b_fkey(id, title, created_at)
        `)
        .or(`memory_a.eq.${memoryId},memory_b.eq.${memoryId}`)
        .order('strength', { ascending: false })

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch bridges' })
      }

      return res.status(200).json({ bridges })
    }

    // Get all bridges
    const { data: bridges, error } = await supabase
      .from('bridges')
      .select(`
        *,
        memory_a:memories!bridges_memory_a_fkey(id, title, created_at),
        memory_b:memories!bridges_memory_b_fkey(id, title, created_at)
      `)
      .order('strength', { ascending: false })
      .limit(100)

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch bridges' })
    }

    return res.status(200).json({ bridges })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Resurfacing algorithm: Spaced repetition
 */
async function handleResurfacing(res: VercelResponse, supabase: any) {
  try {
    // Get all memories with metadata
    const { data: memories, error } = await supabase
      .from('memories')
      .select(`
        *,
        entities:entities(count)
      `)
      .eq('processed', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate which memories should be resurfaced
    const now = new Date()
    const resurfacingCandidates = memories
      .map(memory => {
        const createdAt = new Date(memory.created_at)
        const lastReviewed = memory.last_reviewed_at
          ? new Date(memory.last_reviewed_at)
          : createdAt

        const daysSinceReview = Math.floor(
          (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Spaced repetition intervals
        const intervals = [1, 3, 7, 14, 30, 60, 90]
        const reviewCount = memory.review_count || 0
        const targetInterval = intervals[Math.min(reviewCount, intervals.length - 1)]

        // Should resurface if days since review >= target interval
        const shouldReview = daysSinceReview >= targetInterval

        // Priority score: entity count + recency factor
        const entityCount = memory.entities?.[0]?.count || 0
        const recencyFactor = Math.max(0, 1 - (daysSinceReview / 365))
        const priority = entityCount * 0.5 + recencyFactor * 0.5

        return {
          ...memory,
          shouldReview,
          daysSinceReview,
          targetInterval,
          priority
        }
      })
      .filter(m => m.shouldReview)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5) // Return top 5

    return res.status(200).json({
      memories: resurfacingCandidates,
      count: resurfacingCandidates.length
    })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch resurfacing memories' })
  }
}

/**
 * Theme clustering: Group memories by AI-extracted themes
 */
async function handleThemes(res: VercelResponse, supabase: any) {
  try {
    const { data: memories, error: memoriesError } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })

    if (memoriesError) throw memoriesError

    if (!memories || memories.length === 0) {
      return res.status(200).json({
        clusters: [],
        total_memories: 0,
        uncategorized_count: 0
      })
    }

    // Extract all unique themes across all memories
    const themeMap = new Map<string, any[]>()
    let uncategorizedCount = 0

    memories.forEach(memory => {
      const themes = memory.themes || []

      if (themes.length === 0) {
        uncategorizedCount++
        return
      }

      themes.forEach((theme: string) => {
        if (!themeMap.has(theme)) {
          themeMap.set(theme, [])
        }
        themeMap.get(theme)!.push(memory)
      })
    })

    // Define theme metadata (icon, color)
    const themeMetadata: Record<string, { icon: string; color: string }> = {
      'design': { icon: '🎨', color: '#EC4899' },
      'career': { icon: '💼', color: '#3B82F6' },
      'learning': { icon: '🧠', color: '#8B5CF6' },
      'projects': { icon: '⚡', color: '#F59E0B' },
      'life': { icon: '🏡', color: '#10B981' },
      'ideas': { icon: '💡', color: '#F59E0B' },
      'tech': { icon: '💻', color: '#6366F1' },
      'health': { icon: '🏃', color: '#EF4444' },
      'relationships': { icon: '❤️', color: '#EC4899' },
      'finance': { icon: '💰', color: '#10B981' },
      'travel': { icon: '✈️', color: '#06B6D4' },
      'food': { icon: '🍜', color: '#F97316' },
      'books': { icon: '📚', color: '#8B5CF6' },
      'music': { icon: '🎵', color: '#EC4899' },
      'art': { icon: '🖼️', color: '#F59E0B' },
      'writing': { icon: '✍️', color: '#6366F1' },
      'business': { icon: '📊', color: '#3B82F6' },
      'productivity': { icon: '⚡', color: '#10B981' },
      'mindfulness': { icon: '🧘', color: '#8B5CF6' },
      'creativity': { icon: '🌟', color: '#F59E0B' }
    }

    // Build clusters
    const clusters = Array.from(themeMap.entries())
      .map(([themeName, themeMemories]) => {
        const metadata = themeMetadata[themeName.toLowerCase()] || {
          icon: '📝',
          color: '#6B7280'
        }

        // Extract sample keywords from memory titles/tags
        const keywords = new Set<string>()
        themeMemories.slice(0, 10).forEach(memory => {
          if (memory.tags) {
            memory.tags.forEach((tag: string) => keywords.add(tag))
          }
          if (memory.title) {
            memory.title
              .toLowerCase()
              .split(/\s+/)
              .filter((word: string) => word.length > 4)
              .slice(0, 2)
              .forEach((word: string) => keywords.add(word))
          }
        })

        return {
          id: themeName.toLowerCase().replace(/\s+/g, '-'),
          name: themeName.charAt(0).toUpperCase() + themeName.slice(1),
          icon: metadata.icon,
          color: metadata.color,
          memory_count: themeMemories.length,
          sample_keywords: Array.from(keywords).slice(0, 5),
          memories: themeMemories
        }
      })
      .sort((a, b) => b.memory_count - a.memory_count)
      .slice(0, 12)

    return res.status(200).json({
      clusters,
      total_memories: memories.length,
      uncategorized_count: uncategorizedCount
    })

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to cluster themes',
      clusters: [],
      total_memories: 0,
      uncategorized_count: 0
    })
  }
}

/**
 * Handle memory prompts request (consolidated from memory-prompts.ts)
 */
async function handlePrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    // Fetch all prompts
    const { data: prompts, error: promptsError } = await supabase
      .from('memory_prompts')
      .select('*')
      .order('priority_order', { ascending: true })

    if (promptsError) {
      return res.status(500).json({ error: 'Failed to fetch prompts' })
    }

    // If no user, return prompts with pending status
    if (!userId) {
      const required = prompts.filter(p => p.is_required)
      const optional = prompts.filter(p => !p.is_required)

      return res.status(200).json({
        required: required.map(p => ({ ...p, status: 'pending' })),
        suggested: [],
        optional: optional.map(p => ({ ...p, status: 'pending' })),
        progress: {
          completed_required: 0,
          total_required: required.length,
          completed_total: 0,
          total_prompts: prompts.length,
          completion_percentage: 0,
          has_unlocked_projects: false
        }
      })
    }

    // Fetch user's prompt statuses
    const { data: userStatuses, error: statusError } = await supabase
      .from('user_prompt_status')
      .select(`
        *,
        response:memory_responses(*)
      `)
      .eq('user_id', userId)

    if (statusError) {
    }

    // Create status map
    const statusMap = new Map(
      (userStatuses || []).map(s => [s.prompt_id, s])
    )

    // Enrich prompts with status
    const enrichedPrompts = prompts.map(prompt => {
      const userStatus = statusMap.get(prompt.id) as any
      return {
        ...prompt,
        status: userStatus?.status || 'pending',
        response: userStatus?.response || undefined
      }
    })

    // Categorize prompts
    const required = enrichedPrompts.filter(p => p.is_required)
    const optional = enrichedPrompts.filter(p => !p.is_required && p.status !== 'suggested')
    const suggested = enrichedPrompts.filter(p => p.status === 'suggested')

    // Calculate progress
    const completedRequired = required.filter(p => p.status === 'completed').length
    const completedTotal = enrichedPrompts.filter(p => p.status === 'completed').length
    const totalRequired = required.length
    const completionPercentage = totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 0

    return res.status(200).json({
      required,
      suggested,
      optional,
      progress: {
        completed_required: completedRequired,
        total_required: totalRequired,
        completed_total: completedTotal,
        total_prompts: prompts.length,
        completion_percentage: completionPercentage,
        has_unlocked_projects: completedRequired >= totalRequired
      }
    })

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleSubmitResponse(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { prompt_id, custom_title, bullets } = req.body

    if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
      return res.status(400).json({ error: 'Bullets array required' })
    }

    // Create memory response
    const { data: response, error: responseError } = await supabase
      .from('memory_responses')
      .insert([{
        user_id: userId,
        prompt_id: prompt_id || null,
        custom_title: custom_title || null,
        bullets,
        is_template: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (responseError) throw responseError

    // Update user prompt status to completed
    if (prompt_id) {
      const { error: statusError } = await supabase
        .from('user_prompt_status')
        .upsert({
          user_id: userId,
          prompt_id,
          status: 'completed',
          response_id: response.id,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })

      if (statusError) {
      }
    }

    // Calculate updated progress
    const { data: prompts } = await supabase
      .from('memory_prompts')
      .select('id, is_required')

    const { data: statuses } = await supabase
      .from('user_prompt_status')
      .select('*')
      .eq('user_id', userId)

    const required = prompts?.filter(p => p.is_required) || []
    const completedRequired = statuses?.filter(s =>
      s.status === 'completed' &&
      required.some(p => p.id === s.prompt_id)
    ).length || 0

    return res.status(200).json({
      success: true,
      response,
      progress: {
        completed_required: completedRequired,
        total_required: required.length,
        completed_total: statuses?.filter(s => s.status === 'completed').length || 0,
        total_prompts: prompts?.length || 0,
        completion_percentage: required.length > 0
          ? Math.round((completedRequired / required.length) * 100)
          : 0,
        has_unlocked_projects: completedRequired >= required.length
      }
    })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to submit response' })
  }
}

/**
 * Universal search handler (merged from search.ts)
 * Searches across memories, projects, and articles
 */
async function handleSearch(query: string, supabase: any, userId: string, res: VercelResponse) {
  try {
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const searchTerm = query.toLowerCase().trim()

    if (searchTerm.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' })
    }

    // Search across all content types in parallel
    const [memoriesResults, projectsResults, articlesResults] = await Promise.all([
      searchMemories(searchTerm, supabase, userId),
      searchProjects(searchTerm, supabase, userId),
      searchArticles(searchTerm, supabase, userId)
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
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Search memories using text search on title and body
 */
async function searchMemories(query: string, supabase: any, userId: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('[searchMemories] Database error:', error)
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
    console.error('[searchMemories] Unexpected error:', error)
    return []
  }
}

/**
 * Search projects using text search on title and description
 */
async function searchProjects(query: string, supabase: any, userId: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('[searchProjects] Database error:', error)
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
    console.error('[searchProjects] Unexpected error:', error)
    return []
  }
}

/**
 * Search articles using text search on title, excerpt, and content
 */
async function searchArticles(query: string, supabase: any, userId: string): Promise<SearchResult[]> {
  try {
    const { data, error} = await supabase
      .from('reading_queue')
      .select('*')
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('[searchArticles] Database error:', error)
      return []
    }

    return (data || []).map(article => ({
      type: 'article',
      id: article.id,
      title: article.title || 'Untitled',
      body: article.excerpt,
      url: article.url,
      score: calculateTextScore(query, article.title, article.excerpt),
      created_at: article.created_at,
      tags: article.tags
    }))
  } catch (error) {
    console.error('[searchArticles] Unexpected error:', error)
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

/**
 * Handle background processing (merged from process.ts)
 * Processes a memory with AI extraction (entities, themes, embeddings)
 */
async function handleProcess(req: VercelRequest, res: VercelResponse) {
  const { memory_id } = req.body

  if (!memory_id) {
    return res.status(400).json({ error: 'memory_id required' })
  }

  try {
    const { processMemory } = await import('../lib/process-memory.js')
    await processMemory(memory_id)

    return res.status(200).json({
      success: true,
      message: 'Memory processed successfully'
    })
  } catch (error) {
    console.error('[handleProcess] Processing failed:', { memory_id, error })
    return res.status(500).json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Handle audio transcription (merged from transcribe.ts)
 * Uses Google Gemini API to transcribe audio from native recordings
 */
async function handleTranscribe(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max
    })

    const { files } = await new Promise<{ files: formidable.Files }>((resolve, reject) => {
      form.parse(req as any, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ files })
      })
    })

    // Get audio file
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const file = audioFile as FormidableFile

    console.log('[transcribe] File received:', {
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size
    })

    // Read audio file as base64
    const audioData = fs.readFileSync(file.filepath)
    const base64Audio = audioData.toString('base64')

    console.log('[transcribe] Audio data:', {
      size: audioData.length,
      base64Length: base64Audio.length
    })

    // Use Gemini 2.5 Flash for audio transcription
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    console.log('[transcribe] Sending to Gemini with mimetype:', file.mimetype || 'audio/aac')

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: file.mimetype || 'audio/webm',
          data: base64Audio
        }
      },
      'Listen to this audio recording and transcribe exactly what is said. Return only the transcribed text, with no additional commentary or formatting.'
    ])

    const response = await result.response
    const text = response.text().trim()

    console.log('[transcribe] Gemini response:', {
      textLength: text.length,
      text: text.slice(0, 200) // First 200 chars for logging
    })

    // Clean up temp file
    fs.unlinkSync(file.filepath)

    if (!text || text.length === 0) {
      console.error('[transcribe] Empty transcription returned')
      return res.status(500).json({
        error: 'No transcription returned',
        details: 'Gemini returned an empty response'
      })
    }

    return res.status(200).json({
      success: true,
      text: text,
    })

  } catch (error) {
    console.error('[handleTranscribe] Error:', error)
    return res.status(500).json({
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
