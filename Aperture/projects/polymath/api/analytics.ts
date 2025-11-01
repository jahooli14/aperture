/**
 * Consolidated Analytics API
 * Handles timeline patterns, synthesis evolution, creative opportunities, and admin utilities
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateSeedEmbeddings } from '../lib/tag-normalizer.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

/**
 * TIMELINE PATTERNS
 * Analyzes WHEN and HOW users capture thoughts
 */
async function getTimelinePatterns() {
  // Get all user's memories with timestamps
  const { data: memories } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: true })

  if (!memories || memories.length < 5) {
    return {
      patterns: [],
      message: 'Need at least 5 memories to detect patterns'
    }
  }

  // Analyze timestamps
  const timestamps = memories.map(m => new Date(m.audiopen_created_at || m.created_at))

  // Best thinking times (day of week + hour)
  const thinkingTimes = new Map<string, number>()
  timestamps.forEach(ts => {
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][ts.getDay()]
    const hour = ts.getHours()
    const key = `${day}-${hour}`
    thinkingTimes.set(key, (thinkingTimes.get(key) || 0) + 1)
  })

  const bestThinkingTimes = Array.from(thinkingTimes.entries())
    .map(([key, count]) => {
      const [day, hour] = key.split('-')
      return { day, hour: parseInt(hour), count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Thought velocity (captures per week)
  const weeklyVelocity = new Map<string, number>()
  timestamps.forEach(ts => {
    const weekStart = new Date(ts)
    weekStart.setDate(ts.getDate() - ts.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]
    weeklyVelocity.set(weekKey, (weeklyVelocity.get(weekKey) || 0) + 1)
  })

  const thoughtVelocity = Array.from(weeklyVelocity.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime())

  // Side-hustle hours detection (evenings 6pm-11pm + weekends)
  const sideHustleCaptures = timestamps.filter(ts => {
    const hour = ts.getHours()
    const day = ts.getDay()
    const isEvening = hour >= 18 && hour <= 23
    const isWeekend = day === 0 || day === 6
    return isEvening || isWeekend
  })

  const sideHustlePercentage = (sideHustleCaptures.length / timestamps.length) * 100

  // Monthly side-hustle hours (rough estimate: 1 capture = ~15min thinking time)
  const monthlySideHustle = new Map<string, number>()
  sideHustleCaptures.forEach(ts => {
    const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`
    monthlySideHustle.set(monthKey, (monthlySideHustle.get(monthKey) || 0) + 1)
  })

  const sideHustleHours = Array.from(monthlySideHustle.entries())
    .map(([month, count]) => ({
      month,
      hours: Math.round(count * 0.25 * 10) / 10 // 15min per capture
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Emotional trends (if emotional_tone is available)
  const emotionalTrends = memories
    .filter(m => m.emotional_tone)
    .map(m => ({
      date: m.audiopen_created_at || m.created_at,
      tone: m.emotional_tone
    }))

  // Build cognitive patterns
  const patterns = []

  // Best thinking times pattern
  if (bestThinkingTimes.length > 0) {
    const top = bestThinkingTimes[0]
    const timeStr = `${top.day}s at ${top.hour === 0 ? '12am' : top.hour < 12 ? top.hour + 'am' : (top.hour === 12 ? '12pm' : (top.hour - 12) + 'pm')}`
    patterns.push({
      type: 'thinking_time',
      title: 'Your Best Thinking Time',
      description: `${top.count} of your captures happened on ${timeStr}`,
      data: bestThinkingTimes,
      insight: `Most of your ideas come on ${timeStr}. Consider blocking this time for creative work.`
    })
  }

  // Velocity pattern
  if (thoughtVelocity.length > 0) {
    const avgVelocity = thoughtVelocity.reduce((sum, v) => sum + v.count, 0) / thoughtVelocity.length
    const recentWeek = thoughtVelocity[thoughtVelocity.length - 1]
    const trend = recentWeek.count > avgVelocity ? 'increasing' : 'decreasing'

    patterns.push({
      type: 'velocity',
      title: 'Thought Velocity',
      description: `You're capturing ${Math.round(avgVelocity)} thoughts per week on average`,
      data: thoughtVelocity,
      insight: trend === 'increasing'
        ? 'Your capture rate is increasing. You\'re building momentum!'
        : 'Your capture rate is steady. Consistent knowledge building.'
    })
  }

  // Side-hustle hours pattern
  if (sideHustleCaptures.length > 0) {
    patterns.push({
      type: 'side_hustle_hours',
      title: 'Side-Hustle Time Tracking',
      description: `${Math.round(sideHustlePercentage)}% of captures during evenings/weekends`,
      data: sideHustleHours,
      insight: sideHustlePercentage > 60
        ? 'Most of your creative thinking happens outside work hours. Classic side-hustler pattern.'
        : 'You\'re thinking about projects during the day too. Balanced approach.'
    })
  }

  // Emotional continuity pattern
  if (emotionalTrends.length > 3) {
    patterns.push({
      type: 'emotional_continuity',
      title: 'Emotional Continuity',
      description: `Tracking tone shifts across ${emotionalTrends.length} memories`,
      data: emotionalTrends,
      insight: 'Your emotional tone gives context to your creative journey.'
    })
  }

  return {
    patterns,
    timeline: {
      best_thinking_times: bestThinkingTimes,
      thought_velocity: thoughtVelocity,
      emotional_trends: emotionalTrends,
      side_hustle_hours: sideHustleHours
    }
  }
}

/**
 * SYNTHESIS EVOLUTION
 * Multi-memory synthesis showing evolution of thinking
 */
async function getSynthesisEvolution() {
  // Get memories and projects
  const { data: memories } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: true })

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', USER_ID)

  if (!memories || memories.length < 10) {
    return {
      insights: [],
      message: 'Need more data to detect evolution patterns'
    }
  }

  const insights = []

  // 1. Memory Evolution Detection
  const topicGroups = new Map<string, any[]>()
  memories.forEach(m => {
    if (m.themes) {
      m.themes.forEach((theme: string) => {
        const existing = topicGroups.get(theme) || []
        topicGroups.set(theme, [...existing, m])
      })
    }
  })

  // Find topics with multiple memories over time
  for (const [topic, mems] of topicGroups.entries()) {
    if (mems.length >= 3) {
      // Ask AI to analyze evolution
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

      const memoryTexts = mems
        .map((m, i) => `[${new Date(m.created_at).toLocaleDateString()}] ${m.title}: ${m.body?.substring(0, 200)}`)
        .join('\n\n')

      const evolutionPrompt = `Analyze how this person's thinking evolved on the topic "${topic}":

${memoryTexts}

Detect:
1. **Evolution type**: growth (learning/maturing), contradiction (changed mind), or refinement (same view, more nuanced)
2. **Key shifts**: When did their thinking change? What triggered it?
3. **Summary**: One sentence capturing the evolution

Return JSON:
{
  "evolution_type": "growth|contradiction|refinement",
  "summary": "Their thinking evolved from X to Y because Z",
  "timeline": [
    {"date": "2024-01-15", "stance": "Initial view", "quote": "exact quote from memory"},
    {"date": "2024-03-20", "stance": "Shifted view", "quote": "exact quote"}
  ]
}`

      try {
        const result = await model.generateContent(evolutionPrompt)
        const responseText = result.response.text()
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
        const evolution = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)

        insights.push({
          type: 'evolution',
          title: `How Your Thinking Evolved: ${topic}`,
          description: evolution.summary,
          data: {
            topic,
            ...evolution,
            memory_ids: mems.map(m => m.id)
          },
          actionable: false
        })
      } catch (e) {
        // Skip if parsing fails
      }
    }
  }

  // 2. Project Abandonment Pattern Detection
  const abandonedProjects = projects?.filter(p => p.status === 'abandoned' || p.abandoned_reason) || []

  if (abandonedProjects.length >= 2) {
    const abandonmentReasons = abandonedProjects
      .map(p => `- ${p.title}: ${p.abandoned_reason || 'No reason given'}`)
      .join('\n')

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const patternPrompt = `Analyze project abandonment patterns:

${abandonmentReasons}

Detect:
1. **Common pattern**: What's the recurring theme? (e.g., "quits at deployment", "loses interest after MVP", "abandons when it gets hard")
2. **Recommendation**: Specific, actionable advice to break this pattern

Return JSON:
{
  "pattern_type": "abandonment",
  "description": "You tend to quit when [specific trigger]",
  "recommendation": "Try [specific strategy] next time"
}`

    try {
      const result = await model.generateContent(patternPrompt)
      const responseText = result.response.text()
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
      const pattern = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)

      insights.push({
        type: 'pattern',
        title: 'Your Project Abandonment Pattern',
        description: pattern.description,
        data: {
          ...pattern,
          projects_affected: abandonedProjects.map(p => p.id)
        },
        actionable: true,
        action: pattern.recommendation
      })
    } catch (e) {
      // Skip if parsing fails
    }
  }

  // 3. Memory Collision Detection (contradictions)
  for (const [topic, mems] of topicGroups.entries()) {
    if (mems.length >= 2) {
      const tones = mems.map(m => m.emotional_tone).filter(Boolean)
      const hasPositive = tones.some(t => t.toLowerCase().includes('excit') || t.toLowerCase().includes('happy'))
      const hasNegative = tones.some(t => t.toLowerCase().includes('frustrat') || t.toLowerCase().includes('concern'))

      if (hasPositive && hasNegative) {
        const positiveMem = mems.find(m => m.emotional_tone?.toLowerCase().includes('excit') || m.emotional_tone?.toLowerCase().includes('happy'))
        const negativeMem = mems.find(m => m.emotional_tone?.toLowerCase().includes('frustrat') || m.emotional_tone?.toLowerCase().includes('concern'))

        if (positiveMem && negativeMem) {
          insights.push({
            type: 'collision',
            title: `Contradictory Feelings: ${topic}`,
            description: `Your view on ${topic} has contradictory emotions`,
            data: {
              topic,
              timeline: [
                {
                  date: positiveMem.created_at,
                  memory_id: positiveMem.id,
                  stance: positiveMem.emotional_tone,
                  quote: positiveMem.body?.substring(0, 100)
                },
                {
                  date: negativeMem.created_at,
                  memory_id: negativeMem.id,
                  stance: negativeMem.emotional_tone,
                  quote: negativeMem.body?.substring(0, 100)
                }
              ],
              evolution_type: 'contradiction'
            },
            actionable: true,
            action: `Explore what changed between ${new Date(positiveMem.created_at).toLocaleDateString()} and ${new Date(negativeMem.created_at).toLocaleDateString()}`
          })
        }
      }
    }
  }

  // 4. Capability Evolution (terminology shifts)
  const capabilityEvolution = []
  for (const [topic, mems] of topicGroups.entries()) {
    const earlyMems = mems.slice(0, Math.ceil(mems.length / 2))
    const lateMems = mems.slice(Math.ceil(mems.length / 2))

    const earlyText = earlyMems.map(m => m.body).join(' ').toLowerCase()
    const lateText = lateMems.map(m => m.body).join(' ').toLowerCase()

    const wasLearning = earlyText.includes('learning') || earlyText.includes('trying to')
    const isBuilding = lateText.includes('built') || lateText.includes('shipped') || lateText.includes('finished')

    if (wasLearning && isBuilding) {
      capabilityEvolution.push({
        capability: topic,
        from: 'learning',
        to: 'applying',
        evidence: `First mentioned learning, now actively building with it`
      })
    }
  }

  if (capabilityEvolution.length > 0) {
    insights.push({
      type: 'evolution',
      title: 'Your Skills Are Maturing',
      description: `${capabilityEvolution.length} skills went from learning → building`,
      data: { evolutions: capabilityEvolution },
      actionable: false
    })
  }

  return { insights }
}

