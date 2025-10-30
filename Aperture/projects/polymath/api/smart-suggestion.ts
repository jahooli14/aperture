/**
 * Smart Suggestion API
 * Context-aware AI system that suggests the best next action
 * Considers: time, energy, project status, recent activity, and user patterns
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

interface SmartSuggestion {
  type: 'project' | 'reading' | 'capture' | 'review' | 'rest'
  title: string
  description: string
  reasoning: string
  item?: any
  estimatedTime?: number
  energyLevel?: string
  priority: number
  action_url?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get current context
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const timeOfDay = getTimeOfDay(hour)

    // Fetch all relevant data in parallel
    const [projects, articles, memories] = await Promise.all([
      fetchProjects(),
      fetchArticles(),
      fetchMemories()
    ])

    // Generate suggestions based on context
    const suggestions: SmartSuggestion[] = []

    // 1. Check for urgent/hot streak projects
    const hotStreakProjects = projects.filter(p =>
      p.status === 'active' &&
      p.priority === true
    )
    if (hotStreakProjects.length > 0) {
      const project = hotStreakProjects[0]
      suggestions.push({
        type: 'project',
        title: `Continue "${project.title}"`,
        description: project.metadata?.next_step || 'Make progress on your priority project',
        reasoning: '🔥 Hot streak! Keep the momentum going on your priority project',
        item: project,
        estimatedTime: project.estimated_next_step_time || 30,
        energyLevel: project.energy_level || 'moderate',
        priority: 10,
        action_url: `/projects/${project.id}`
      })
    }

    // 2. Morning = fresh energy projects
    if (timeOfDay === 'morning' && !isWeekend) {
      const freshProjects = projects.filter(p =>
        p.status === 'active' &&
        (!p.energy_level || p.energy_level === 'high' || p.energy_level === 'moderate')
      )
      if (freshProjects.length > 0) {
        const project = freshProjects[0]
        suggestions.push({
          type: 'project',
          title: `Start fresh: "${project.title}"`,
          description: project.metadata?.next_step || 'Make progress while energy is high',
          reasoning: '☀️ Morning is perfect for focused work on important projects',
          item: project,
          estimatedTime: project.estimated_next_step_time || 45,
          energyLevel: project.energy_level || 'high',
          priority: 9,
          action_url: `/projects/${project.id}`
        })
      }
    }

    // 3. Afternoon = reading & learning
    if (timeOfDay === 'afternoon') {
      const unreadArticles = articles.filter(a => a.status === 'unread')
      if (unreadArticles.length > 0) {
        const article = unreadArticles[0]
        suggestions.push({
          type: 'reading',
          title: `Read: "${article.title || 'Saved article'}"`,
          description: article.excerpt || 'Catch up on your reading queue',
          reasoning: '📚 Afternoon is great for learning and absorbing new ideas',
          item: article,
          estimatedTime: article.read_time_minutes || 10,
          energyLevel: 'low',
          priority: 7,
          action_url: `/reading/${article.id}`
        })
      }
    }

    // 4. Evening = low-energy tasks
    if (timeOfDay === 'evening') {
      // Check for quick wins
      const quickProjects = projects.filter(p =>
        p.status === 'active' &&
        p.estimated_next_step_time &&
        p.estimated_next_step_time <= 15 &&
        p.energy_level === 'low'
      )
      if (quickProjects.length > 0) {
        const project = quickProjects[0]
        suggestions.push({
          type: 'project',
          title: `Quick win: "${project.title}"`,
          description: project.metadata?.next_step || 'Complete a small task',
          reasoning: '🌙 Evening is perfect for quick, low-energy wins',
          item: project,
          estimatedTime: project.estimated_next_step_time,
          energyLevel: 'low',
          priority: 8,
          action_url: `/projects/${project.id}`
        })
      }

      // Suggest reading for wind-down
      const shortArticles = articles.filter(a =>
        a.status === 'unread' &&
        a.read_time_minutes &&
        a.read_time_minutes <= 5
      )
      if (shortArticles.length > 0) {
        const article = shortArticles[0]
        suggestions.push({
          type: 'reading',
          title: `Wind down with: "${article.title || 'Article'}"`,
          description: article.excerpt || 'Light reading before bed',
          reasoning: '✨ Short read perfect for winding down',
          item: article,
          estimatedTime: article.read_time_minutes || 5,
          energyLevel: 'low',
          priority: 6,
          action_url: `/reading/${article.id}`
        })
      }
    }

    // 5. Weekend = creative exploration
    if (isWeekend) {
      const creativeProjects = projects.filter(p =>
        p.status === 'active' &&
        p.tags?.some(tag => ['creative', 'learning', 'hobby'].includes(tag.toLowerCase()))
      )
      if (creativeProjects.length > 0) {
        const project = creativeProjects[0]
        suggestions.push({
          type: 'project',
          title: `Explore: "${project.title}"`,
          description: project.metadata?.next_step || 'Work on your creative project',
          reasoning: '🎨 Weekend time for creative exploration',
          item: project,
          estimatedTime: project.estimated_next_step_time || 60,
          energyLevel: project.energy_level || 'moderate',
          priority: 8,
          action_url: `/projects/${project.id}`
        })
      }
    }

    // 6. No memories recently = suggest capture
    if (memories.length === 0 || shouldSuggestCapture(memories)) {
      suggestions.push({
        type: 'capture',
        title: 'Capture your thoughts',
        description: 'Voice or text - what\'s on your mind?',
        reasoning: '💭 Regular thought capture strengthens your knowledge base',
        estimatedTime: 2,
        energyLevel: 'low',
        priority: 5,
        action_url: '/memories?action=create'
      })
    }

    // 7. Late night = rest suggestion
    if (hour >= 22 || hour < 6) {
      suggestions.push({
        type: 'rest',
        title: 'Time to rest',
        description: 'Your brain needs sleep to consolidate learning',
        reasoning: '😴 Late hours are for rest, not work',
        priority: 10,
        energyLevel: 'none'
      })
    }

    // 8. Fallback: Check any active project
    if (suggestions.length === 0 && projects.length > 0) {
      const activeProjects = projects.filter(p => p.status === 'active')
      if (activeProjects.length > 0) {
        const project = activeProjects[0]
        suggestions.push({
          type: 'project',
          title: `Continue "${project.title}"`,
          description: project.metadata?.next_step || 'Make progress on this project',
          reasoning: '⚡ Keep momentum on your active projects',
          item: project,
          estimatedTime: project.estimated_next_step_time || 30,
          energyLevel: project.energy_level || 'moderate',
          priority: 6,
          action_url: `/projects/${project.id}`
        })
      }
    }

    // Sort by priority and return top suggestion
    suggestions.sort((a, b) => b.priority - a.priority)
    const topSuggestion = suggestions[0]

    if (!topSuggestion) {
      return res.status(200).json({
        suggestion: {
          type: 'capture',
          title: 'Start your journey',
          description: 'Capture your first thought or create a project',
          reasoning: '✨ Begin building your knowledge graph',
          priority: 5,
          action_url: '/memories'
        },
        alternatives: [],
        context: {
          timeOfDay,
          isWeekend,
          hour,
          dayOfWeek
        }
      })
    }

    return res.status(200).json({
      suggestion: topSuggestion,
      alternatives: suggestions.slice(1, 4), // Return top 3 alternatives
      context: {
        timeOfDay,
        isWeekend,
        hour,
        dayOfWeek
      }
    })

  } catch (error) {
    console.error('[api/smart-suggestion] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

function shouldSuggestCapture(memories: any[]): boolean {
  if (memories.length === 0) return true

  // Check if last memory was more than 24 hours ago
  const lastMemory = memories[0]
  const lastMemoryTime = new Date(lastMemory.created_at).getTime()
  const now = Date.now()
  const hoursSinceLastMemory = (now - lastMemoryTime) / (1000 * 60 * 60)

  return hoursSinceLastMemory > 24
}

async function fetchProjects() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', USER_ID)
      .in('status', ['active', 'upcoming'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return []
  }
}

async function fetchArticles() {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', USER_ID)
      .in('status', ['unread', 'reading'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }
}

async function fetchMemories() {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch memories:', error)
    return []
  }
}
