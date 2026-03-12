import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const supabase = getSupabaseClient()

export interface CohesiveSummary {
  overview: string
  flows: Array<{
    title: string
    description: string
    action_url: string
    icon: string
  }>
}

export async function getCohesiveSummary(userId: string): Promise<CohesiveSummary> {
  const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

  // 1. Fetch data from all pillars
  const [
    { data: activeProjects },
    { data: recentMemories },
    { data: recentTodos },
    { data: unreadReading },
    { data: recentLists }
  ] = await Promise.all([
    supabase.from('projects').select('title, description, status').eq('user_id', userId).eq('status', 'active').limit(3),
    supabase.from('memories').select('title, body, themes, tags').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('todos').select('text, done').eq('user_id', userId).eq('done', false).limit(5),
    supabase.from('reading_queue').select('title, excerpt').eq('user_id', userId).eq('status', 'unread').limit(3),
    supabase.from('lists').select('title, id').eq('user_id', userId).limit(3)
  ])

  // 2. Build context for Gemini 3.1 Flash-Lite
  const context = `
    ACTIVE PROJECTS: ${activeProjects?.map(p => p.title).join(', ') || 'None'}
    RECENT THOUGHTS: ${recentMemories?.map(m => m.title).join(', ') || 'None'}
    PENDING TODOS: ${recentTodos?.map(t => t.text).join(', ') || 'None'}
    UNREAD ARTICLES: ${unreadReading?.map(a => a.title).join(', ') || 'None'}
    LISTS: ${recentLists?.map(l => l.title).join(', ') || 'None'}
  `

  const prompt = `You are the Polymath Cohesion Engine. 
  Your goal is to look at all these disparate items and provide a unified, magical "State of the Union" and 2 "Flow" suggestions.
  A "Flow" is a connection between pillars (e.g., Turning a thought into a project task, or adding a reading link to a list).

  USER CONTEXT:
  ${context}

  Return JSON:
  {
    "overview": "A cohesive, 1-2 sentence paragraph connecting current activities. Be encouraging and insightful.",
    "flows": [
      {
        "title": "Short title",
        "description": "How to move X to Y",
        "action_url": "/projects/...",
        "icon": "zap|link|brain|list"
      }
    ]
  }
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { overview: "Keeping track of your polymath journey.", flows: [] }
  } catch (e) {
    return { overview: "Building your digital brain...", flows: [] }
  }
}