/**
 * CREATIVE OPPORTUNITIES
 * Scans knowledge graph for project opportunities
 */
async function getCreativeOpportunities() {
  // Get user's memories
  const { data: memories } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!memories || memories.length < 3) {
    return { opportunities: [] }
  }

  // Get user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', USER_ID)

  // Extract capabilities from memories
  const capabilities = new Map<string, { count: number; lastMentioned: string; memories: string[] }>()
  const frustrations: string[] = []
  const interests: string[] = []

  memories.forEach(m => {
    const text = `${m.title} ${m.body}`.toLowerCase()

    // Extract skills/capabilities
    const skillKeywords = ['learned', 'know', 'good at', 'skill', 'experienced in', 'built with']
    skillKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        if (m.themes) {
          m.themes.forEach((theme: string) => {
            const existing = capabilities.get(theme) || { count: 0, lastMentioned: m.created_at, memories: [] }
            capabilities.set(theme, {
              count: existing.count + 1,
              lastMentioned: m.created_at,
              memories: [...existing.memories, m.id]
            })
          })
        }
      }
    })

    // Extract frustrations
    const frustrationKeywords = ['frustrated', 'annoying', 'wish', 'should exist', 'hate', 'broken', 'difficult']
    frustrationKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        frustrations.push(`${m.title}: ${m.body?.substring(0, 100)}`)
      }
    })

    // Extract interests
    if (m.themes) {
      m.themes.forEach((theme: string) => {
        if (!interests.includes(theme)) {
          interests.push(theme)
        }
      })
    }
  })

  // Build prompt for AI
  const capabilitiesText = Array.from(capabilities.entries())
    .map(([name, data]) => `- ${name} (mentioned ${data.count}x, last: ${new Date(data.lastMentioned).toLocaleDateString()})`)
    .join('\n')

  const frustrationsText = frustrations.slice(0, 10).join('\n')
  const interestsText = interests.slice(0, 10).join(', ')
  const projectsText = projects?.map(p => `- ${p.title} (${p.status}${p.abandoned_reason ? ', abandoned: ' + p.abandoned_reason : ''})`).join('\n') || 'No projects yet'

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  const prompt = `You are a creative intelligence engine helping someone with a 9-5 job identify side project opportunities.

**Their capabilities:**
${capabilitiesText || 'None identified yet'}

**Their frustrations:**
${frustrationsText || 'None mentioned'}

**Their interests:**
${interestsText || 'None identified'}

**Their project history:**
${projectsText}

**Your goal:** Suggest 2-3 project opportunities that:
1. Match their actual skills (not aspirational)
2. Solve frustrations they've mentioned
3. Fit into side-hustle time constraints (10-20 hrs/week)
4. Have revenue potential if they've mentioned income/quitting 9-5
5. Play to their strengths (not weaknesses)

**Focus on:**
- Things they can FINISH (not multi-year projects)
- Using skills they already have (with maybe 1 new skill to learn)
- Solving their own frustrations (best product ideas)
- Side-hustle → full-time trajectory if applicable

For each opportunity, explain:
- **Why YOU specifically** (use their own words/context)
- **What capabilities you'll use** (from their list)
- **Why it might work** (small, focused, solvable)
- **Revenue potential** (if they've mentioned money/income)

Return JSON array (2-3 opportunities max):
[
  {
    "title": "Project Name",
    "description": "What it is (2-3 sentences)",
    "why_you": [
      "Specific reason #1 using their context",
      "Specific reason #2",
      "Specific reason #3"
    ],
    "capabilities_used": ["skill1", "skill2"],
    "memories_referenced": ["memory_id1", "memory_id2"],
    "revenue_potential": "$500-2000/mo as template/course" or null,
    "next_steps": [
      "Concrete step 1",
      "Concrete step 2",
      "Concrete step 3"
    ],
    "confidence": 0.85
  }
]

**Rules:**
- Only suggest if you have ACTUAL evidence from their memories
- Don't suggest generic "build an app" ideas
- Use their specific frustrations/interests
- Be realistic about time/scope (side project, not startup)
- If they've abandoned projects, suggest smaller scope`

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  // Parse JSON
  let opportunities
  try {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
    opportunities = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)
  } catch (e) {
    console.error('Failed to parse opportunities:', e)
    opportunities = []
  }

  // Add IDs and timestamps
  const opportunitiesWithMeta = opportunities.map((opp: any, i: number) => ({
    id: `opp-${Date.now()}-${i}`,
    ...opp,
    created_at: new Date().toISOString()
  }))

  return { opportunities: opportunitiesWithMeta }
}

