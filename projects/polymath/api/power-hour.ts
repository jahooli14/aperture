import { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { generatePowerHourPlan } from './_lib/power-hour-generator.js'
import {
    shouldUseCachedPowerHour,
    savePowerHourCache,
    canRegenerateProject,
    markProjectRegenerated
} from './_lib/power-hour-cache.js'
import { cosineSimilarity } from './_lib/gemini-embeddings.js'
import { MODELS } from './_lib/models.js'

// ─── Multi-Perspective Suggestions (POST) ────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key')
const MODEL_ID = MODELS.DEFAULT_CHAT

const mpSupabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface PersonaConfig {
    id: string
    persona: string
    icon: string
    accentColor: string
    systemPrompt: string
}

const PERSONAS: PersonaConfig[] = [
    {
        id: 'executioner',
        persona: 'The Executioner',
        icon: '⚔️',
        accentColor: 'red',
        systemPrompt: `You are The Executioner — a brutal momentum coach who hates overthinking. Your one job: name the single action this person can complete in the next 30 minutes. Not a plan. Not a direction. An action with a concrete output.

Rules: Never suggest anything that takes >30 minutes. Never say "consider" or "think about". Only verbs: build, write, send, record, test, ship.

When knowledge lake context is provided, scan for the most immediately actionable thread — a specific note they wrote that's sitting unused, an article insight that maps directly to an open todo, a related project that solved a similar problem. Name it explicitly.`
    },
    {
        id: 'strategist',
        persona: 'The Strategist',
        icon: '🧭',
        accentColor: 'blue',
        systemPrompt: `You are The Strategist — a contrarian advisor who thinks in 10x leverage. Your job is to name what's being optimized for the wrong metric.

Zoom out. What's the end state? Does the current work path lead there? Scan the knowledge lake for recurring themes across notes, articles, and adjacent projects. If you see a pattern — the same idea appearing in 3 different places — that's signal. Name it. Tell them what the real bet is, not the current bet.

Be specific about what to stop doing as well as what to do.`
    },
    {
        id: 'devil',
        persona: "The Devil's Advocate",
        icon: '😈',
        accentColor: 'orange',
        systemPrompt: `You are The Devil's Advocate — you name the thing everyone in the room is avoiding. Your job is to identify the biggest risk, blocker, or self-deception in this project.

Interrogate the knowledge lake aggressively: Are there notes they wrote but never acted on? Articles they read but haven't applied? Related projects that stalled — and why? Find the avoidance pattern. Name it directly. Then give one specific thing they could do to confront it rather than keep circling it.

Be uncomfortable. Be constructive. Don't soften it.`
    },
    {
        id: 'creative',
        persona: 'The Creative',
        icon: '🎨',
        accentColor: 'pink',
        systemPrompt: `You are The Creative — a lateral thinker who finds solutions in the wrong section of the library. Your job is to propose the approach nobody's considered yet.

Mine the knowledge lake for cross-domain collision: an article from a totally different field, a memory from a different context, a project with an analogous challenge. Find where the metaphor lives. Propose a reframe, an analogy, or a shortcut that only becomes visible when you look sideways.

Be specific about which item from the corpus sparked the idea. One vivid, non-obvious suggestion. Make it feel like a revelation.`
    },
    {
        id: 'user',
        persona: 'The User',
        icon: '👤',
        accentColor: 'emerald',
        systemPrompt: `You are The User — the voice of the actual human this project serves. Your job is to cut through the builder's perspective and ask: "But what does this actually DO for someone?"

Scan the knowledge lake for notes or articles that mention real user needs, friction points, or outcomes. Find evidence that the current direction serves users — or doesn't. Ask the question the builder most needs to hear right now. Then name one thing that would make the output more obviously valuable to the person it's for.

Be empathetic but demanding. Comfort is not your job.`
    }
]

interface KnowledgeLakeContext {
    relatedMemories: Array<{ text: string; score: number; themes: string[] }>
    relatedArticles: Array<{ title: string; excerpt: string; score: number }>
    relatedProjects: Array<{ title: string; description: string; score: number }>
    capabilities: string[]
    topThemes: string[]
}

async function fetchKnowledgeLakeContext(projectId: string, userId: string): Promise<KnowledgeLakeContext | null> {
    const { data: project } = await mpSupabase
        .from('projects')
        .select('id, title, embedding')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single()

    if (!project?.embedding) return null

    const embedding = project.embedding as number[]

    const [memoriesRes, articlesRes, projectsRes, capabilitiesRes] = await Promise.all([
        mpSupabase.from('memories').select('id, title, body, themes, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(100),
        mpSupabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(60),
        mpSupabase.from('projects').select('id, title, description, embedding').eq('user_id', userId).neq('id', projectId).not('embedding', 'is', null).limit(60),
        mpSupabase.from('capabilities').select('name, description').eq('user_id', userId).limit(20)
    ])

    const scoredMemories = (memoriesRes.data || [])
        .map(m => ({ text: (m.title || m.body || '').slice(0, 120), score: cosineSimilarity(embedding, m.embedding as number[]), themes: (m.themes || []) as string[] }))
        .filter(m => m.score > 0.42).sort((a, b) => b.score - a.score).slice(0, 8)

    const scoredArticles = (articlesRes.data || [])
        .map(a => ({ title: a.title || 'Untitled', excerpt: (a.excerpt || '').slice(0, 120), score: cosineSimilarity(embedding, a.embedding as number[]) }))
        .filter(a => a.score > 0.42).sort((a, b) => b.score - a.score).slice(0, 5)

    const scoredProjects = (projectsRes.data || [])
        .map(p => ({ title: p.title || 'Untitled', description: (p.description || '').slice(0, 120), score: cosineSimilarity(embedding, p.embedding as number[]) }))
        .filter(p => p.score > 0.42).sort((a, b) => b.score - a.score).slice(0, 4)

    const allThemes = scoredMemories.flatMap(m => m.themes)
    const themeCounts = allThemes.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc }, {} as Record<string, number>)
    const topThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t)

    return {
        relatedMemories: scoredMemories,
        relatedArticles: scoredArticles,
        relatedProjects: scoredProjects,
        capabilities: (capabilitiesRes.data || []).map(c => c.name).filter(Boolean),
        topThemes
    }
}

