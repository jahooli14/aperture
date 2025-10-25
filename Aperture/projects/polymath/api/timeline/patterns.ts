/**
 * Cognitive Timeline Patterns API
 * Analyzes WHEN and HOW users capture thoughts
 * Detects best thinking times, velocity, emotional continuity
 * Focus: Side-hustle hours tracking
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.authorization?.replace('Bearer ', '') || ''
    )

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get all user's memories with timestamps
    const { data: memories } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: true })

    if (!memories || memories.length < 5) {
      return res.status(200).json({
        patterns: [],
        message: 'Need at least 5 memories to detect patterns'
      })
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

    return res.status(200).json({
      patterns,
      timeline: {
        best_thinking_times: bestThinkingTimes,
        thought_velocity: thoughtVelocity,
        emotional_trends: emotionalTrends,
        side_hustle_hours: sideHustleHours
      }
    })
  } catch (error) {
    console.error('Timeline patterns error:', error)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}
