/**
 * Consolidated Projects API
 * Handles projects CRUD, daily queue, context, and suggestions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { z } from 'zod'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import { generateText } from './_lib/gemini-chat.js'
import { MODELS } from './_lib/models.js'
import { generateBedtimePrompts, generateCatalystPrompts, generateBreakPrompts } from './_lib/bedtime-ideas.js'
import { extractCapabilities } from './_lib/capabilities-extraction.js'
import { analyzeTaskEnergy } from './_lib/task-energy-analyzer.js'
import { generatePowerHourPlan } from './_lib/power-hour-generator.js'
import { identifyRottingProjects, generateZebraReport, buryProject, resurrectProject, pickSynthesisResurfaceCandidate } from './_lib/project-maintenance.js'
import { updateItemConnections } from './_lib/connection-logic.js'
// intersection-engine is no longer called from this file — generation moved
// to api/_lib/intersection-weekly.ts and runs once a week via the cron. We
// keep the IntersectionPayload type local to the promote handler.
interface IntersectionPayload {
  id: string
  reason?: string
  nodes?: Array<{ id: string; title: string; type: string }>
  crossover?: {
    crossover_title?: string
    why_it_works?: string
    concept?: string
    first_steps?: string[]
  }
}
import { invalidateProjectCache } from './_lib/power-hour-cache.js'
import { recomputeHeatForUser, DRAWER_STATUSES, MUTATION_MODES, MODES_THAT_RETIRE_PARENT, type MutationMode } from './_lib/metabolism.js'

// Daily Queue Scoring Logic
interface UserContext {
  available_time: 'quick' | 'moderate' | 'deep'
  current_energy: 'low' | 'moderate' | 'high'
  available_context: string[]
}

interface ProjectScore {
  project_id: string
  project: any
  total_score: number
  category: 'hot_streak' | 'needs_attention' | 'fresh_energy' | 'available'
  match_reason: string
  breakdown: {
    momentum: number
    staleness: number
    freshness: number
    alignment: number
    unlock_bonus: number
  }
}

// Validation schema for rating suggestions
const RateRequestSchema = z.object({
  rating: z.number().int().min(-1).max(2),
  feedback: z.string().optional()
})

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function calculateMomentum(project: any): number {
  const lastActive = new Date(project.last_active)
  const now = new Date()
  const daysSinceActive = daysBetween(lastActive, now)

  if (daysSinceActive === 0) return 30
  if (daysSinceActive === 1) return 30
  if (daysSinceActive === 2) return 25
  if (daysSinceActive <= 7) return 15
  return 0
}

function calculateStaleness(project: any): number {
  const lastActive = new Date(project.last_active)
  const now = new Date()
  const daysSinceActive = daysBetween(lastActive, now)

  if (daysSinceActive >= 14 && daysSinceActive <= 30) return 25
  if (daysSinceActive >= 7 && daysSinceActive < 14) return 15
  if (daysSinceActive > 30 && daysSinceActive <= 60) return 10
  if (daysSinceActive > 60) return 0

  return 0
}

function calculateFreshness(project: any): number {
  const createdAt = new Date(project.created_at)
  const now = new Date()
  const age = daysBetween(createdAt, now)

  if (age <= 3) return 20
  if (age <= 7) return 15
  if (age <= 14) return 10
  return 0
}

function calculateAlignment(project: any, context: UserContext): number {
  let score = 0

  const projectEnergy = project.energy_level || 'moderate'
  if (projectEnergy === context.current_energy) {
    score += 10
  } else if (projectEnergy === 'low' && context.current_energy === 'moderate') {
    score += 5
  }

  const estimatedTime = project.estimated_next_step_time || 60
  const timeMatches = (
    (context.available_time === 'quick' && estimatedTime <= 30) ||
    (context.available_time === 'moderate' && estimatedTime <= 120) ||
    (context.available_time === 'deep' && estimatedTime > 60)
  )
  if (timeMatches) score += 5

  const requirements = project.context_requirements || []
  const requirementsMet = requirements.every((req: string) =>
    context.available_context.includes(req)
  )
  if (requirementsMet) score += 5

  return score
}

function calculateUnlockBonus(project: any): number {
  if (project.recently_unblocked) return 5
  const blockers = project.blockers || []
  if (blockers.length === 0 && project.had_blockers_before) return 3
  return 0
}

function scoreProject(project: any, context: UserContext): ProjectScore {
  const momentum = calculateMomentum(project)
  const staleness = calculateStaleness(project)
  const freshness = calculateFreshness(project)
  const alignment = calculateAlignment(project, context)
  const unlock_bonus = calculateUnlockBonus(project)

  let total_score = momentum + staleness + freshness + alignment + unlock_bonus
  let match_reason = 'Good fit for today'
  let category: ProjectScore['category'] = 'available'

  // Anti-Rot Logic
  const lastActive = new Date(project.last_active)
  const daysIdle = daysBetween(lastActive, new Date())
  const hasTasks = project.metadata?.tasks && project.metadata.tasks.length > 0

  if (daysIdle > 14) {
    category = 'needs_attention'
    total_score += 50 // Force to top
    if (hasTasks) {
      match_reason = "Dormant. Commit to just ONE task today."
    } else {
      match_reason = "Stuck? Let's break this down into steps."
    }
  } else if (daysIdle > 7) {
    category = 'needs_attention'
    total_score += 20
    match_reason = "Losing momentum. Do a quick 5 min task."
  } else if (momentum > 20) {
    category = 'hot_streak'
    match_reason = "You're on a roll! Keep it going."
  } else if (freshness > 15) {
    category = 'fresh_energy'
    match_reason = "New project energy. Capitalize on it."
  }

  return {
    project_id: project.id,
    project,
    total_score,
    category,
    match_reason,
    breakdown: {
      momentum,
      staleness,
      freshness,
      alignment,
      unlock_bonus
    }
  }
}

function selectDailyQueue(scores: ProjectScore[]): ProjectScore[] {
  // Sort by score (Anti-Rot logic boosts dormant projects to top)
  const sorted = [...scores].sort((a, b) => b.total_score - a.total_score)

  // Take top 3 unique projects
  return sorted.slice(0, 3)
}

/** Cron-triggered resources that use IDEA_ENGINE_SECRET instead of Supabase JWT */
const CRON_RESOURCES = ['recompute-heat', 'evolve', 'generate-digest']

function getCronUserId(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization
  const expectedToken = process.env.IDEA_ENGINE_SECRET
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) return null
  return process.env.IDEA_ENGINE_USER_ID || null
}

