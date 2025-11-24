/**
 * Consolidated Analytics API
 * Handles timeline patterns, synthesis evolution, creative opportunities, and admin utilities
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateSeedEmbeddings, identifyTagMerges } from '../lib/tag-normalizer.js'
import { generateMorningBriefing } from '../lib/bedtime-ideas.js'
import { getSupabaseClient } from './lib/supabase.js'
import { getUserId } from './lib/auth.js'
import { getUsageStats } from './lib/gemini-embeddings.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

/**
 * TIMELINE PATTERNS
 * Analyzes WHEN and HOW users capture thoughts
 */
async function getTimelinePatterns(userId: string) {
  const supabase = getSupabaseClient()

  // Get all user's memories with timestamps
  const { data: memories } = await supabase
    .from('memories')
    .select('created_at, audiopen_created_at, emotional_tone')
    .eq('user_id', userId)
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
async function getSynthesisEvolution(userId: string) {
  const supabase = getSupabaseClient()

  // 1. Check Cache
  try {
    const { data: cached } = await supabase
      .from('insights_cache')
      .select('*')
      .eq('user_id', userId)
      .eq('resource_type', 'evolution')
      .single()

    if (cached && new Date(cached.expires_at) > new Date()) {
      return cached.data
    }
  } catch (e) {
    // Cache table might not exist yet, ignore
  }

  // Get memories and projects
  const { data: memories } = await supabase
    .from('memories')
    .select('id, title, body, created_at, themes, emotional_tone')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)

  if (!memories || memories.length < 5) {
    return {
      insights: [],
      message: 'Need at least 5 thoughts to detect evolution patterns',
      requirements: {
        current: memories?.length || 0,
        needed: 5,
        tip: 'Add more thoughts to see how your thinking evolves over time'
      }
    }
  }

  // Check for themes - needed for grouping
  const memoriesWithThemes = memories.filter(m => m.themes && m.themes.length > 0)
  if (memoriesWithThemes.length < 3) {
    return {
      insights: [],
      message: 'Your thoughts need themes to detect patterns',
      requirements: {
        current: memoriesWithThemes.length,
        needed: 3,
        tip: 'Themes are automatically extracted when you add thoughts. Try adding thoughts with clear topics.'
      }
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

  // Sort topics by frequency (descending) and take top 3
  const sortedTopics = Array.from(topicGroups.entries())
    .filter(([_, mems]) => mems.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)

  // Process top topics in parallel
  const evolutionPromises = sortedTopics.map(async ([topic, mems]) => {
    // Ask AI to analyze evolution
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const memoryTexts = mems
      .map((m, i) => `[${new Date(m.created_at).toLocaleDateString()}] ${m.title}: ${m.body?.substring(0, 200)}`)
      .join('\n\n')

    const evolutionPrompt = `Analyze the evolution of the user's BELIEFS and OPINIONS on the topic "${topic}" based on their notes.

${memoryTexts}

**INSTRUCTIONS:**
1.  **Address the user directly as "You".** Do not say "The user".
2.  **Be concise.** 2-3 sentences max for the summary.
3.  **Focus on the shift.** What changed in *your* thinking?

Detect shifts in stance, opinion, or mental models.
1. **Evolution type**: growth (learning), contradiction (changed mind), refinement (nuance), or reinforcement (conviction).
2. **Stance Tracking**: What did you believe before? What do you believe now?

Return JSON:
{
  "evolution_type": "growth|contradiction|refinement|reinforcement",
  "summary": "Your stance shifted from X to Y...",
  "timeline": [
    {"date": "2024-01-15", "stance": "You believed X", "quote": "..."},
    {"date": "2024-03-20", "stance": "Now you believe Y", "quote": "..."}
  ]
}`

    try {
      const result = await model.generateContent(evolutionPrompt)
      const responseText = result.response.text()
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
      const evolution = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)

      return {
        type: 'evolution',
        title: `How Your Thinking Evolved: ${topic}`,
        description: evolution.summary,
        data: {
          topic,
          ...evolution,
          memory_ids: mems.map(m => m.id)
        },
        actionable: false
      }
    } catch {
      return null
    }
  })

  const evolutionResults = await Promise.all(evolutionPromises)
  insights.push(...evolutionResults.filter(Boolean))

  // 2. Project Abandonment Pattern Detection
  const abandonedProjects = projects?.filter(p => p.status === 'abandoned' || p.abandoned_reason) || []

  if (abandonedProjects.length >= 2) {
    const abandonmentReasons = abandonedProjects
      .map(p => `- ${p.title}: ${p.abandoned_reason || 'No reason given'}`)
      .join('\n')

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const patternPrompt = `Analyze your project abandonment patterns:

${abandonmentReasons}

**INSTRUCTIONS:**
1.  **Address the user directly as "You".**
2.  **Be concise.**

Detect:
1. **Common pattern**: What's the recurring theme? (e.g., "You quit at deployment", "You lose interest after MVP")
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
    } catch {
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

  const result = { insights }

  // Cache the result
  try {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hour cache

    await supabase
      .from('insights_cache')
      .upsert({
        user_id: userId,
        resource_type: 'evolution',
        data: result,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'user_id,resource_type'
      })
  } catch (e) {
    // Ignore cache errors
  }

  return result
}

/**
 * CREATIVE OPPORTUNITIES
 * Scans knowledge graph for project opportunities
 */
async function getCreativeOpportunities(userId: string) {
  const supabase = getSupabaseClient()

  // Get user's memories
  const { data: memories } = await supabase
    .from('memories')
    .select('id, title, body, themes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!memories || memories.length < 3) {
    return { opportunities: [] }
  }

  // Get user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)

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

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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
  } catch {
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
 * SHADOW PROJECT DETECTOR
 * Finds clusters of activity that aren't yet projects
 */
async function getShadowProjects(userId: string) {
  const supabase = getSupabaseClient()

  // Get recent memories and articles (last 30 days)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { data: memories } = await supabase
    .from('memories')
    .select('id, title, tags, themes, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())

  const { data: articles } = await supabase
    .from('reading_queue')
    .select('id, title, tags, themes, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())

  if (!memories?.length && !articles?.length) return { shadow_projects: [] }

  // Get existing projects to exclude
  const { data: projects } = await supabase
    .from('projects')
    .select('title, tags')
    .eq('user_id', userId)

  const projectTitles = new Set(projects?.map(p => p.title.toLowerCase()) || [])

  // Use Gemini to cluster and identify
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const items = [
    ...(memories || []).map(m => `Memory: ${m.title} [${m.themes?.join(', ')}]`),
    ...(articles || []).map(a => `Article: ${a.title} [${a.themes?.join(', ')}]`)
  ].join('\n')

  const prompt = `Analyze these recent inputs and identify "Shadow Projects" - topics the user is heavily researching or thinking about but hasn't made a project for.

  INPUTS:
  ${items}

  EXISTING PROJECTS (Ignore these topics):
  ${Array.from(projectTitles).join(', ')}

  Identify clusters of 3+ items that form a coherent project concept.
  
  Return JSON:
  [
    {
      "title": "Suggested Project Title",
      "description": "What they are working on",
      "item_count": 5,
      "reasoning": "You saved 3 articles and 2 notes about Hydroponics"
    }
  ]`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/[\[][\s\S]*[\]]/)
    if (!jsonMatch) return { shadow_projects: [] }
    
    const shadows = JSON.parse(jsonMatch[0])
    return { shadow_projects: shadows }
  } catch (e) {
    return { shadow_projects: [] }
  }
}

/**
 * Helper function to get first incomplete task from project
 */
function getNextStep(project: any): string | null {
  const tasks = project.metadata?.tasks || []
  const nextTask = tasks
    .sort((a: any, b: any) => a.order - b.order)
    .find((task: any) => !task.done)

  return nextTask?.text || null
}

/**
 * SMART SUGGESTION
 * Context-aware AI system that suggests the best next action
 */
async function getSmartSuggestion(userId: string) {
  // Get current context
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const timeOfDay = getTimeOfDay(hour)

  // Fetch all relevant data in parallel
  const [projects, articles, memories] = await Promise.all([
    fetchProjects(userId),
    fetchArticles(userId),
    fetchMemories(userId)
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
      title: `Continue "${project.title}"