/**
 * Helper function to get first incomplete task from project
 */
function getNextStep(project: any): string | null {
  const tasks = project.metadata?.tasks || []
  const nextTask = tasks
    .sort((a: any, b: any) => a.order - b.order)
    .find((task: any) => !task.done)

  console.log(`[getNextStep] Project: ${project.title}`, {
    hasTasks: tasks.length > 0,
    totalTasks: tasks.length,
    nextTaskFound: !!nextTask,
    nextTaskText: nextTask?.text,
    oldNextStep: project.metadata?.next_step
  })

  return nextTask?.text || null
}

/**
 * SMART SUGGESTION
 * Context-aware AI system that suggests the best next action
 */
async function getSmartSuggestion() {
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
  const suggestions: any[] = []

  // 1. Check for urgent/hot streak projects
  const hotStreakProjects = projects.filter(p =>
    p.status === 'active' &&
    p.priority === true
  )
  if (hotStreakProjects.length > 0) {
    const project = hotStreakProjects[0]
    const nextStep = getNextStep(project)
    suggestions.push({
      type: 'project',
      title: `Continue "${project.title}"`,
      description: nextStep || 'Make progress on your priority project',
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
      const nextStep = getNextStep(project)
      suggestions.push({
        type: 'project',
        title: `Start fresh: "${project.title}"`,
        description: nextStep || 'Make progress while energy is high',
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
    const quickProjects = projects.filter(p =>
      p.status === 'active' &&
      p.estimated_next_step_time &&
      p.estimated_next_step_time <= 15 &&
      p.energy_level === 'low'
    )
    if (quickProjects.length > 0) {
      const project = quickProjects[0]
      const nextStep = getNextStep(project)
      suggestions.push({
        type: 'project',
        title: `Quick win: "${project.title}"`,
        description: nextStep || 'Complete a small task',
        reasoning: '🌙 Evening is perfect for quick, low-energy wins',
        item: project,
        estimatedTime: project.estimated_next_step_time,
        energyLevel: 'low',
        priority: 8,
        action_url: `/projects/${project.id}`
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
      const nextStep = getNextStep(project)
      suggestions.push({
        type: 'project',
        title: `Explore: "${project.title}"`,
        description: nextStep || 'Work on your creative project',
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
      const nextStep = getNextStep(project)
      suggestions.push({
        type: 'project',
        title: `Continue "${project.title}"`,
        description: nextStep || 'Make progress on this project',
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
    return {
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
    }
  }

  return {
    suggestion: topSuggestion,
    alternatives: suggestions.slice(1, 4), // Return top 3 alternatives
    context: {
      timeOfDay,
      isWeekend,
      hour,
      dayOfWeek
    }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { resource } = req.query

  // SMART SUGGESTION
  if (resource === 'smart-suggestion') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const result = await getSmartSuggestion()
      return res.status(200).json(result)
    } catch (error) {
      console.error('[analytics] Smart suggestion error:', error)
      return res.status(500).json({ error: 'Suggestion failed' })
    }
  }

  // TIMELINE PATTERNS
  if (resource === 'patterns') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const result = await getTimelinePatterns()
      return res.status(200).json(result)
    } catch (error) {
      console.error('[analytics] Timeline patterns error:', error)
      return res.status(500).json({ error: 'Analysis failed' })
    }
  }

  // SYNTHESIS EVOLUTION
  if (resource === 'evolution') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const result = await getSynthesisEvolution()
      return res.status(200).json(result)
    } catch (error) {
      console.error('[analytics] Synthesis evolution error:', error)
      return res.status(500).json({ error: 'Analysis failed' })
    }
  }

  // CREATIVE OPPORTUNITIES
  if (resource === 'opportunities') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const result = await getCreativeOpportunities()
      return res.status(200).json(result)
    } catch (error) {
      console.error('[analytics] Creative intelligence error:', error)
      return res.status(500).json({ error: 'Analysis failed' })
    }
  }

  // INIT TAGS (Admin utility - one-time setup)
  if (resource === 'init-tags') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      await generateSeedEmbeddings()
      return res.status(200).json({
        success: true,
        message: 'Seed tag embeddings generated successfully'
      })
    } catch (error) {
      console.error('[analytics] Init tags error:', error)
      return res.status(500).json({
        error: 'Failed to initialize tags',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return res.status(400).json({ error: 'Invalid resource. Use ?resource=smart-suggestion, ?resource=patterns, ?resource=evolution, ?resource=opportunities, or ?resource=init-tags' })
}
