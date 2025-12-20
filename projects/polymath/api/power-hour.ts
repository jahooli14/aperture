import { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const supabase = getSupabaseClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const userId = getUserId()
    console.log('[power-hour] Fetching tasks for user:', userId)

    try {
        // 1. Fetch active projects
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('id, title, description, status, metadata')
            .in('status', ['active', 'upcoming', 'maintaining'])
            .eq('user_id', userId)
            .order('last_active', { ascending: false })
            .limit(5)

        if (projectsError) throw projectsError

        if (!projects || projects.length === 0) {
            return res.status(200).json({ tasks: [], message: 'No active projects found. Start something to see Power Hour tasks!' })
        }

        // 2. Fetch recent unread articles (Fuel)
        const { data: fuel, error: fuelError } = await supabase
            .from('reading_queue')
            .select('id, title, excerpt, content')
            .eq('status', 'unread')
            .eq('user_id', userId)
            .limit(10)

        if (fuelError) throw fuelError

        // 3. Use Gemini 3 Flash to synthesize Power Hour suggestions
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

        const projectsContext = projects.map(p => {
            const tasksList = (p.metadata?.tasks || [])
                .filter((t: any) => !t.completed)
                .map((t: any) => t.text)
                .join(', ')
            return `- ${p.title} (${p.status}): ${p.description}. Current Tasks: ${tasksList || 'None listed yet.'}`
        }).join('\n')
        const fuelContext = fuel?.slice(0, 5).map(f => `- ${f.title}: ${f.excerpt}`).join('\n') || 'No new fuel available.'

        const prompt = `You are the APERTURE ENGINE. Your goal is MOMENTUM.
Reach 80% completion with 20% effort.

CURRENT PROJECTS:
${projectsContext}

AVAILABLE FUEL (Reading Material):
${fuelContext}

TASK:
Generate three high-impact "Power Hour" tasks (60 minutes each).
Each task must be tied to an active project and use specific fuel if available.
Focus on the "Next Step" that eliminates the most decision fatigue.

Output JSON only in this format:
{
  "tasks": [
    {
      "project_id": "string",
      "project_title": "string",
      "task_title": "string",
      "task_description": "string (actionable, 1-2 sentences)",
      "impact_score": 0-1,
      "fuel_id": "string (optional id of article to read)",
      "fuel_title": "string (optional)"
    }
  ]
}`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        const tasksData = jsonMatch ? JSON.parse(jsonMatch[0]) : { tasks: [] }

        return res.status(200).json(tasksData)

    } catch (error) {
        console.error('Power Hour Error:', error)
        return res.status(500).json({ error: 'Failed to generate Power Hour tasks', details: error instanceof Error ? error.message : String(error) })
    }
}
