import { getSupabaseClient } from './lib/supabase.js';
import { getUserId } from './lib/auth.js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs';
import { generateEmbedding, cosineSimilarity } from './lib/gemini-embeddings.js';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Disable default body parser for multipart/form-data (transcription endpoint)
export const config = {
    api: {
        bodyParser: false,
    },
};
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
export default async function handler(req, res) {
    const supabase = getSupabaseClient();
    const userId = await getUserId(req);
    try {
        const { resurfacing, bridges, themes, prompts, id, capture, submit_response, q, action } = req.query;
        // POST: Media analysis (audio transcription or image description)
        if (req.method === 'POST' && (action === 'transcribe' || action === 'analyze-media')) {
            return await handleMediaAnalysis(req, res);
        }
        // POST: Background processing (merged from process.ts)
        if (req.method === 'POST' && action === 'process') {
            return await handleProcess(req, res);
        }
        // POST: Submit foundational thought response
        if (req.method === 'POST' && submit_response === 'true') {
            return await handleSubmitResponse(req, res, supabase, userId);
        }
        // POST: Voice capture (supports both capture=true and action=capture)
        if (req.method === 'POST' && (capture === 'true' || action === 'capture')) {
            return await handleCapture(req, res, supabase);
        }
        // POST: Mark memory as reviewed
        if (req.method === 'POST') {
            const memoryId = req.body.id || id;
            return await handleReview(memoryId, res, supabase);
        }
        // GET: Search (merged from search.ts)
        if (req.method === 'GET' && q) {
            const context = req.query.context;
            return await handleSearch(q, supabase, userId, res, context);
        }
        // GET: Memory prompts
        if (req.method === 'GET' && prompts === 'true') {
            return await handlePrompts(req, res, supabase, userId);
        }
        // GET: Theme clusters
        if (req.method === 'GET' && themes === 'true') {
            return await handleThemes(res, supabase);
        }
        // GET: Bridges for memory
        if (req.method === 'GET' && bridges === 'true') {
            return await handleBridges(id, res, supabase);
        }
        // GET: Resurfacing queue
        if (req.method === 'GET' && resurfacing === 'true') {
            return await handleResurfacing(res, supabase);
        }
        // GET: List all memories (default)
        if (req.method === 'GET') {
            const { data: memories, error } = await supabase
                .from('memories')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.error('[memories] GET error:', error);
                return res.status(500).json({
                    error: 'Failed to fetch memories',
                    details: error.message
                });
            }
            return res.status(200).json({ memories });
        }
        return res.status(405).json({ error: 'Method not allowed' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
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
async function handleCapture(req, res, supabase) {
    const startTime = Date.now();
    const { transcript, body, source_reference } = req.body;
    // Accept both 'transcript' (voice) and 'body' (manual text) field names
    const text = transcript || body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'transcript or body field required' });
    }
    console.log('[handleCapture] Starting capture processing');
    let parsedTitle = text.substring(0, 100) + (text.length > 100 ? '...' : '');
    let parsedBullets = [text];
    try {
        // Configure Gemini with Structured Outputs (JSON Schema)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 300,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        title: { type: SchemaType.STRING, description: "A concise, first-person title (5-10 words)" },
                        bullets: {
                            type: SchemaType.ARRAY,
                            items: { type: SchemaType.STRING },
                            description: "2-4 bullet points capturing key ideas in first person"
                        }
                    },
                    required: ["title", "bullets"]
                }
            }
        });
        const prompt = `Transform this text into a clear, first-person thought.
Text: ${text}`;
        console.log('[handleCapture] Calling Gemini with Structured Outputs...');
        const result = await model.generateContent(prompt);
        const response = result.response;
        const jsonText = response.text();
        console.log('[handleCapture] Gemini response:', jsonText);
        const parsed = JSON.parse(jsonText);
        if (parsed.title && parsed.bullets) {
            parsedTitle = parsed.title;
            parsedBullets = parsed.bullets;
            console.log('[handleCapture] Successfully parsed structured response');
        }
    }
    catch (geminiError) {
        console.error('[handleCapture] Gemini error, using fallback:', geminiError);
    }
    // Always create memory with raw transcript
    try {
        const now = new Date().toISOString();
        const body = Array.isArray(parsedBullets) ? parsedBullets.join('\n\n') : text;
        // Generate unique ID with timestamp + random component to prevent collisions on retry
        const uniqueId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
        };
        const { data: memory, error: insertError } = await supabase
            .from('memories')
            .insert(newMemory)
            .select()
            .single();
        if (insertError) {
            console.error('[handleCapture] Database insert error:', insertError);
            throw insertError;
        }
        console.log(`[handleCapture] Memory created, total time: ${Date.now() - startTime}ms`);
        // Process memory inline with Gemini (tags, summary, linking, etc.)
        console.log(`[handleCapture] Starting inline AI processing for memory ${memory.id}`);
        try {
            // Import processMemory function
            console.log(`[handleCapture] 🔄 Attempting to import process-memory module...`);
            const { processMemory } = await import('../lib/process-memory.js');
            console.log(`[handleCapture] ✅ Successfully imported process-memory module`);
            // Process the memory (extract entities, generate embeddings, etc.)
            console.log(`[handleCapture] 🔄 Calling processMemory(${memory.id})...`);
            await processMemory(memory.id);
            console.log(`[handleCapture] ✅ processMemory completed successfully`);
            console.log(`[handleCapture] ✅ AI processing complete for ${memory.id}`);
            // Fetch the updated memory to return to client
            const { data: updatedMemory, error: fetchError } = await supabase
                .from('memories')
                .select('*')
                .eq('id', memory.id)
                .single();
            if (!fetchError && updatedMemory) {
                console.log(`[handleCapture] Response sent with processed memory, total time: ${Date.now() - startTime}ms`);
                return res.status(201).json({
                    success: true,
                    memory: updatedMemory,
                    message: 'Voice note saved and AI analysis complete!'
                });
            }
        }
        catch (processingError) {
            // Log error but still return the memory - it will be picked up by cron later
            console.error(`[handleCapture] 🚨 AI PROCESSING FAILED for memory ${memory.id}`);
            console.error(`[handleCapture] Error type: ${processingError instanceof Error ? processingError.constructor.name : typeof processingError}`);
            console.error(`[handleCapture] Error message: ${processingError instanceof Error ? processingError.message : String(processingError)}`);
            console.error(`[handleCapture] Full error:`, processingError);
            if (processingError instanceof Error && processingError.stack) {
                console.error(`[handleCapture] Stack trace:`, processingError.stack);
            }
        }
        // Fallback: return the unprocessed memory if processing failed
        console.log(`[handleCapture] Response sent, total time: ${Date.now() - startTime}ms`);
        return res.status(201).json({
            success: true,
            memory,
            message: 'Voice note saved! AI processing in progress...'
        });
    }
    catch (error) {
        console.error('[handleCapture] Error:', error);
        return res.status(500).json({
            error: 'Failed to capture thought',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Mark memory as reviewed
 */
async function handleReview(memoryId, res, supabase) {
    if (!memoryId) {
        return res.status(400).json({ error: 'Memory ID required' });
    }
    try {
        // First, get current review count
        const { data: existing } = await supabase
            .from('memories')
            .select('review_count')
            .eq('id', memoryId)
            .single();
        // Update review metadata
        const { data: memory, error } = await supabase
            .from('memories')
            .update({
            last_reviewed_at: new Date().toISOString(),
            review_count: (existing?.review_count || 0) + 1
        })
            .eq('id', memoryId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({ error: 'Failed to mark as reviewed' });
        }
        return res.status(200).json({
            success: true,
            memory
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Get bridges for memory
 */
async function handleBridges(memoryId, res, supabase) {
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
                .order('strength', { ascending: false });
            if (error) {
                return res.status(500).json({ error: 'Failed to fetch bridges' });
            }
            return res.status(200).json({ bridges });
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
            .limit(100);
        if (error) {
            return res.status(500).json({ error: 'Failed to fetch bridges' });
        }
        return res.status(200).json({ bridges });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Resurfacing algorithm: Spaced repetition
 */
async function handleResurfacing(res, supabase) {
    try {
        // Get all memories with metadata
        const { data: memories, error } = await supabase
            .from('memories')
            .select(`
        *,
        entities:entities(count)
      `)
            .eq('processed', true)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        // Calculate which memories should be resurfaced
        const now = new Date();
        const resurfacingCandidates = memories
            .map(memory => {
            const createdAt = new Date(memory.created_at);
            const lastReviewed = memory.last_reviewed_at
                ? new Date(memory.last_reviewed_at)
                : createdAt;
            const daysSinceReview = Math.floor((now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24));
            // Spaced repetition intervals
            const intervals = [1, 3, 7, 14, 30, 60, 90];
            const reviewCount = memory.review_count || 0;
            const targetInterval = intervals[Math.min(reviewCount, intervals.length - 1)];
            // Should resurface if days since review >= target interval
            const shouldReview = daysSinceReview >= targetInterval;
            // Priority score: entity count + recency factor
            const entityCount = memory.entities?.[0]?.count || 0;
            const recencyFactor = Math.max(0, 1 - (daysSinceReview / 365));
            const priority = entityCount * 0.5 + recencyFactor * 0.5;
            return {
                ...memory,
                shouldReview,
                daysSinceReview,
                targetInterval,
                priority
            };
        })
            .filter(m => m.shouldReview)
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 5); // Return top 5
        return res.status(200).json({
            memories: resurfacingCandidates,
            count: resurfacingCandidates.length
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch resurfacing memories' });
    }
}
/**
 * Theme clustering: Group memories by AI-extracted themes
 */
async function handleThemes(res, supabase) {
    try {
        const { data: memories, error: memoriesError } = await supabase
            .from('memories')
            .select('*')
            .order('created_at', { ascending: false });
        if (memoriesError)
            throw memoriesError;
        if (!memories || memories.length === 0) {
            return res.status(200).json({
                clusters: [],
                total_memories: 0,
                uncategorized_count: 0
            });
        }
        // Extract all unique themes across all memories
        const themeMap = new Map();
        let uncategorizedCount = 0;
        memories.forEach(memory => {
            const themes = memory.themes || [];
            if (themes.length === 0) {
                uncategorizedCount++;
                return;
            }
            themes.forEach((theme) => {
                if (!themeMap.has(theme)) {
                    themeMap.set(theme, []);
                }
                themeMap.get(theme).push(memory);
            });
        });
        // Define theme metadata (icon, color)
        const themeMetadata = {
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
        };
        // Build clusters
        const clusters = Array.from(themeMap.entries())
            .map(([themeName, themeMemories]) => {
            const metadata = themeMetadata[themeName.toLowerCase()] || {
                icon: '📝',
                color: '#6B7280'
            };
            // Extract sample keywords from memory titles/tags
            const keywords = new Set();
            themeMemories.slice(0, 10).forEach(memory => {
                if (memory.tags) {
                    memory.tags.forEach((tag) => keywords.add(tag));
                }
                if (memory.title) {
                    memory.title
                        .toLowerCase()
                        .split(/\s+/)
                        .filter((word) => word.length > 4)
                        .slice(0, 2)
                        .forEach((word) => keywords.add(word));
                }
            });
            return {
                id: themeName.toLowerCase().replace(/\s+/g, '-'),
                name: themeName.charAt(0).toUpperCase() + themeName.slice(1),
                icon: metadata.icon,
                color: metadata.color,
                memory_count: themeMemories.length,
                sample_keywords: Array.from(keywords).slice(0, 5),
                memories: themeMemories
            };
        })
            .sort((a, b) => b.memory_count - a.memory_count)
            .slice(0, 12);
        return res.status(200).json({
            clusters,
            total_memories: memories.length,
            uncategorized_count: uncategorizedCount
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to cluster themes',
            clusters: [],
            total_memories: 0,
            uncategorized_count: 0
        });
    }
}
/**
 * Handle memory prompts request (consolidated from memory-prompts.ts)
 */
async function handlePrompts(req, res, supabase, userId) {
    try {
        // Fetch all prompts
        const { data: prompts, error: promptsError } = await supabase
            .from('memory_prompts')
            .select('*')
            .order('priority_order', { ascending: true });
        if (promptsError) {
            return res.status(500).json({ error: 'Failed to fetch prompts' });
        }
        // If no user, return prompts with pending status
        if (!userId) {
            const required = prompts.filter(p => p.is_required);
            const optional = prompts.filter(p => !p.is_required);
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
            });
        }
        // Fetch user's prompt statuses
        const { data: userStatuses, error: statusError } = await supabase
            .from('user_prompt_status')
            .select(`
        *,
        response:memory_responses(*)
      `)
            .eq('user_id', userId);
        if (statusError) {
        }
        // Create status map
        const statusMap = new Map((userStatuses || []).map(s => [s.prompt_id, s]));
        // Enrich prompts with status
        const enrichedPrompts = prompts.map(prompt => {
            const userStatus = statusMap.get(prompt.id);
            return {
                ...prompt,
                status: userStatus?.status || 'pending',
                response: userStatus?.response || undefined
            };
        });
        // Categorize prompts
        const required = enrichedPrompts.filter(p => p.is_required);
        const optional = enrichedPrompts.filter(p => !p.is_required && p.status !== 'suggested');
        const suggested = enrichedPrompts.filter(p => p.status === 'suggested');
        // Calculate progress
        const completedRequired = required.filter(p => p.status === 'completed').length;
        const completedTotal = enrichedPrompts.filter(p => p.status === 'completed').length;
        const totalRequired = required.length;
        const completionPercentage = totalRequired > 0
            ? Math.round((completedRequired / totalRequired) * 100)
            : 0;
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
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function handleSubmitResponse(req, res, supabase, userId) {
    try {
        const { prompt_id, custom_title, bullets } = req.body;
        if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
            return res.status(400).json({ error: 'Bullets array required' });
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
            .single();
        if (responseError)
            throw responseError;
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
            });
            if (statusError) {
            }
        }
        // Calculate updated progress
        const { data: prompts } = await supabase
            .from('memory_prompts')
            .select('id, is_required');
        const { data: statuses } = await supabase
            .from('user_prompt_status')
            .select('*')
            .eq('user_id', userId);
        const required = prompts?.filter(p => p.is_required) || [];
        const completedRequired = statuses?.filter(s => s.status === 'completed' &&
            required.some(p => p.id === s.prompt_id)).length || 0;
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
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to submit response' });
    }
}
/**
 * Universal search handler (merged from search.ts)
 * Searches across memories, projects, and articles
 */
async function handleSearch(query, supabase, userId, res, context) {
    try {
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }
        const searchTerm = query.toLowerCase().trim();
        if (searchTerm.length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }
        // Generate embedding if context is provided
        let embedding;
        if (context) {
            try {
                embedding = await generateEmbedding(context);
            }
            catch (e) {
                console.error('[handleSearch] Failed to generate embedding:', e);
            }
        }
        // Search across all content types in parallel
        const [memoriesResults, projectsResults, articlesResults] = await Promise.all([
            searchMemories(searchTerm, supabase, userId, embedding),
            searchProjects(searchTerm, supabase, userId, embedding),
            searchArticles(searchTerm, supabase, userId, embedding)
        ]);
        // Combine and sort results by score
        const allResults = [
            ...memoriesResults,
            ...projectsResults,
            ...articlesResults
        ].sort((a, b) => b.score - a.score);
        return res.status(200).json({
            query: searchTerm,
            context: !!context,
            total: allResults.length,
            results: allResults,
            breakdown: {
                memories: memoriesResults.length,
                projects: projectsResults.length,
                articles: articlesResults.length
            }
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Search memories using text search on title and body
 */
async function searchMemories(query, supabase, userId, embedding) {
    try {
        const { data, error } = await supabase
            .from('memories')
            .select('*')
            .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
            .limit(20);
        if (error) {
            console.error('[searchMemories] Database error:', error);
            return [];
        }
        return (data || []).map(memory => {
            let score = calculateTextScore(query, memory.title, memory.body);
            // Boost score if vector similarity matches
            if (embedding && memory.embedding) {
                const similarity = cosineSimilarity(embedding, memory.embedding);
                score += similarity * 100; // Add up to 100 points for perfect vector match
            }
            return {
                type: 'memory',
                id: memory.id,
                title: memory.title,
                body: memory.body,
                score,
                created_at: memory.created_at,
                entities: memory.entities,
                tags: memory.tags
            };
        });
    }
    catch (error) {
        console.error('[searchMemories] Unexpected error:', error);
        return [];
    }
}
/**
 * Search projects using text search on title and description
 */
async function searchProjects(query, supabase, userId, embedding) {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .limit(20);
        if (error) {
            console.error('[searchProjects] Database error:', error);
            return [];
        }
        return (data || []).map(project => {
            let score = calculateTextScore(query, project.title, project.description);
            if (embedding && project.embedding) {
                const similarity = cosineSimilarity(embedding, project.embedding);
                score += similarity * 100;
            }
            return {
                type: 'project',
                id: project.id,
                title: project.title,
                description: project.description,
                score,
                created_at: project.created_at,
                tags: project.tags
            };
        });
    }
    catch (error) {
        console.error('[searchProjects] Unexpected error:', error);
        return [];
    }
}
/**
 * Search articles using text search on title, excerpt, and content
 */
async function searchArticles(query, supabase, userId, embedding) {
    try {
        const { data, error } = await supabase
            .from('reading_queue')
            .select('*')
            .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`)
            .limit(20);
        if (error) {
            console.error('[searchArticles] Database error:', error);
            return [];
        }
        return (data || []).map(article => {
            let score = calculateTextScore(query, article.title, article.excerpt);
            if (embedding && article.embedding) {
                const similarity = cosineSimilarity(embedding, article.embedding);
                score += similarity * 100;
            }
            return {
                type: 'article',
                id: article.id,
                title: article.title || 'Untitled',
                body: article.excerpt,
                url: article.url,
                score,
                created_at: article.created_at,
                tags: article.tags
            };
        });
    }
    catch (error) {
        console.error('[searchArticles] Unexpected error:', error);
        return [];
    }
}
/**
 * Calculate relevance score based on text matching
 * Higher score = better match
 */
function calculateTextScore(query, ...fields) {
    let score = 0;
    const queryLower = query.toLowerCase();
    for (const field of fields) {
        if (!field)
            continue;
        const fieldLower = field.toLowerCase();
        // Exact match in title = highest score
        if (fields[0] && fieldLower === queryLower) {
            score += 100;
        }
        // Query appears at start = high score
        if (fieldLower.startsWith(queryLower)) {
            score += 50;
        }
        // Query appears as whole word = medium score
        const words = fieldLower.split(/\s+/);
        if (words.includes(queryLower)) {
            score += 30;
        }
        // Query appears anywhere = base score
        if (fieldLower.includes(queryLower)) {
            score += 10;
        }
        // Count occurrences
        const occurrences = (fieldLower.match(new RegExp(queryLower, 'g')) || []).length;
        score += occurrences * 5;
    }
    return score;
}
/**
 * Handle background processing (merged from process.ts)
 * Processes a memory with AI extraction (entities, themes, embeddings)
 */
async function handleProcess(req, res) {
    const { memory_id } = req.body;
    if (!memory_id) {
        return res.status(400).json({ error: 'memory_id required' });
    }
    try {
        const { processMemory } = await import('../lib/process-memory.js');
        await processMemory(memory_id);
        return res.status(200).json({
            success: true,
            message: 'Memory processed successfully'
        });
    }
    catch (error) {
        console.error('[handleProcess] Processing failed:', { memory_id, error });
        return res.status(500).json({
            error: 'Processing failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Handle media analysis (audio transcription or image description)
 * Uses Google Gemini 2.5 Flash for multi-modal understanding
 */
async function handleMediaAnalysis(req, res) {
    try {
        // Parse multipart form data
        const form = formidable({
            maxFileSize: 25 * 1024 * 1024, // 25MB max
        });
        const { files } = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err)
                    reject(err);
                else
                    resolve({ files });
            });
        });
        // Check for various file keys (audio, image, file)
        const uploadedFile = files.audio || files.image || files.file;
        const rawFile = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
        if (!rawFile) {
            return res.status(400).json({ error: 'No file provided (expected audio, image, or file)' });
        }
        const file = rawFile;
        const mimeType = file.mimetype || 'application/octet-stream';
        const isImage = mimeType.startsWith('image/');
        // Assume audio for raw blobs if uncertain, unless it's clearly an image
        const isAudio = !isImage;
        console.log('[media-analysis] File received:', {
            originalFilename: file.originalFilename,
            mimetype: mimeType,
            size: file.size,
            type: isImage ? 'IMAGE' : 'AUDIO'
        });
        // Read file as base64
        const fileData = fs.readFileSync(file.filepath);
        const base64Data = fileData.toString('base64');
        // Use Gemini 2.5 Flash
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        let prompt = '';
        if (isImage) {
            prompt = 'Describe this image in detail for a personal knowledge base. Capture text, key objects, diagram structures, and the overall context. If it is a whiteboard sketch, explain the concepts drawn. Return plain text.';
        }
        else {
            prompt = 'Listen to this audio recording and transcribe exactly what is said. Return only the transcribed text, with no additional commentary or formatting.';
        }
        console.log('[media-analysis] Sending to Gemini...');
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            },
            prompt
        ]);
        const response = await result.response;
        const text = response.text().trim();
        console.log('[media-analysis] Gemini response length:', text.length);
        // Clean up temp file
        fs.unlinkSync(file.filepath);
        if (!text) {
            throw new Error('Empty response from Gemini');
        }
        return res.status(200).json({
            success: true,
            text: text,
            type: isImage ? 'image_description' : 'transcription'
        });
    }
    catch (error) {
        console.error('[handleMediaAnalysis] Error:', error);
        return res.status(500).json({
            error: 'Media analysis failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
