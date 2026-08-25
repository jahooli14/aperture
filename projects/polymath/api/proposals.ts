/**
 * Proposals — morph and composite, generated nightly/weekly, reviewed by
 * the user in place (SPEC.md).
 *
 * Resources:
 *   POST ?resource=generate-morph     — cron, nightly. One project max
 *                                       (SPEC.md's rate limit), verified
 *                                       citations only.
 *   POST ?resource=mine-joints        — cron, weekly.
 *   POST ?resource=generate-composite — cron, weekly, after mine-joints.
 *   GET  ?resource=pending            — proposals awaiting review.
 *   POST ?resource=accept             — apply a morph (rewrite the
 *                                       project's description) or a
 *                                       composite (create the child
 *                                       project, inheriting fragments).
 *   POST ?resource=reject             — one-tap "that's not it," which is
 *                                       itself recorded as a capture.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { canMorphProject, anyProjectMorphedToday } from './_lib/morph.js'
import { considerMorph } from './_lib/morph-generator.js'
import { getStalledProjects, proposeComposite } from './_lib/composite-generator.js'
import { mineJoints } from './_lib/joint-miner.js'
import { runDriftDecay } from './_lib/drift-runner.js'

function getCronUserId(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization
  const expectedToken = process.env.IDEA_ENGINE_SECRET
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) return null
  return process.env.IDEA_ENGINE_USER_ID ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string
  const supabase = getSupabaseClient()

  // ─── GENERATE MORPH (cron) ──────────────────────────────────────────
  if (resource === 'generate-morph') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: recentProposals } = await supabase
      .from('proposals')
      .select('created_at')
      .eq('user_id', userId)
      .eq('kind', 'morph')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (anyProjectMorphedToday((recentProposals ?? []).map(p => p.created_at))) {
      return res.status(200).json({ proposed: false, reason: 'already morphed a project today' })
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, description, last_session_ended_at')
      .eq('user_id', userId)
      .neq('state', 'harvested')
      .limit(100)

    const eligible = (projects ?? []).filter(p => canMorphProject(p.last_session_ended_at))
    if (eligible.length === 0) {
      return res.status(200).json({ proposed: false, reason: 'no eligible projects (cooldown)' })
    }

    // Strongest evidence first: the project with the most recent fragments.
    const { data: fragmentCounts } = await supabase
      .from('fragments')
      .select('project_id')
      .eq('user_id', userId)
      .in('project_id', eligible.map(p => p.id))
      .order('created_at', { ascending: false })
      .limit(200)

    const countByProject = new Map<string, number>()
    for (const f of fragmentCounts ?? []) {
      countByProject.set(f.project_id, (countByProject.get(f.project_id) ?? 0) + 1)
    }
    const ranked = [...eligible].sort((a, b) => (countByProject.get(b.id) ?? 0) - (countByProject.get(a.id) ?? 0))
    const target = ranked[0]
    if (!target || (countByProject.get(target.id) ?? 0) === 0) {
      return res.status(200).json({ proposed: false, reason: 'no fragments to draw from' })
    }

    const candidate = await considerMorph(supabase, userId, target)
    if (!candidate) {
      return res.status(200).json({ proposed: false, reason: 'nothing real found, or citation failed' })
    }

    const { error: insertErr } = await supabase.from('proposals').insert({
      user_id: userId,
      kind: 'morph',
      project_id: candidate.projectId,
      proposed_text: candidate.proposedText,
      cited_fragment_ids: candidate.citedFragmentIds,
    })
    if (insertErr) {
      console.error('[proposals] generate-morph insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({ proposed: true, project_id: candidate.projectId })
  }

  // ─── DRIFT DECAY (cron) ─────────────────────────────────────────────
  // High drift + silence -> let it go, quietly, no confirmation (SPEC.md).
  // Never touches the live project, and never deletes fragments/memories.
  if (resource === 'drift-decay') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const result = await runDriftDecay(supabase, userId)
    return res.status(200).json({ harvested: result.harvested.length, project_ids: result.harvested })
  }

  // ─── MINE JOINTS (cron) ─────────────────────────────────────────────
  if (resource === 'mine-joints') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const written = await mineJoints(supabase, userId)
    return res.status(200).json({ joints_written: written })
  }

  // ─── GENERATE COMPOSITE (cron) ──────────────────────────────────────
  if (resource === 'generate-composite') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: pendingComposite } = await supabase
      .from('proposals')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', 'composite')
      .eq('status', 'pending')
      .limit(1)
    if (pendingComposite && pendingComposite.length > 0) {
      return res.status(200).json({ proposed: false, reason: 'a composite is already pending review' })
    }

    const stalled = await getStalledProjects(supabase, userId)
    if (stalled.length < 2) {
      return res.status(200).json({ proposed: false, reason: 'fewer than 2 stalled projects' })
    }

    const { data: joints } = await supabase
      .from('joints')
      .select('id, text, occurrence_count')
      .eq('user_id', userId)
      .gte('occurrence_count', 2)
      .order('last_seen_at', { ascending: false })
      .limit(5)

    if (!joints || joints.length === 0) {
      return res.status(200).json({ proposed: false, reason: 'no recurring joints yet' })
    }

    for (const joint of joints) {
      const candidate = await proposeComposite(joint, stalled)
      if (!candidate) continue

      const { error: insertErr } = await supabase.from('proposals').insert({
        user_id: userId,
        kind: 'composite',
        project_id: candidate.projectIdA,
        project_id_2: candidate.projectIdB,
        joint_id: joint.id,
        proposed_text: candidate.proposedText,
      })
      if (insertErr) {
        console.error('[proposals] generate-composite insert failed:', insertErr)
        return res.status(500).json({ error: insertErr.message })
      }
      return res.status(200).json({ proposed: true, joint_id: joint.id })
    }

    return res.status(200).json({ proposed: false, reason: 'no joint mapped to two stalled projects' })
  }

  // ─── PENDING ─────────────────────────────────────────────────────────
  if (resource === 'pending') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('proposals')
      .select('id, kind, project_id, project_id_2, proposed_text, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ proposals: data ?? [] })
  }

  // ─── ACCEPT ─────────────────────────────────────────────────────────
  if (resource === 'accept') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { proposal_id } = req.body || {}
    if (!proposal_id) return res.status(400).json({ error: 'proposal_id required' })

    const { data: proposal, error: fetchErr } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposal_id)
      .eq('user_id', userId)
      .single()
    if (fetchErr || !proposal) return res.status(404).json({ error: 'proposal not found' })

    if (proposal.kind === 'morph') {
      const { error: updateErr } = await supabase
        .from('projects')
        .update({ description: proposal.proposed_text })
        .eq('id', proposal.project_id)
        .eq('user_id', userId)
      if (updateErr) return res.status(500).json({ error: updateErr.message })
    } else {
      // Composite: create the child project, inheriting fragments from
      // both parents so it starts specified rather than at zero (SPEC.md).
      const { data: child, error: createErr } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          title: proposal.proposed_text.slice(0, 80),
          description: proposal.proposed_text,
          status: 'upcoming',
          state: 'mull',
          parent_id: proposal.project_id,
        })
        .select()
        .single()
      if (createErr) return res.status(500).json({ error: createErr.message })

      const { data: parentFragments } = await supabase
        .from('fragments')
        .select('memory_id, role, fills_slot, text')
        .in('project_id', [proposal.project_id, proposal.project_id_2])
        .eq('user_id', userId)

      if (parentFragments && parentFragments.length > 0) {
        const inherited = parentFragments.map(f => ({
          user_id: userId,
          project_id: child.id,
          memory_id: f.memory_id,
          role: f.role,
          fills_slot: null, // slots are project-specific; the child defines its own
          text: f.text,
        }))
        await supabase.from('fragments').insert(inherited)
      }
    }

    const { error: resolveErr } = await supabase
      .from('proposals')
      .update({ status: 'accepted', resolved_at: new Date().toISOString() })
      .eq('id', proposal_id)
      .eq('user_id', userId)
    if (resolveErr) return res.status(500).json({ error: resolveErr.message })

    return res.status(200).json({ ok: true })
  }

  // ─── REJECT ─────────────────────────────────────────────────────────
  if (resource === 'reject') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { proposal_id, reason } = req.body || {}
    if (!proposal_id) return res.status(400).json({ error: 'proposal_id required' })

    const { error: updateErr } = await supabase
      .from('proposals')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', proposal_id)
      .eq('user_id', userId)
    if (updateErr) return res.status(500).json({ error: updateErr.message })

    // "That's not it" is itself a capture (SPEC.md) -- a cheap voicing, not
    // a full memory-pipeline run, since it's feedback about a proposal
    // rather than new material to embed and fragment-match on its own.
    if (typeof reason === 'string' && reason.trim().length > 0) {
      const uniqueId = `rejection_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await supabase.from('memories').insert({
        audiopen_id: uniqueId,
        title: 'Proposal rejected',
        body: reason.trim(),
        orig_transcript: reason.trim(),
        tags: [],
        audiopen_created_at: new Date().toISOString(),
        processed: true,
        user_id: userId,
      })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: `Unknown resource: ${resource}` })
}