interface PerspectiveResult {
    persona: string
    icon: string
    accentColor: string
    suggestion: string
    confidence: 'high' | 'medium'
    sourcesCited: string[]
}

function buildProjectPrompt(persona: PersonaConfig, context: {
    projectTitle: string; projectDescription: string; recentActivity: string[]
    openTodos: string[]; relatedMemories: string[]; knowledgeLake: KnowledgeLakeContext | null
}): string {
    const { projectTitle, projectDescription, recentActivity, openTodos, relatedMemories, knowledgeLake } = context
    let knowledgeLakeSection = ''
    if (knowledgeLake) {
        const { relatedMemories: lakeMems, relatedArticles, relatedProjects, capabilities, topThemes } = knowledgeLake
        const memLines = lakeMems.length > 0 ? lakeMems.map(m => `  - "${m.text}"${m.themes.length > 0 ? ` [${m.themes.slice(0, 3).join(', ')}]` : ''} (${Math.round(m.score * 100)}% match)`).join('\n') : '  (none found)'
        const articleLines = relatedArticles.length > 0 ? relatedArticles.map(a => `  - "${a.title}"${a.excerpt ? `: ${a.excerpt}` : ''} (${Math.round(a.score * 100)}% match)`).join('\n') : '  (none found)'
        const projectLines = relatedProjects.length > 0 ? relatedProjects.map(p => `  - "${p.title}"${p.description ? `: ${p.description}` : ''} (${Math.round(p.score * 100)}% match)`).join('\n') : '  (none found)'
        knowledgeLakeSection = `\nKNOWLEDGE LAKE CONTEXT (from the user's full corpus):\n\nRelated notes & memories (${lakeMems.length} semantic matches):\n${memLines}\n\nArticles they've been reading (${relatedArticles.length} semantic matches):\n${articleLines}\n\nRelated projects in their portfolio (${relatedProjects.length} matches):\n${projectLines}\n\n${capabilities.length > 0 ? `Tracked capabilities: ${capabilities.slice(0, 10).join(', ')}` : ''}${topThemes.length > 0 ? `\nRecurring themes across their knowledge base: ${topThemes.join(', ')}` : ''}\n`
    }
    const legacyMemories = relatedMemories.length > 0 ? relatedMemories.map(m => `- ${m}`).join('\n') : ''
    return `${persona.systemPrompt}\n\n---\n\nPROJECT: ${projectTitle}\nDESCRIPTION: ${projectDescription || 'No description provided'}\n\nRECENT COMPLETED ACTIVITY:\n${recentActivity.length > 0 ? recentActivity.map(a => `- ${a}`).join('\n') : '- No recent activity'}\n\nCURRENT OPEN TODOS:\n${openTodos.length > 0 ? openTodos.map(t => `- ${t}`).join('\n') : '- No open todos'}\n\n${legacyMemories ? `ADDITIONAL CONTEXT:\n${legacyMemories}\n` : ''}${knowledgeLakeSection}---\n\nAs ${persona.persona}, give ONE specific next-step suggestion for this project.\n${knowledgeLake ? 'You MUST draw from the knowledge lake above. Reference at least one specific note, article, or project by name. Generic advice is failure.' : ''}\n\nRespond with a JSON object in this exact format:\n{\n  "suggestion": "Your specific, actionable suggestion (2-3 sentences max). If you referenced knowledge lake items, name them directly in the suggestion.",\n  "confidence": "high" or "medium",\n  "sourcesCited": ["Title of memory or article you drew from", "..."]\n}\n\n"sourcesCited" should be an array of 0-3 titles from the knowledge lake context that most informed your suggestion. Empty array if no lake context available. Be specific to THIS project. Generic advice is failure.`
}