async function internalHandler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const { resource } = req.query

  // Cron-triggered resources accept IDEA_ENGINE_SECRET token auth
  const isCronResource = CRON_RESOURCES.includes(resource as string)
  const userId = isCronResource ? getCronUserId(req) : await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })

  // DEFAULT RESOURCE (Projects CRUD)
  if (!resource) {
    // GET /api/projects - List all or Get One
    if (req.method === 'GET') {
      const { id } = req.query

      if (id) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))

        let query = supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)

        if (isUUID) {
          query = query.eq('id', id)
        } else {
          // Fallback: Check metadata for slug
          // Note: using filter for JSONb operator
          query = query.filter('metadata->>slug', 'eq', id)
        }

        const { data: project, error } = await query.single()

        if (error || !project) return res.status(404).json({ error: 'Project not found' })
        return res.status(200).json({ project })
      }

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })

      if (error) return res.status(500).json({ error: 'Failed to fetch projects' })
      return res.status(200).json({ projects })
    }
  }

  // PRIORITY RESOURCE - Set project as priority (PATCH /api/projects?resource=priority&id={id})
  if (resource === 'priority' && req.method === 'PATCH') {
    try {
      // Frontend sends: PATCH projects/{id}/priority
      // apiClient converts to: PATCH /api/projects?resource=priority&id={id}
      const projectId = req.query.id as string

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required in query parameter' })
      }

      console.log('[priority] Setting priority for project:', projectId)

      // Set this project as priority
      const { data, error } = await supabase
        .from('projects')
        .update({ is_priority: true, last_active: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('[priority] Update error:', error)
        return res.status(500).json({ error: 'Failed to set priority', details: error.message })
      }

      if (!data) {
        console.error('[priority] Project not found:', projectId)
        return res.status(404).json({ error: 'Project not found' })
      }

      console.log('[priority] Successfully set priority')
      return res.status(200).json(data)
    } catch (error: any) {
      console.error('[priority] Unexpected error:', error)
      return res.status(500).json({
        error: 'Failed to set priority',
        details: error?.message || 'Unknown error'
      })
    }
  }

  // SET-PRIORITY RESOURCE - Atomically set one project as priority
  if (resource === 'set-priority') {
    // Toggle semantic with a focus-tier cap.
    // Up to FOCUS_CAP projects can be priority at once. Toggling on when the
    // cap is full returns 409 with the list of current priorities so the
    // client can prompt the user to demote one.
    const FOCUS_CAP = 3

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { project_id } = req.body

      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' })
      }

      // Look up the target project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, title, is_priority')
        .eq('id', project_id)
        .eq('user_id', userId)
        .single()

      if (projectError) {
        return res.status(500).json({
          error: 'Database error during project lookup',
          details: projectError.message,
          code: projectError.code
        })
      }

      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }

      // Count current priorities (excluding this project)
      const { data: currentPriorities, error: countError } = await supabase
        .from('projects')
        .select('id, title')
        .eq('user_id', userId)
        .eq('is_priority', true)
        .neq('id', project_id)

      if (countError) {
        return res.status(500).json({
          error: 'Failed to count current priorities',
          details: countError.message
        })
      }

      const currentCount = currentPriorities?.length || 0
      const nextValue = !project.is_priority

      // Enforce cap when promoting
      if (nextValue && currentCount >= FOCUS_CAP) {
        return res.status(409).json({
          error: 'focus_cap_reached',
          message: `You can focus on up to ${FOCUS_CAP} projects at a time. Drop one to promote another.`,
          cap: FOCUS_CAP,
          current_priorities: currentPriorities || []
        })
      }

      // Toggle priority on the target project
      const { data: updatedProject, error: setError } = await supabase
        .from('projects')
        .update({
          is_priority: nextValue,
          ...(nextValue ? { last_active: new Date().toISOString() } : {})
        })
        .eq('id', project_id)
        .eq('user_id', userId)
        .select()
        .single()

      if (setError) {
        return res.status(500).json({
          error: 'Failed to update priority',
          details: setError.message,
          code: setError.code
        })
      }

      // Return all projects so the client can refresh
      const { data: allProjects, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        return res.status(500).json({
          error: 'Failed to fetch projects after update',
          details: fetchError.message
        })
      }

      return res.status(200).json({
        success: true,
        updated_project: updatedProject,
        projects: allProjects || [],
        focus_cap: FOCUS_CAP
      })
    } catch (error) {
      console.error('[set-priority] UNEXPECTED ERROR:', error)
      return res.status(500).json({
        error: 'Failed to set priority',
        details: error instanceof Error ? error.message : JSON.stringify(error)
      })
    }
  }

  if (resource === 'recompute-heat') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    try {
      const result = await recomputeHeatForUser(supabase, userId)
      return res.status(200).json({ success: true, ...result })
    } catch (error) {
      console.error('[recompute-heat] error:', error)
      return res.status(500).json({
        error: 'Failed to recompute heat',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (resource === 'drawer') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    try {
      // Fetch all projects — the drawer is everything not in the focus area
      // (focus = priority + top recent). No status filtering needed.
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('heat_score', { ascending: false, nullsFirst: false })

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch drawer', details: error.message })
      }

      const allProjects = projects || []

      // Compute focus set (priority + top recent) to exclude from drawer
      const FOCUS_CAP = 3
      const priorityProjects = allProjects.filter((p: any) => p.is_priority).slice(0, FOCUS_CAP)
      const priorityIds = new Set(priorityProjects.map((p: any) => p.id))
      const recentNonPriority = [...allProjects]
        .sort((a: any, b: any) =>
          new Date(b.last_active || b.updated_at || b.created_at).getTime() -
          new Date(a.last_active || a.updated_at || a.created_at).getTime()
        )
        .filter((p: any) => !p.is_priority && !priorityIds.has(p.id))
        .slice(0, Math.max(0, FOCUS_CAP - priorityProjects.length))
      const focusIds = new Set([...priorityProjects, ...recentNonPriority].map((p: any) => p.id))

      const all = allProjects.filter((p: any) => !focusIds.has(p.id))
      const warmed = all.filter((p: any) => (p.heat_score || 0) > 0 && p.heat_reason)
      const warmedIds = new Set(warmed.map((p: any) => p.id))
      const rest = all.filter((p: any) => !warmedIds.has(p.id))

      return res.status(200).json({
        warmed,
        shuffle: rest,
        total: all.length,
      })
    } catch (error) {
      console.error('[drawer] error:', error)
      return res.status(500).json({
        error: 'Failed to load drawer',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (resource === 'generate-digest') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    try {
      const { data: warmedProjects } = await supabase
        .from('projects')
        .select('id, title, description, heat_score, heat_reason, catalysts, status, metadata')
        .eq('user_id', userId)
        .in('status', DRAWER_STATUSES)
        .eq('is_priority', false)
        .gt('heat_score', 0)
        .not('heat_reason', 'is', null)
        .order('heat_score', { ascending: false })
        .limit(5)

      const warmed = warmedProjects || []

      if (warmed.length === 0) {
        return res.status(200).json({ success: true, warmed: 0, evolutions: 0, skipped: 'no-warmed' })
      }

      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('allow_handoff_mutations')
        .eq('user_id', userId)
        .maybeSingle()
      const allowHandoff = !!userSettings?.allow_handoff_mutations

      interface Evolution {
        project_id: string
        project_title: string
        mode: MutationMode
        title: string
        proposal: string
        evidence: string
      }

      const proposals = await Promise.all(warmed.slice(0, 3).map(async (p: any): Promise<Evolution | null> => {
        const evidence = p.heat_reason || ''
        const prompt = `You are helping evolve a dormant project. Pick ONE mutation mode and return a proposal.

PROJECT
title: ${p.title}
description: ${p.description || '(none)'}
recent evidence that it's warming: ${evidence}

MODES (pick ONE that fits best)
- shrink: propose a much smaller 1-3 day version
- merge: propose combining with another related project (requires mentioning which)
- split: propose splitting into 2 focused children
- reframe: propose a new angle / positioning
- snapshot: propose capturing current state as a standalone artifact (essay, note, sketch) and retiring the full project${allowHandoff ? '\n- handoff: propose handing off to someone else' : ''}

RULES
- The proposal must cite the provided evidence. If you can't, return mode='none'.
- Return concrete, specific text. No platitudes.

Return JSON only:
{ "mode": "shrink|merge|split|reframe|snapshot${allowHandoff ? '|handoff' : ''}|none", "title": "new title if applicable", "proposal": "2-3 sentence concrete proposal", "evidence": "the evidence you cited" }`
        try {
          const raw = await generateText(prompt, { temperature: 0.5, maxTokens: 400, responseFormat: 'json' })
          const parsed = JSON.parse(raw)
          if (!parsed?.mode || parsed.mode === 'none' || !parsed.proposal) return null
          if (!MUTATION_MODES.includes(parsed.mode)) return null
          if (parsed.mode === 'handoff' && !allowHandoff) return null
          return {
            project_id: p.id,
            project_title: p.title,
            mode: parsed.mode,
            title: parsed.title || p.title,
            proposal: parsed.proposal,
            evidence: parsed.evidence || evidence,
          }
        } catch (e) {
          console.warn('[generate-digest] evolve-project failed for', p.id, e)
          return null
        }
      }))

      const evolutions = proposals.filter((e): e is Evolution => e !== null).slice(0, 2)

      const { data: digestRow, error: insertErr } = await supabase
        .from('drawer_digests')
        .insert([{
          user_id: userId,
          warmed: warmed.map((p: any) => ({
            id: p.id,
            title: p.title,
            heat_score: p.heat_score,
            heat_reason: p.heat_reason,
          })),
          evolutions,
          status: 'unread',
        }])
        .select()
        .single()

      if (insertErr) {
        return res.status(500).json({ error: 'Failed to write digest', details: insertErr.message })
      }

      return res.status(200).json({ success: true, digest: digestRow, warmed: warmed.length, evolutions: evolutions.length })
    } catch (error) {
      console.error('[generate-digest] error:', error)
      return res.status(500).json({
        error: 'Failed to generate digest',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Read the latest unread digest for this user, or null.
  if (resource === 'digest' && req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('drawer_digests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'unread')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        return res.status(500).json({ error: 'Failed to read digest', details: error.message })
      }
      return res.status(200).json({ digest: data || null })
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to read digest',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (resource === 'digest-act' && req.method === 'POST') {
    try {
      const { digest_id, action, evolution_index } = req.body as {
        digest_id: string
        action: 'read' | 'accept'
        evolution_index?: number
      }
      if (!digest_id || !action) {
        return res.status(400).json({ error: 'digest_id and action required' })
      }

      const { data: digest } = await supabase
        .from('drawer_digests')
        .select('*')
        .eq('id', digest_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (!digest) {
        return res.status(404).json({ error: 'Digest not found' })
      }

      if (action === 'read') {
        await supabase
          .from('drawer_digests')
          .update({ status: 'read' })
          .eq('id', digest_id)
          .eq('user_id', userId)
        return res.status(200).json({ success: true })
      }

      if (action === 'accept') {
        const evolutions = (digest.evolutions || []) as Array<{
          project_id: string
          mode: MutationMode
          title?: string
          proposal: string
          evidence: string
        }>
        const idx = typeof evolution_index === 'number' ? evolution_index : 0
        const evo = evolutions[idx]
        if (!evo) {
          return res.status(400).json({ error: 'evolution_index out of range' })
        }

        const { data: parent } = await supabase
          .from('projects')
          .select('id, title, description, type, lineage_root_id')
          .eq('id', evo.project_id)
          .eq('user_id', userId)
          .maybeSingle()

        if (!parent) {
          return res.status(404).json({ error: 'Parent project not found' })
        }

        const lineageRoot = parent.lineage_root_id || parent.id

        const { data: child, error: childErr } = await supabase
          .from('projects')
          .insert([{
            user_id: userId,
            title: evo.title || `${parent.title} (${evo.mode})`,
            description: evo.proposal,
            type: parent.type || 'hobby',
            status: 'upcoming',
            parent_id: parent.id,
            lineage_root_id: lineageRoot,
            metadata: {
              mutation: {
                mode: evo.mode,
                evidence: evo.evidence,
                parent_id: parent.id,
                accepted_from_digest: digest_id,
              },
            },
          }])
          .select()
          .single()

        if (childErr) {
          return res.status(500).json({ error: 'Failed to create mutation', details: childErr.message })
        }

        const followUps: PromiseLike<unknown>[] = [
          supabase
            .from('drawer_digests')
            .update({ status: 'acted' })
            .eq('id', digest_id)
            .eq('user_id', userId),
        ]
        if (MODES_THAT_RETIRE_PARENT.has(evo.mode)) {
          followUps.push(
            supabase
              .from('projects')
              .update({ status: 'completed' })
              .eq('id', parent.id)
              .eq('user_id', userId)
          )
        }
        await Promise.all(followUps)

        return res.status(200).json({ success: true, child })
      }

      return res.status(400).json({ error: `Unknown action: ${action}` })
    } catch (error) {
      console.error('[digest-act] error:', error)
      return res.status(500).json({
        error: 'Failed to act on digest',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (resource === 'complete-with-retro' && req.method === 'POST') {
    try {
      const { project_id, answers } = req.body as {
        project_id: string
        answers: { what_worked?: string; what_surprised?: string; what_next?: string }
      }
      if (!project_id || !answers) {
        return res.status(400).json({ error: 'project_id and answers required' })
      }

      const { data: project } = await supabase
        .from('projects')
        .select('id, title, description, type, lineage_root_id, status')
        .eq('id', project_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }

      const persistOps: PromiseLike<unknown>[] = [
        supabase.from('project_retrospectives').insert([{ project_id, user_id: userId, answers }]),
      ]
      if (project.status !== 'completed') {
        persistOps.push(
          supabase
            .from('projects')
            .update({ status: 'completed' })
            .eq('id', project_id)
            .eq('user_id', userId)
        )
      }
      await Promise.all(persistOps)

      let sparks: Array<{ title: string; description: string }> = []
      try {
        const prompt = `A user just finished a project. Read their retrospective and suggest 1-3 NEW sparks (tiny project ideas) that naturally extend from what they just made. Concrete, specific, each written as a noun or verb phrase.

JUST FINISHED
title: ${project.title}
description: ${project.description || '(none)'}

RETRO
What worked: ${answers.what_worked || '(blank)'}
What surprised: ${answers.what_surprised || '(blank)'}
What's next: ${answers.what_next || '(blank)'}

RULES
- Cite the retro. Each spark should feel like a direct continuation.
- Empty array is allowed if the answers don't justify anything concrete.
- No platitudes. No generic self-improvement ideas.

Return JSON only:
{ "sparks": [ { "title": "...", "description": "one-sentence concrete brief" }, ... ] }`
        const raw = await generateText(prompt, { temperature: 0.6, maxTokens: 500, responseFormat: 'json' })
        const parsed = JSON.parse(raw)
        const list = Array.isArray(parsed.sparks) ? parsed.sparks : []
        sparks = list
          .filter((s: any) => s && typeof s.title === 'string' && s.title.trim().length >= 3)
          .slice(0, 3)
          .map((s: any) => ({ title: String(s.title).trim(), description: String(s.description || '').trim() }))
      } catch (e) {
        console.warn('[complete-with-retro] spark generation failed:', e)
      }

      let createdSparks: unknown[] = []
      if (sparks.length > 0) {
        const { data } = await supabase
          .from('project_suggestions')
          .insert(sparks.map(s => ({
            user_id: userId,
            title: s.title,
            description: s.description,
            status: 'pending',
            total_points: 5,
            metadata: {
              from_retrospective: project_id,
              parent_project_title: project.title,
            },
          })))
          .select()
        createdSparks = data || []
      }

      return res.status(200).json({ success: true, sparks: createdSparks })
    } catch (error) {
      console.error('[complete-with-retro] error:', error)
      return res.status(500).json({
        error: 'Failed to record retrospective',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (resource === 'metabolism-settings') {
    if (req.method === 'GET') {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('allow_handoff_mutations')
          .eq('user_id', userId)
          .maybeSingle()
        return res.status(200).json({
          allow_handoff_mutations: !!data?.allow_handoff_mutations,
        })
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to read metabolism settings',
          details: error instanceof Error ? error.message : String(error),
        })
      }
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const { allow_handoff_mutations } = req.body as { allow_handoff_mutations: boolean }
        const { error } = await supabase
          .from('user_settings')
          .upsert(
            { user_id: userId, allow_handoff_mutations: !!allow_handoff_mutations },
            { onConflict: 'user_id' }
          )
        if (error) {
          return res.status(500).json({ error: 'Failed to save', details: error.message })
        }
        return res.status(200).json({ success: true, allow_handoff_mutations: !!allow_handoff_mutations })
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to save metabolism settings',
          details: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CAPABILITY PAIRS RESOURCE - Fetch learned pair weights
  if (resource === 'capability-pairs') {
    if (req.method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('capability_pair_scores')
          .select('capability_a, capability_b, weight')
          .eq('user_id', userId)
          .order('weight', { ascending: false })
          .limit(10)

        if (error) {
          console.error('[capability-pairs] Query error:', error)
          return res.json({ pairs: [] })
        }

        return res.json({ pairs: data || [] })
      } catch (error) {
        console.error('[capability-pairs] Error:', error)
        return res.json({ pairs: [] })
      }
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // SUGGESTIONS RESOURCE (merged from suggestions.ts)
  if (resource === 'suggestions') {
    const action = req.query.action as string
    const id = req.query.id as string

    // GET: List suggestions
    if (req.method === 'GET') {
      return handleListSuggestions(req, res, supabase, userId)
    }

    // POST: Rate suggestion
    if (req.method === 'POST' && action === 'rate') {
      return handleRateSuggestion(req, res, id, supabase, userId)
    }

    // POST: Build project from suggestion
    if (req.method === 'POST' && action === 'build') {
      return handleBuildFromSuggestion(req, res, id, supabase, userId)
    }

    // DELETE: Clear all pending suggestions
    if (req.method === 'DELETE' && action === 'clear') {
      try {
        console.log('[suggestions] Clearing pending suggestions for user:', userId)
        const { count, error } = await supabase
          .from('project_suggestions')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .eq('status', 'pending')

        if (error) throw error

        return res.status(200).json({ success: true, count })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to clear suggestions' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // BEDTIME IDEAS RESOURCE (merged from bedtime.ts)
  if (resource === 'bedtime') {
    const action = req.query.action as string

    // GET - Fetch today's prompts (or latest)
    if (req.method === 'GET') {
      // GET last breakthrough prompt (for morning follow-up)
      if (action === 'last-breakthrough') {
        try {
          const { data } = await supabase
            .from('bedtime_prompts')
            .select('*')
            .eq('user_id', userId)
            .eq('resulted_in_breakthrough', true)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return res.json({ prompt: data || null })
        } catch (error) {
          console.error('[bedtime] last-breakthrough error:', error)
          return res.json({ prompt: null })
        }
      }

      return handleGetBedtimePrompts(req, res, supabase, userId)
    }

    // POST - Generate new prompts (manual trigger or catalyst prompts)
    if (req.method === 'POST') {
      // Catalyst prompts endpoint: POST with inputs array
      if (action === 'catalyst') {
        return handleGenerateCatalystPrompts(req, res, supabase, userId)
      }

      // Morning follow-up: link response to bedtime prompt
      if (action === 'follow-up') {
        try {
          const { id } = req.query
          const { response } = req.body

          // Create memory from follow-up
          const { data: memory } = await supabase.from('memories').insert({
            user_id: userId,
            title: 'Morning insight',
            body: response,
            audiopen_id: `morning_${Date.now()}`,
            tags: ['morning-followup', 'bedtime-synthesis'],
            memory_type: 'insight',
            audiopen_created_at: new Date().toISOString(),
            processed: false
          }).select().single()

          // Link memory to the bedtime prompt
          if (memory && id) {
            await supabase.from('bedtime_prompts').update({
              follow_up_memory_ids: [memory.id]
            }).eq('id', id)
          }

          return res.json({ success: true, memory })
        } catch (error) {
          console.error('[bedtime] follow-up error:', error)
          return res.status(500).json({ error: 'Failed to save follow-up' })
        }
      }

      // Update prompt type scoring
      if (action === 'update-type-score') {
        try {
          const { prompt_type, is_breakthrough } = req.body

          // Upsert the type score
          const { data: existing } = await supabase
            .from('prompt_type_scores')
            .select('*')
            .eq('user_id', userId)
            .eq('prompt_type', prompt_type)
            .single()

          const shownCount = (existing?.shown_count || 0) + 1
          const breakthroughCount = (existing?.breakthrough_count || 0) + (is_breakthrough ? 1 : 0)
          const score = Math.max(0.1, breakthroughCount / Math.max(shownCount, 1))

          await supabase.from('prompt_type_scores').upsert({
            user_id: userId,
            prompt_type,
            shown_count: shownCount,
            breakthrough_count: breakthroughCount,
            score,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,prompt_type' })

          return res.json({ success: true })
        } catch (error) {
          console.error('[bedtime] update-type-score error:', error)
          return res.status(500).json({ error: 'Failed to update type score' })
        }
      }

      // Standard bedtime prompts
      return handleGenerateBedtimePrompts(req, res, supabase, userId)
    }

    // PATCH - Mark prompts as viewed
    if (req.method === 'PATCH') {
      return handleMarkBedtimeViewed(req, res, supabase, userId)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // INTERSECTIONS — Weekly cached deck of AI-discovered crossover cards.
  //
  // Cards are now generated once a week by the daily cron's Monday branch
  // (see api/_lib/intersection-weekly.ts) and persisted in the
  // `weekly_intersections` table. The GET handler is a thin row read so the
  // home page renders instantly. POST handles per-card feedback ('good' /
  // 'bad') and the "Shape this idea" promote flow that creates a real
  // upcoming project from a card so the user can chat-shape it via the
  // existing project chat (InlineGuide).
  //
  // See docs/INTERSECTIONS.md for the intellectual framework.
  if (resource === 'intersections') {
    const action = req.query.action as string | undefined

    // GET — read current week's cards instantly from the cache row.
    if (req.method === 'GET') {
      try {
        const { data } = await supabase
          .from('weekly_intersections')
          .select('intersections, insights, feedback, generated_at, expires_at')
          .eq('user_id', userId)
          .maybeSingle()

        return res.status(200).json({
          intersections: data?.intersections ?? [],
          insights: data?.insights ?? [],
          feedback: data?.feedback ?? {},
          generated_at: data?.generated_at ?? null,
          expires_at: data?.expires_at ?? null,
          next_refresh_at: data?.expires_at ?? null,
        })
      } catch (error) {
        console.error('[intersections] GET error:', error)
        return res.status(500).json({ error: 'Failed to load intersections' })
      }
    }

    // POST ?action=feedback — record a 'good' or 'bad' rating on a card.
    if (req.method === 'POST' && action === 'feedback') {
      try {
        const { card_id, rating } = (req.body || {}) as { card_id?: string; rating?: 'good' | 'bad' }
        if (!card_id || (rating !== 'good' && rating !== 'bad')) {
          return res.status(400).json({ error: 'card_id and rating ("good" | "bad") required' })
        }

        const { data: row } = await supabase
          .from('weekly_intersections')
          .select('feedback')
          .eq('user_id', userId)
          .maybeSingle()

        const existing = (row?.feedback ?? {}) as Record<string, 'good' | 'bad'>
        const merged = { ...existing, [card_id]: rating }

        const { error: upsertErr } = await supabase
          .from('weekly_intersections')
          .update({ feedback: merged, updated_at: new Date().toISOString() })
          .eq('user_id', userId)

        if (upsertErr) {
          console.error('[intersections] feedback update failed:', upsertErr)
          return res.status(500).json({ error: 'Failed to record feedback' })
        }

        return res.status(200).json({ success: true, feedback: merged })
      } catch (error) {
        console.error('[intersections] feedback error:', error)
        return res.status(500).json({ error: 'Failed to record feedback' })
      }
    }

    // POST ?action=promote — turn a card into a real upcoming project so the
    // user can develop it via the existing project chat. Also marks the card
    // as 'good' in feedback.
    if (req.method === 'POST' && action === 'promote') {
      try {
        const { card_id } = (req.body || {}) as { card_id?: string }
        if (!card_id) {
          return res.status(400).json({ error: 'card_id required' })
        }

        const { data: row } = await supabase
          .from('weekly_intersections')
          .select('intersections, insights, feedback')
          .eq('user_id', userId)
          .maybeSingle()

        if (!row) {
          return res.status(404).json({ error: 'No weekly intersections to promote from' })
        }

        const all = [
          ...((row.intersections ?? []) as IntersectionPayload[]),
          ...((row.insights ?? []) as IntersectionPayload[]),
        ]
        const card = all.find(c => c.id === card_id)
        if (!card) {
          return res.status(404).json({ error: 'Card not found' })
        }

        // Build the project record. Falls back gracefully if the card lacks
        // a crossover (older cards may only have a `reason`).
        const title = card.crossover?.crossover_title?.trim() || 'Untitled crossover'
        const description = card.crossover?.concept || card.reason || ''
        const motivation = card.crossover?.why_it_works || ''
        const firstSteps = card.crossover?.first_steps ?? []

        const nowIso = new Date().toISOString()
        const tasks = firstSteps.map((text, idx) => ({
          id: `task-${Date.now()}-${idx}`,
          text,
          done: false,
          order: idx,
        }))

        const sourceNodeIds = (card.nodes ?? []).map(n => n.id)

        const { data: project, error: insertErr } = await supabase
          .from('projects')
          .insert([{
            user_id: userId,
            title,
            description,
            type: 'creative',
            status: 'upcoming',
            metadata: {
              tasks,
              motivation,
              shaped_from_intersection: {
                card_id: card.id,
                source_node_ids: sourceNodeIds,
                shaped_at: nowIso,
              },
            },
          }])
          .select('id')
          .single()

        if (insertErr || !project) {
          console.error('[intersections] promote: project insert failed:', insertErr)
          return res.status(500).json({ error: 'Failed to create project from card' })
        }

        // Mark the card as 'good' in feedback so the UI greys/saved-state
        // persists across reloads.
        const existingFeedback = (row.feedback ?? {}) as Record<string, 'good' | 'bad'>
        await supabase
          .from('weekly_intersections')
          .update({
            feedback: { ...existingFeedback, [card_id]: 'good' },
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        return res.status(200).json({ success: true, project_id: project.id })
      } catch (error) {
        console.error('[intersections] promote error:', error)
        return res.status(500).json({ error: 'Failed to promote intersection' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // BREAK PROMPTS RESOURCE (Daytime Drift)
  if (resource === 'break') {
    if (req.method === 'GET') {
      try {
        const prompts = await generateBreakPrompts(userId)
        return res.status(200).json({ prompts, generated: true })
      } catch (error) {
        console.error('[break] Error:', error)
        return res.status(500).json({ error: 'Failed to generate break prompts' })
      }
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // NEXT STEPS RESOURCE (AI Suggestions)
  if (resource === 'next-steps') {
    const id = req.query.id as string
    const action = req.query.action as string

    if (!id && req.method !== 'PATCH') {
      return res.status(400).json({ error: 'Project ID required' })
    }

    // GET: Fetch suggestions (auto-generate if stale/missing)
    if (req.method === 'GET') {
      return handleGetNextSteps(req, res, supabase, userId, id)
    }

    // POST: Force regenerate
    if (req.method === 'POST' && action === 'regenerate') {
      return handleGenerateNextSteps(req, res, supabase, userId, id)
    }

    // PATCH: Update status
    if (req.method === 'PATCH') {
      return handleUpdateNextStepStatus(req, res, supabase, userId)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // KNOWLEDGE MAP RESOURCE - DEPRECATED
  if (resource === 'knowledge_map') {
    return res.status(410).json({ error: 'Knowledge Map feature has been deprecated.' })
  }

  // REAPER RESOURCE (for managing rotting projects)
  if (resource === 'reaper') {
    const action = req.query.action as string
    const id = req.query.id as string

    // GET: Get rotting projects, generate eulogy, or pick synthesis candidate
    if (req.method === 'GET') {
      if (action === 'synthesis-pick') {
        try {
          const candidate = await pickSynthesisResurfaceCandidate(userId)
          return res.status(200).json({ project: candidate })
        } catch (error) {
          console.error('[reaper] Failed to pick synthesis candidate:', error)
          return res.status(500).json({ error: 'Failed to pick synthesis candidate' })
        }
      } else if (action === 'rotting') {
        try {
          const rottingProjects = await identifyRottingProjects(userId)
          return res.status(200).json(rottingProjects)
        } catch (error) {
          console.error('[reaper] Failed to get rotting projects:', error)
          return res.status(500).json({ error: 'Failed to get rotting projects' })
        }
      } else if (action === 'eulogy') {
        if (!id) return res.status(400).json({ error: 'Project ID required' })
        try {
          // Fetch project details for eulogy generation
          const { data: project, error: fetchError } = await supabase
            .from('projects')
            .select('title, description')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

          if (fetchError) throw fetchError
          if (!project) return res.status(404).json({ error: 'Project not found' })

          const zebraReport = await generateZebraReport(project)
          return res.status(200).json({ eulogy: zebraReport }) // Keep key as 'eulogy' or change to 'zebraReport' if frontend is updated. 
          // Actually, I'll keep the key as 'eulogy' for backward compatibility unless I find the frontend.
        } catch (error) {
          console.error('[reaper] Failed to generate eulogy:', error)
          return res.status(500).json({ error: 'Failed to generate eulogy' })
        }
      }
    }

    // POST: Bury or Resurrect a project
    if (req.method === 'POST') {
      if (!id) return res.status(400).json({ error: 'Project ID required' })
      if (action === 'bury') {
        try {
          await buryProject(id, userId)
          return res.status(200).json({ success: true, message: 'Project buried' })
        } catch (error) {
          console.error('[reaper] Failed to bury project:', error)
          return res.status(500).json({ error: 'Failed to bury project' })
        }
      } else if (action === 'resurrect') {
        try {
          await resurrectProject(id, userId)
          return res.status(200).json({ success: true, message: 'Project resurrected' })
        } catch (error) {
          console.error('[reaper] Failed to resurrect project:', error)
          return res.status(500).json({ error: 'Failed to resurrect project' })
        }
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CONTEXT RESOURCE
  if (resource === 'context') {
    if (req.method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('user_daily_context')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('[context] Query error:', error)
          return res.status(500).json({ error: error.message })
        }

        const context: UserContext = data || {
          available_time: 'moderate',
          current_energy: 'moderate',
          available_context: ['desk', 'computer']
        }

        return res.status(200).json({ context })
      } catch (error) {
        console.error('[context] Error:', error)
        return res.status(500).json({ error: 'Internal server error' })
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const { available_time, current_energy, available_context } = req.body

        if (available_time && !['quick', 'moderate', 'deep'].includes(available_time)) {
          return res.status(400).json({
            error: 'Invalid available_time. Must be: quick, moderate, or deep'
          })
        }

        if (current_energy && !['low', 'moderate', 'high'].includes(current_energy)) {
          return res.status(400).json({
            error: 'Invalid current_energy. Must be: low, moderate, or high'
          })
        }

        if (available_context && !Array.isArray(available_context)) {
          return res.status(400).json({
            error: 'Invalid available_context. Must be an array'
          })
        }

        const { data, error } = await supabase
          .from('user_daily_context')
          .upsert({
            user_id: userId,
            available_time: available_time || 'moderate',
            current_energy: current_energy || 'moderate',
            available_context: available_context || ['desk', 'computer'],
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          console.error('[context] Upsert error:', error)
          return res.status(500).json({ error: error.message })
        }

        return res.status(200).json({ context: data })
      } catch (error) {
        console.error('[context] Error:', error)
        return res.status(500).json({ error: 'Internal server error' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // DAILY QUEUE RESOURCE
  if (resource === 'daily-queue') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { data: contextData } = await supabase
        .from('user_daily_context')
        .select('*')
        .eq('user_id', userId)
        .single()

      const context: UserContext = contextData || {
        available_time: 'moderate',
        current_energy: 'moderate',
        available_context: ['desk', 'computer']
      }

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_active', { ascending: false })

      if (error) {
        console.error('[daily-queue] Query error:', error)
        return res.status(500).json({ error: error.message })
      }

      if (!projects || projects.length === 0) {
        return res.status(200).json({
          queue: [],
          context,
          total_projects: 0
        })
      }

      const scores = projects.map(project => scoreProject(project, context))
      const queue = selectDailyQueue(scores)

      return res.status(200).json({
        queue,
        context,
        total_projects: projects.length
      })
    } catch (error) {
      console.error('[daily-queue] Error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // NOTES RESOURCE
  if (resource === 'notes') {
    if (req.method === 'POST') {
      try {
        const { project_id, bullets, note_type } = req.body

        if (!project_id || !bullets || !Array.isArray(bullets)) {
          return res.status(400).json({
            error: 'project_id and bullets array required'
          })
        }

        const { data, error } = await supabase
          .from('project_notes')
          .insert([{
            project_id,
            user_id: userId,
            bullets,
            created_at: new Date().toISOString()
          }])
          .select()
          .single()

        if (error) throw error

        // Update project last_active
        await supabase
          .from('projects')
          .update({ last_active: new Date().toISOString() })
          .eq('id', project_id)

        return res.status(201).json({
          success: true,
          note: { ...data, note_type }
        })
      } catch (error) {
        console.error('[notes] Failed to create note:', error)
        return res.status(500).json({ error: 'Failed to create note' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // PROJECTS CRUD (default)
  if (req.method === 'GET') {
    try {
      const { id, include_notes, filter } = req.query

      // Single project with notes
      if (id && typeof id === 'string') {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single()

        if (projectError) throw projectError

        if (!project) {
          return res.status(404).json({ error: 'Project not found' })
        }

        // Fetch notes if requested
        let notes = []
        if (include_notes === 'true') {
          const { data: notesData, error: notesError } = await supabase
            .from('project_notes')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false })

          if (notesError) throw notesError
          notes = notesData || []
        }

        return res.status(200).json({
          success: true,
          project,
          notes
        })
      }

      // List all projects with optional status filtering
      let query = supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Apply status filter if provided
      if (filter && filter !== 'all') {
        if (filter === 'upcoming') {
          query = query.eq('status', 'upcoming')
        } else if (filter === 'active') {
          query = query.eq('status', 'active')
        } else if (filter === 'dormant') {
          query = query.in('status', ['dormant', 'on-hold', 'maintaining'])
        } else if (filter === 'completed') {
          query = query.eq('status', 'completed')
        }
      }

      const { data, error } = await query

      if (error) throw error

      return res.status(200).json({ projects: data || [] })
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      return res.status(500).json({ error: 'Failed to fetch projects' })
    }
  }

  if (req.method === 'POST') {
    try {
      const projectData = {
        ...req.body,
        type: req.body.type || 'hobby', // Default to hobby if not provided
        user_id: userId,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      }

      const { data: project, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single()

      if (error) {
        console.error('[projects] Insert error:', error)

        // Check for constraint violation on type
        if (error.message?.includes('projects_type_check') || error.code === '23514') {
          return res.status(400).json({
            error: 'Invalid project type',
            details: `Type must be one of: 'creative', 'technical', or 'learning'. Received: '${projectData.type}'`,
            suggestion: 'Valid types: creative (artistic/hobby), technical (coding/building), learning (educational)'
          })
        }

        throw error
      }

      // Generate embedding and auto-suggest connections asynchronously (don't block response)
      // Return project immediately, then process connections in background
      const backgroundPromise = (async () => {
        try {
          await generateProjectEmbeddingAndConnect(project.id, project.title, project.description, userId)

          const { ensureProjectHasTasks } = await import('./_lib/project-repair.js')
          await ensureProjectHasTasks(project.id, userId)

          try {
            const { inferCatalysts } = await import('./_lib/metabolism.js')
            const catalysts = await inferCatalysts(project.title, project.description || '')
            if (catalysts.length > 0) {
              await supabase
                .from('projects')
                .update({ catalysts })
                .eq('id', project.id)
                .eq('user_id', userId)
            }
          } catch (catErr) {
            console.warn('[projects] Catalyst inference failed (non-fatal):', catErr)
          }
        } catch (err) {
          console.error('[projects] Background scaffolding error:', err)
        }
      })()

      return res.status(201).json({
        ...project,
        _meta: {
          processing_connections: true,
          message: 'AI is finding related items in the background'
        }
      })
    } catch (error) {
      console.error('[projects] Failed to create project:', error)
      return res.status(500).json({
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const projectId = req.query.id as string

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required in query parameter' })
      }

      // Remove id from updates if present in body
      const { id: _bodyId, ...updates } = req.body

      console.log('[PATCH] Updating project:', projectId, 'with data:', updates)

      // First, fetch the project to get its current state
      const { data: existingProject, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        console.error('[PATCH] Failed to fetch project:', fetchError)
        return res.status(500).json({
          error: 'Failed to fetch project',
          details: fetchError.message
        })
      }

      if (!existingProject) {
        return res.status(404).json({ error: 'Project not found' })
      }

      // If metadata with tasks is being updated, analyze new tasks
      if (updates.metadata?.tasks) {
        const newTasks = (updates.metadata.tasks || []) as any[]
        const existingTasks = (existingProject.metadata?.tasks || []) as any[]

        // Find newly added tasks (those not in the existing tasks)
        const addedTasks = newTasks.filter(
          newTask => !existingTasks.some(existingTask => existingTask.id === newTask.id)
        )

        if (addedTasks.length > 0) {
          console.log('[PATCH] Analyzing', addedTasks.length, 'new tasks for energy levels')

          // Analyze each new task in parallel
          const analyzedTasks = await Promise.all(
            addedTasks.map(async (task) => {
              try {
                const analysis = await analyzeTaskEnergy(
                  task.text,
                  existingProject.title,
                  existingProject.description
                )
                return {
                  ...task,
                  energy_level: analysis.energy_level,
                  energy_reasoning: analysis.reasoning
                }
              } catch (error) {
                console.error('[PATCH] Failed to analyze task:', task.text, error)
                return task // Return unmodified if analysis fails
              }
            })
          )

          // Replace the new tasks with analyzed versions
          const updatedNewTasks = newTasks.map(task => {
            const analyzed = analyzedTasks.find(t => t.id === task.id)
            return analyzed || task
          })

          updates.metadata.tasks = updatedNewTasks
          console.log('[PATCH] Task analysis complete, updated tasks with energy levels')
        }
      }

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('[PATCH] Supabase error:', error)
        return res.status(500).json({
          error: 'Failed to update project',
          details: error.message,
          code: error.code
        })
      }

      if (!data) {
        return res.status(404).json({ error: 'Project not found' })
      }

      console.log('[PATCH] Successfully updated project')

      // COST OPTIMIZATION: Invalidate Power Hour cache instead of regenerating
      // This saves ~18K tokens per update. Cache will regenerate on-demand when user requests it.
      if (updates.metadata?.tasks) {
        console.log('[PATCH] Tasks changed, invalidating Power Hour cache for this project')
        invalidateProjectCache(projectId).catch(err =>
          console.error('[PATCH] Failed to invalidate Power Hour cache:', err)
        )
      }

      return res.status(200).json(data)
    } catch (error) {
      console.error('[PATCH] Unexpected error:', error)
      return res.status(500).json({
        error: 'Failed to update project',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error

      return res.status(204).end()
    } catch (error) {
      console.error('Failed to delete project:', error)
      return res.status(500).json({ error: 'Failed to delete project' })
    }
  }

  // EVOLUTION FEED RESOURCE — GET recent evolution events for the home feed
  if (resource === 'evolution-feed') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    const limit = parseInt(req.query.limit as string || '10', 10)
    try {
      const { data: events, error } = await supabase
        .from('evolution_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error && error.code !== 'PGRST116') {
        // Table may not exist yet — return empty
        return res.status(200).json({ events: [] })
      }
      return res.status(200).json({ events: events || [] })
    } catch {
      return res.status(200).json({ events: [] })
    }
  }

  // EVOLVE RESOURCE — POST to trigger project evolution / nightly reshaping
  if (resource === 'evolve') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { project_id } = req.body || {}
    try {
      // Fetch projects to evolve
      let projectsQuery = supabase.from('projects').select('id, title, description, metadata').eq('user_id', userId)
      if (project_id) projectsQuery = projectsQuery.eq('id', project_id)
      else projectsQuery = projectsQuery.in('status', ['active', 'upcoming'])

      const { data: projects, error: projectsError } = await projectsQuery
      if (projectsError) {
        console.error('[evolve] projects query failed:', projectsError)
        return res.status(500).json({ error: projectsError.message, stage: 'fetch_projects' })
      }

      const candidates = (projects || []).slice(0, 5)
      console.log(`[evolve] starting: user=${userId} candidates=${candidates.length} (project_id=${project_id || 'auto'})`)

      if (candidates.length === 0) {
        return res.status(200).json({ evolved: 0, project_ids: [], reason: 'no candidate projects' })
      }

      // Generate insights in parallel — sequential calls were taking ~5-6s
      // each, so 5-10 projects pushed total wall-clock past the 60s function
      // timeout. Parallelism brings it down to ~the slowest single call.
      type Outcome = { project_id: string; ok: boolean; error?: string }
      const outcomes = await Promise.all(candidates.map(async (project): Promise<Outcome> => {
        try {
          const prompt = `You are a creative catalyst AI. Given this project, generate a fresh evolution insight — a new angle, intersection, or breakthrough idea that could reshape it.

Project: ${project.title}
Description: ${project.description || 'No description'}
Current notes: ${JSON.stringify(project.metadata?.tasks?.slice(0, 3) || [])}

Respond with JSON: { "event_type": "intersection"|"reshape"|"reflection", "description": "one specific, surprising insight in plain language (max 2 sentences)" }`

          const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.8 })
          let insight: { event_type?: string; description?: string }
          try {
            insight = JSON.parse(response)
          } catch (parseErr) {
            console.warn(`[evolve] JSON parse failed for project ${project.id}:`, parseErr instanceof Error ? parseErr.message : parseErr)
            return { project_id: project.id, ok: false, error: 'parse_failed' }
          }

          if (!insight?.description) {
            return { project_id: project.id, ok: false, error: 'no_description' }
          }

          // event_type must satisfy the CHECK constraint on evolution_events
          const validTypes = new Set(['intersection', 'reshape', 'reflection'])
          const eventType = validTypes.has(insight.event_type ?? '') ? insight.event_type! : 'reshape'

          const { error: insertErr } = await supabase.from('evolution_events').insert({
            user_id: userId,
            project_id: project.id,
            event_type: eventType,
            highlight: false, // we'll mark one as highlight after the parallel pass
            description: insight.description,
            created_at: new Date().toISOString(),
          })
          if (insertErr) {
            console.warn(`[evolve] insert failed for project ${project.id}:`, insertErr.message)
            return { project_id: project.id, ok: false, error: insertErr.message }
          }
          return { project_id: project.id, ok: true }
        } catch (err) {
          console.warn(`[evolve] project ${project.id} failed:`, err instanceof Error ? err.message : err)
          return { project_id: project.id, ok: false, error: err instanceof Error ? err.message : 'unknown' }
        }
      }))

      const evolved = outcomes.filter(o => o.ok).map(o => o.project_id)
      const failed = outcomes.filter(o => !o.ok)

      // Mark the first successful insight as the highlight (post-hoc, since
      // the parallel pass doesn't know the order).
      if (evolved.length > 0) {
        const firstEvolvedId = evolved[0]
        await supabase
          .from('evolution_events')
          .update({ highlight: true })
          .eq('user_id', userId)
          .eq('project_id', firstEvolvedId)
          .order('created_at', { ascending: false })
          .limit(1)
      }

      console.log(`[evolve] done: ${evolved.length}/${candidates.length} succeeded${failed.length ? `, ${failed.length} failed` : ''}`)
      return res.status(200).json({
        evolved: evolved.length,
        project_ids: evolved,
        failures: failed.length,
      })
    } catch (error) {
      console.error('[evolve] handler crash:', error)
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Evolution failed',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join('\n') : undefined,
      })
    }
  }

  // SAVE-IDEA RESOURCE — POST to save an onboarding suggestion as a saved idea
  if (resource === 'save-idea') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { title, description, reasoning, source } = req.body || {}
    if (!title) return res.status(400).json({ error: 'title is required' })
    try {
      const { data, error } = await supabase
        .from('project_suggestions')
        .insert({
          user_id: userId,
          title,
          description: description || '',
          reasoning: reasoning || '',
          status: 'pending',
          total_points: 0,
          metadata: { source: source || 'onboarding', saved_at: new Date().toISOString() },
        })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ idea: data })
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save idea' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

/**
 * List suggestions (merged from suggestions.ts)
 */
async function handleListSuggestions(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    // Query parameters
    const {
      status = 'pending',
      limit = '20',
      offset = '0',
      include_rated = 'false'
    } = req.query

    let query = supabase
      .from('project_suggestions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('total_points', { ascending: false })

    // Filter by status
    if (status !== 'all') {
      if (include_rated === 'true') {
        // Show pending + rated suggestions
        query = query.in('status', ['pending', 'spark', 'meh', 'saved'])
      } else {
        // Only show pending
        query = query.eq('status', status)
      }
    }

    // Pagination
    query = query.range(
      Number(offset),
      Number(offset) + Number(limit) - 1
    )

    const { data, error, count } = await query

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Enrich suggestions with capability names
    const enrichedSuggestions = await Promise.all(
      (data || []).map(async (suggestion: any) => {
        if (suggestion.capability_ids && suggestion.capability_ids.length > 0) {
          const { data: capabilities } = await supabase
            .from('capabilities')
            .select('id, name')
            .in('id', suggestion.capability_ids)

          return {
            ...suggestion,
            capabilities: capabilities || []
          }
        }
        return {
          ...suggestion,
          capabilities: []
        }
      })
    )

    return res.status(200).json({
      suggestions: enrichedSuggestions,
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    })

  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Rate a suggestion (merged from suggestions.ts)
 */
async function handleRateSuggestion(req: VercelRequest, res: VercelResponse, id: string, supabase: any, userId: string) {
  if (!id) {
    return res.status(400).json({ error: 'Suggestion ID required' })
  }

  try {
    console.log('[rate] Rating suggestion:', id, 'Body:', req.body)

    const parseResult = RateRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      console.error('[rate] Validation failed:', parseResult.error)
      return res.status(400).json({
        error: 'Invalid rating. Must be: -1 (meh), 1 (spark), or 2 (built)',
        details: parseResult.error
      })
    }

    const { rating, feedback } = parseResult.data
    console.log('[rate] Parsed rating:', rating, 'feedback:', feedback)

    // Store rating
    const { data: ratingData, error: ratingError } = await supabase
      .from('suggestion_ratings')
      .insert({
        suggestion_id: id,
        user_id: userId,
        rating,
        feedback: feedback || null
      })
      .select()
      .single()

    if (ratingError) {
      console.error('[rate] Rating insert error:', ratingError)
      return res.status(500).json({ error: ratingError.message, details: ratingError })
    }

    console.log('[rate] Rating stored:', ratingData)

    // Update suggestion status
    // Map ratings to database-allowed statuses: pending, rated, built, dismissed, saved
    let newStatus: string
    if (rating === 2) {
      newStatus = 'built'  // User wants to build this
    } else if (rating === 1) {
      newStatus = 'rated'  // User likes it (spark)
    } else {
      newStatus = 'dismissed'  // User doesn't want it (meh)
    }
    console.log('[rate] Setting status to:', newStatus)

    const { data: suggestion, error: updateError } = await supabase
      .from('project_suggestions')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[rate] Suggestion update error:', updateError)
      return res.status(500).json({ error: updateError.message, details: updateError })
    }

    console.log('[rate] Suggestion updated:', suggestion)

    // Learn from rating
    try {
      if (rating > 0) {
        console.log('[rate] Incrementing capability strengths for positive rating')
        for (const capabilityId of suggestion.capability_ids || []) {
          await incrementCapabilityStrength(capabilityId, 0.05, supabase)
        }
      } else if (suggestion.capability_ids && suggestion.capability_ids.length > 0) {
        console.log('[rate] Penalizing combination for negative rating')
        await penalizeCombination(suggestion.capability_ids, 0.1, supabase)
      }
    } catch (learningError) {
      console.error('[rate] Learning error (non-fatal):', learningError)
      // Don't fail the request if learning fails
    }

    // Track capability pair scores for learning
    try {
      const capIds: string[] = suggestion.capability_ids || []
      if (capIds.length >= 2) {
        console.log('[rate] Tracking capability pair scores for', capIds.length, 'capabilities')
        for (let i = 0; i < capIds.length; i++) {
          for (let j = i + 1; j < capIds.length; j++) {
            const [capA, capB] = [capIds[i], capIds[j]].sort()
            // Fetch current scores
            const { data: existing } = await supabase
              .from('capability_pair_scores')
              .select('*')
              .eq('user_id', userId)
              .eq('capability_a', capA)
              .eq('capability_b', capB)
              .single()

            const sparkCount = (existing?.spark_count || 0) + (rating === 1 ? 1 : 0)
            const mehCount = (existing?.meh_count || 0) + (rating === -1 ? 1 : 0)
            const builtCount = (existing?.built_count || 0) + (rating === 2 ? 1 : 0)
            const weight = (sparkCount - mehCount) * 0.05 + builtCount * 0.15

            await supabase.from('capability_pair_scores').upsert({
              user_id: userId,
              capability_a: capA,
              capability_b: capB,
              spark_count: sparkCount,
              meh_count: mehCount,
              built_count: builtCount,
              weight,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,capability_a,capability_b' })
          }
        }
        console.log('[rate] Capability pair scores updated')
      }
    } catch (pairError) {
      console.error('[rate] Pair tracking error (non-fatal):', pairError)
      // Don't fail the request if pair tracking fails
    }

    console.log('[rate] Successfully rated suggestion')
    return res.status(200).json({
      success: true,
      rating: ratingData,
      updated_suggestion: {
        id: suggestion.id,
        status: suggestion.status
      }
    })

  } catch (error) {
    console.error('[rate] Unexpected error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}

/**
 * Build a project from suggestion (merged from suggestions.ts)
 */
async function handleBuildFromSuggestion(req: VercelRequest, res: VercelResponse, id: string, supabase: any, userId: string) {
  if (!id) {
    return res.status(400).json({ error: 'Suggestion ID required' })
  }

  const { project_title, project_description, metadata = {} } = req.body

  try {
    // Get suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('project_suggestions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Suggestion not found' })
      }
      return res.status(500).json({ error: fetchError.message })
    }

    const hasCapabilities = suggestion.capability_ids && suggestion.capability_ids.length > 0
    const projectType = metadata.type || (hasCapabilities ? 'side-project' : 'hobby')

    // Create project
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title: project_title || suggestion.title,
        description: project_description || suggestion.description,
        type: projectType,
        status: 'active',
        last_active: new Date().toISOString(),
        metadata: {
          ...metadata,
          from_suggestion: id,
          capabilities: suggestion.capability_ids,
          original_points: suggestion.total_points
        }
      })
      .select()
      .single()

    if (createError) {
      return res.status(500).json({ error: createError.message })
    }

    // Update suggestion
    await supabase
      .from('project_suggestions')
      .update({
        status: 'built',
        built_project_id: project.id
      })
      .eq('id', id)

    // Add automatic +2 rating
    await supabase
      .from('suggestion_ratings')
      .insert({
        suggestion_id: id,
        user_id: userId,
        rating: 2,
        feedback: 'Built this project!'
      })

    // Boost capability strengths significantly
    for (const capabilityId of suggestion.capability_ids || []) {
      await incrementCapabilityStrength(capabilityId, 0.3, supabase)
    }

    // Create project node strength entry
    await supabase
      .from('node_strengths')
      .insert({
        node_type: 'project',
        node_id: project.id,
        strength: 1.5,
        activity_count: 1,
        last_activity: new Date().toISOString()
      })

    return res.status(201).json({
      success: true,
      project,
      suggestion: {
        id: suggestion.id,
        status: 'built',
        built_project_id: project.id
      }
    })

  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Generate embedding for a project and auto-suggest/create connections
 * Runs asynchronously after project creation
 */
async function generateProjectEmbeddingAndConnect(
  projectId: string,
  title: string,
  description: string | null,
  userId: string
) {
  const supabase = getSupabaseClient()

  try {
    console.log(`[projects] Generating embedding for project ${projectId}`)

    // Generate embedding from title + description
    const content = `${title}\n\n${description || ''}`
    const embedding = await generateEmbedding(content)

    // Store embedding in database
    const { error: updateError } = await supabase
      .from('projects')
      .update({ embedding })
      .eq('id', projectId)

    if (updateError) {
      console.error('[projects] Failed to store embedding:', updateError)
      return
    }

    console.log(`[projects] Embedding stored.`)

    // Use shared connection logic to find and create connections
    await updateItemConnections(projectId, 'project', embedding, userId)

  } catch (error) {
    console.error('[projects] Embedding/connection generation failed:', error)
  }
}

/**
 * Bedtime Prompts Handlers (merged from bedtime.ts)
 */
async function handleGetBedtimePrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let data = []
    try {
      const result = await supabase
        .from('bedtime_prompts')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })

      if (result.error) throw result.error
      data = result.data
    } catch (dbError: any) {
      console.warn('[bedtime] Failed to fetch prompts (table might be missing):', dbError.message)
      // Fallback to generation if table is missing (generation handles storage, might also fail but we'll see)
      // Actually, if table missing, generation storage will also fail.
      // Return empty for now to prevent crash
      return res.status(200).json({
        prompts: [],
        generated: false,
        message: 'Feature unavailable (migration pending)'
      })
    }

    // If no prompts today, generate them — time-gating is handled client-side
    // (the floating moon icon only appears after 9:30pm local time). The server
    // runs UTC which differs from the user's timezone, so we don't gate here.
    if (!data || data.length === 0) {
      const prompts = await generateBedtimePrompts(userId)
      return res.status(200).json({
        prompts,
        generated: true,
        message: "Tonight's prompts are ready"
      })
    }

    return res.status(200).json({
      prompts: data,
      generated: false
    })
  } catch (error) {
    console.error('[bedtime] Error:', error)
    return res.status(500).json({
      error: 'Failed to fetch bedtime prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGenerateBedtimePrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const prompts = await generateBedtimePrompts(userId)
    return res.status(201).json({
      prompts,
      generated: true,
      message: `Generated ${prompts.length} bedtime prompts`
    })
  } catch (error) {
    console.error('[bedtime] Error:', error)
    return res.status(500).json({
      error: 'Failed to generate bedtime prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGenerateCatalystPrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { inputs } = req.body

    // Validate inputs
    if (!inputs || !Array.isArray(inputs)) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Request body must include "inputs" array'
      })
    }

    if (inputs.length === 0) {
      return res.status(400).json({
        error: 'Invalid inputs',
        details: 'At least one input required'
      })
    }

    // Validate each input
    for (const input of inputs) {
      if (!input.title || !input.type || !input.id) {
        return res.status(400).json({
          error: 'Invalid input format',
          details: 'Each input must have: title (string), type (project|article|thought), id (string)'
        })
      }
      if (!['project', 'article', 'thought'].includes(input.type)) {
        return res.status(400).json({
          error: 'Invalid input type',
          details: 'Input type must be one of: project, article, thought'
        })
      }
    }

    const prompts = await generateCatalystPrompts(inputs, userId)

    return res.status(201).json({
      prompts,
      generated: true,
      message: `Generated ${prompts.length} catalyst prompts`,
      inputs
    })
  } catch (error) {
    console.error('[catalyst] Error:', error)
    return res.status(500).json({
      error: 'Failed to generate catalyst prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleMarkBedtimeViewed(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { ids, id, rating, resulted_in_breakthrough } = req.body

    // Handle bulk "mark as viewed" (legacy support)
    if (ids && Array.isArray(ids)) {
      const { error } = await supabase
        .from('bedtime_prompts')
        .update({
          viewed: true,
          viewed_at: new Date().toISOString()
        })
        .in('id', ids)
        .eq('user_id', userId)

      if (error) throw error

      return res.status(200).json({ success: true, updated: ids.length })
    }

    // Handle single prompt update (rating or breakthrough)
    if (!id) {
      return res.status(400).json({ error: 'id or ids required' })
    }

    const updates: any = {}

    if (rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating must be a number between 1 and 5' })
      }
      updates.rating = rating
    }

    if (resulted_in_breakthrough !== undefined) {
      if (typeof resulted_in_breakthrough !== 'boolean') {
        return res.status(400).json({ error: 'resulted_in_breakthrough must be a boolean' })
      }
      updates.resulted_in_breakthrough = resulted_in_breakthrough
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    const { error } = await supabase
      .from('bedtime_prompts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    return res.status(200).json({ success: true, updated: updates })
  } catch (error) {
    console.error('[bedtime] Error:', error)
    return res.status(500).json({
      error: 'Failed to update bedtime prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Helper: Increment capability strength (merged from suggestions.ts)
 */
async function incrementCapabilityStrength(capabilityId: string, increment: number, supabase: any) {
  const { data: capability } = await supabase
    .from('capabilities')
    .select('strength')
    .eq('id', capabilityId)
    .single()

  if (!capability) return

  const newStrength = capability.strength + increment

  await supabase
    .from('capabilities')
    .update({
      strength: newStrength,
      last_used: new Date().toISOString()
    })
    .eq('id', capabilityId)

  await supabase
    .from('node_strengths')
    .upsert({
      node_type: 'capability',
      node_id: capabilityId,
      strength: newStrength,
      activity_count: 1,
      last_activity: new Date().toISOString()
    }, {
      onConflict: 'node_type,node_id',
      ignoreDuplicates: false
    })
}

/**
 * Helper: Penalize capability combination (merged from suggestions.ts)
 */
async function penalizeCombination(capabilityIds: string[], penalty: number, supabase: any) {
  try {
    console.log('[penalize] Penalizing combination:', capabilityIds)
    const sortedIds = [...capabilityIds].sort()

    const { data: combo, error: fetchError } = await supabase
      .from('capability_combinations')
      .select('*')
      .eq('capability_ids', sortedIds)
      .maybeSingle()

    if (fetchError) {
      console.error('[penalize] Error fetching combo:', fetchError)
      throw fetchError
    }

    if (!combo) {
      console.log('[penalize] No combo found for:', sortedIds)
      return
    }

    console.log('[penalize] Found combo:', combo)
    const { error: updateError } = await supabase
      .from('capability_combinations')
      .update({
        times_rated_negative: combo.times_rated_negative + 1,
        penalty_score: combo.penalty_score + penalty
      })
      .eq('capability_ids', sortedIds)

    if (updateError) {
      console.error('[penalize] Error updating combo:', updateError)
      throw updateError
    }

    console.log('[penalize] Successfully penalized combination')
  } catch (error) {
    console.error('[penalize] Unexpected error:', error)
    throw error
  }
}
/**
 * Next Steps Handlers
 */
async function handleGetNextSteps(req: VercelRequest, res: VercelResponse, supabase: any, userId: string, projectId: string) {
  try {
    // 1. Check for existing pending suggestions
    const { data: existing, error } = await supabase
      .from('project_next_steps')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3)

    if (error) throw error

    // 2. Check freshness (e.g., 24 hours)
    const isFresh = existing && existing.length > 0 &&
      (new Date().getTime() - new Date(existing[0].created_at).getTime()) < (24 * 60 * 60 * 1000)

    if (isFresh) {
      return res.status(200).json({ suggestions: existing, generated: false })
    }

    // 3. Generate if stale or missing
    console.log('[next-steps] Suggestions stale or missing, generating new ones...')
    const suggestions = await generateNextSteps(projectId, userId, supabase)

    return res.status(200).json({ suggestions, generated: true })

  } catch (error) {
    console.error('[next-steps] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch next steps' })
  }
}

async function handleGenerateNextSteps(req: VercelRequest, res: VercelResponse, supabase: any, userId: string, projectId: string) {
  try {
    const suggestions = await generateNextSteps(projectId, userId, supabase)
    return res.status(200).json({ suggestions, generated: true })
  } catch (error) {
    console.error('[next-steps] Generation error:', error)
    return res.status(500).json({ error: 'Failed to generate next steps' })
  }
}

async function handleUpdateNextStepStatus(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { id, status } = req.body
    if (!id || !status) return res.status(400).json({ error: 'id and status required' })

    const { data, error } = await supabase
      .from('project_next_steps')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({ success: true, suggestion: data })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update status' })
  }
}

async function generateNextSteps(projectId: string, userId: string, supabase: any) {
  // 1. Fetch project context
  const { data: project } = await supabase
    .from('projects')
    .select('title, description, metadata')
    .eq('id', projectId)
    .single()

  if (!project) throw new Error('Project not found')

  const tasks = (project.metadata?.tasks || []) as any[]
  const lastTasks = tasks.slice(-3).map(t => `- ${t.text} (${t.done ? 'Done' : 'Pending'})`).join('\n')

  // 2. Prompt Gemini
  const prompt = `Suggest 3 specific things this person could do next on their project. Start each with a verb. Keep them simple and doable today.
    
Project: ${project.title}
Description: ${project.description || 'No description'}

Recent Activity:
${lastTasks || 'No tasks yet'}

Output strictly as a JSON array of strings. Keep each task under 10 words. Start with a verb.
Example: ["Draft initial outline", "Research competitor pricing", "Email stakeholders"]`

  const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.4 })
  const suggestedTasks = JSON.parse(response)

  if (!Array.isArray(suggestedTasks)) throw new Error('Invalid AI response format')

  // 3. Store in DB
  const inserts = suggestedTasks.map(task => ({
    project_id: projectId,
    user_id: userId,
    suggested_task: task,
    status: 'pending'
  }))

  // Clear old pending ones first (optional, but keeps it clean)
  await supabase
    .from('project_next_steps')
    .update({ status: 'dismissed' })
    .eq('project_id', projectId)
    .eq('status', 'pending')

  const { data, error } = await supabase
    .from('project_next_steps')
    .insert(inserts)
    .select()

  if (error) throw error
  return data
}


// Error handling wrapper
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await internalHandler(req, res)
  } catch (error: any) {
    console.error('[API Error] Unhandled exception:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
      stack: error.stack
    })
  }
}
