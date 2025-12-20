import { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cosineSimilarity } from './_lib/gemini-embeddings.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const supabase = getSupabaseClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const userId = req.headers['x-user-id'] as string || 'default-user'

    try {
        // 1. Fetch recent memories and articles with embeddings
        const { data: memories } = await supabase
            .from('memories')
            .select('id, title, body, embedding')
            .not('embedding', 'is', null)
            .limit(50)

        const { data: articles } = await supabase
            .from('reading_queue')
            .select('id, title, excerpt, embedding')
            .not('embedding', 'is', null)
            .limit(50)

        const pool = [
            ...(memories || []).map(m => ({ id: m.id, type: 'thought', title: m.title || m.body.slice(0, 50), embedding: m.embedding })),
            ...(articles || []).map(a => ({ id: a.id, type: 'article', title: a.title, embedding: a.embedding }))
        ]

        if (pool.length < 2) {
            return res.status(200).json({ ideas: [] })
        }

        // 2. Find a "Collision" pair (moderate similarity 0.3 - 0.5)
        // For performance, we'll just pick a random set of pairs
        const pairs: any[] = []
        for (let i = 0; i < 20; i++) {
            const a = pool[Math.floor(Math.random() * pool.length)]
            const b = pool[Math.floor(Math.random() * pool.length)]
            if (a.id === b.id) continue

            const sim = cosineSimilarity(a.embedding, b.embedding)
            if (sim > 0.3 && sim < 0.6) {
                pairs.push({ a, b, similarity: sim })
            }
        }

        if (pairs.length === 0) {
            // Fallback: just pick two random ones if no moderate similarity found
            pairs.push({ a: pool[0], b: pool[1], similarity: 0 })
        }

        // Pick the best "Collision" (lowest similarity in the moderate range is often more interesting)
        const collision = pairs.sort((x, y) => x.similarity - y.similarity)[0]

        // 3. Generate "Idea Child"
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const prompt = `You are the APERTURE VENN ENGINE.
You find the intersection of disparate ideas.

IDEA A (${collision.a.type}): ${collision.a.title}
IDEA B (${collision.b.type}): ${collision.b.title}

TASK:
Generate an "Idea Child" - a brief, high-impact concept at the intersection of these two nodes.
Focus on something wacky but potentially brilliant.

Output JSON:
{
  "child_title": "string (punchy)",
  "intersection_reason": "string (why these two correlate)",
  "concept_mockup": "string (brief description of an MVP or mockup)",
  "aesthetic": "string (one word: e.g. 'Cyberpunk', 'Solarpunk', 'Minimalist')"
}`

        const result = await model.generateContent(prompt)
        const idea = JSON.parse(result.response.text().match(/\{[\s\S]*\}/)![0])

        return res.status(200).json({
            ideas: [
                {
                    ...idea,
                    source_a: collision.a,
                    source_b: collision.b,
                    collision_score: collision.similarity
                }
            ]
        })

    } catch (error) {
        console.error('Venn Engine Error:', error)
        return res.status(500).json({ error: 'Failed to cross-pollinate' })
    }
}