async function callPersona(persona: PersonaConfig, context: {
    projectTitle: string; projectDescription: string; recentActivity: string[]
    openTodos: string[]; relatedMemories: string[]; knowledgeLake: KnowledgeLakeContext | null
}): Promise<PerspectiveResult> {
    const model = genAI.getGenerativeModel({
        model: MODEL_ID,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
    })
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildProjectPrompt(persona, context) }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.85, responseMimeType: 'application/json' }
    })
    const text = result.response.text()
    let parsed: { suggestion: string; confidence: 'high' | 'medium'; sourcesCited?: string[] }
    try { parsed = JSON.parse(text) } catch { parsed = { suggestion: text.trim().slice(0, 300), confidence: 'medium', sourcesCited: [] } }
    return {
        persona: persona.persona, icon: persona.icon, accentColor: persona.accentColor,
        suggestion: parsed.suggestion || 'No suggestion generated',
        confidence: parsed.confidence === 'high' ? 'high' : 'medium',
        sourcesCited: Array.isArray(parsed.sourcesCited) ? parsed.sourcesCited.slice(0, 3) : []
    }
}

function synthesizePerspectives(perspectives: PerspectiveResult[]): string {
    const highConf = perspectives.filter(p => p.confidence === 'high')
    const allCited = perspectives.flatMap(p => p.sourcesCited)
    const citeCounts = allCited.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc }, {} as Record<string, number>)
    const convergentSource = Object.entries(citeCounts).sort((a, b) => b[1] - a[1])[0]
    if (convergentSource && convergentSource[1] >= 2) return `Multiple advisors independently surfaced "${convergentSource[0]}" — that's a signal. Whatever you do next, it runs through that.`
    if (highConf.length >= 3) { const names = highConf.slice(0, 3).map(p => p.persona.replace('The ', '')); return `${names[0]}, ${names[1]}, and ${names[2]} all converge — rare council alignment. This is the move.` }
    if (highConf.length === 2) { const tension = perspectives.find(p => p.confidence === 'medium' && p.persona !== highConf[0].persona && p.persona !== highConf[1].persona); return `${highConf[0].persona} and ${highConf[1].persona} agree — strong signal.${tension ? ` Watch ${tension.persona}'s caution.` : ''}` }
    if (highConf.length === 1) return `${highConf[0].persona} has the sharpest read here. The others hedge — trust the one who doesn't.`
    const totalSources = new Set(allCited).size
    if (totalSources > 0) return `The council pulled from ${totalSources} items in your knowledge lake. No clear consensus — but the sources they surfaced are worth reviewing.`
    return 'The council sees multiple valid paths. This is a judgment call — pick the perspective that matches where your energy actually is today.'
}

async function handleMultiPerspective(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key') return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' })

    const { projectId, projectTitle, projectDescription, recentActivity = [], openTodos = [], relatedMemories = [] } = req.body
    if (!projectId || !projectTitle) return res.status(400).json({ error: 'projectId and projectTitle are required' })

    const [knowledgeLake] = await Promise.all([
        fetchKnowledgeLakeContext(String(projectId), String(userId)).catch(err => { console.error('[MultiPerspective] Knowledge lake fetch failed:', err); return null })
    ])

    const context = {
        projectTitle: String(projectTitle), projectDescription: String(projectDescription || ''),
        recentActivity: Array.isArray(recentActivity) ? recentActivity.slice(0, 5) : [],
        openTodos: Array.isArray(openTodos) ? openTodos.slice(0, 10) : [],
        relatedMemories: Array.isArray(relatedMemories) ? relatedMemories.slice(0, 5) : [],
        knowledgeLake
    }

    const startTime = Date.now()
    try {
        const results = await Promise.allSettled(PERSONAS.map(persona => callPersona(persona, context)))
        const perspectives: PerspectiveResult[] = results.map((result, i) => {
            if (result.status === 'fulfilled') return result.value
            console.error(`[MultiPerspective] Persona ${PERSONAS[i].id} failed:`, result.reason)
            return { persona: PERSONAS[i].persona, icon: PERSONAS[i].icon, accentColor: PERSONAS[i].accentColor, suggestion: 'Unable to generate suggestion at this time.', confidence: 'medium' as const, sourcesCited: [] }
        })
        return res.status(200).json({
            perspectives, synthesized: synthesizePerspectives(perspectives),
            generatedAt: Date.now(), elapsed: Date.now() - startTime,
            lakeContext: knowledgeLake ? { memoriesUsed: knowledgeLake.relatedMemories.length, articlesUsed: knowledgeLake.relatedArticles.length, projectsUsed: knowledgeLake.relatedProjects.length } : null
        })
    } catch (error: unknown) {
        console.error('[MultiPerspective] Fatal error:', error)
        return res.status(500).json({ error: 'Failed to generate multi-perspective suggestions', details: error instanceof Error ? error.message : String(error) })
    }
}

// ─── Power Hour (GET) ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'POST') {
        return handleMultiPerspective(req, res)
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
    const supabase = getSupabaseClient()
    console.log('[power-hour] Fetching tasks for user:', userId)

    const { refresh, projectId, duration } = req.query
    const isRefresh = refresh === 'true' || !!projectId
    const targetProject = projectId as string | undefined
    const durationMinutes = duration ? parseInt(duration as string, 10) : 60

    // Detect device type from User-Agent (no frontend changes needed)
    const userAgent = req.headers['user-agent'] || ''
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(userAgent)
    const deviceContext = isMobile ? 'mobile' : 'desktop'

    try {
        // 1. Check for cached plan using smart cache manager
        const { useCache, cachedTasks, source } = await shouldUseCachedPowerHour(
            userId,
            targetProject,
            isRefresh
        )

        if (useCache && cachedTasks) {
            console.log(`[power-hour] Returning cached plan (source: ${source})`)
            return res.status(200).json({ tasks: cachedTasks, cached: true })
        }

        // 1b. Rate limiting: Check if we can regenerate this project
        if (targetProject && !canRegenerateProject(targetProject)) {
            console.log('[power-hour] Rate limited - regenerated too recently')
            // Return empty or old cache with warning
            return res.status(429).json({
                error: 'Power Hour for this project was regenerated recently. Please wait before refreshing again.',
                cached: false
            })
        }

        // 2. No cache? Generate on the fly (and cache it)
        console.log('[power-hour] No cache found or forced refresh. Generating on-fly...')
        let tasks
        try {
            tasks = await generatePowerHourPlan(userId, targetProject, durationMinutes, deviceContext)
            console.log(`[power-hour] Generated ${tasks.length} power hour tasks`)
        } catch (error) {
            console.error('[power-hour] Error generating power hour plan:', error)
            return res.status(500).json({ error: 'Failed to generate power hour plan' })
        }

        // 3. Proactive Enrichment: If enrich is true, save suggestions to metadata (BUT DON'T ADD TO MAIN LIST)
        if (req.query.enrich === 'true' && targetProject) {
            if (tasks.length === 0) {
                console.log('[power-hour] No tasks generated, skipping enrichment')
            } else {
                console.log('[power-hour] Saving suggestions for project:', targetProject)

                // Fetch current metadata to preserve other fields
                const { data: project } = await supabase
                    .from('projects')
                    .select('metadata')
                    .eq('id', targetProject)
                    .single()

                if (project) {
                    // Extract the specific task plan for this project
                    // The generator returns an array of tasks (one per project usually, or multiple if general)
                    // If focusing on targetProject, tasks should contain just that one, or we find it
                    const matchingTask = tasks.find(t =>
                        t.project_id === targetProject ||
                        t.project_id?.toLowerCase() === targetProject.toLowerCase()
                    ) || tasks[0] // Fallback to first if only one generated

                    if (matchingTask) {
                        // We wrap it in an array to match the "tasks" structure the frontend expects for Power Hour
                        // (The Power Hour UI expects an array of plans, even if just one)
                        const suggestionsToSave = [matchingTask]

                        const { error: updateError } = await supabase
                            .from('projects')
                            .update({
                                metadata: {
                                    ...project.metadata,
                                    suggested_power_hour_tasks: suggestionsToSave,
                                    suggested_power_hour_timestamp: new Date().toISOString()
                                }
                            })
                            .eq('id', targetProject)

                        if (updateError) {
                            console.error(`[power-hour] Failed to save suggestions:`, updateError)
                        } else {
                            console.log(`[power-hour] Successfully saved suggestions to metadata.`)
                        }
                    }
                }
            }
        }

        // 4. Cache the generated plan using smart cache manager
        if (tasks.length > 0) {
            await savePowerHourCache(userId, tasks, targetProject)

            // Mark project as regenerated for rate limiting
            if (targetProject) {
                markProjectRegenerated(targetProject)
            }
        }

        return res.status(200).json({ tasks, cached: false })

    } catch (error) {
        console.error('Power Hour Error:', error)
        return res.status(500).json({ error: 'Failed to generate Power Hour tasks', details: error instanceof Error ? error.message : String(error) })
    }
}
