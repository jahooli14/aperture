/**
 * Fragments — attaching a voicing to a project with a role (SPEC.md).
 *
 * "A project with three references and no deadline behaves differently
 * from the reverse" is the whole point of roles: accumulation without
 * structure is just a longer description. This runs fire-and-forget from
 * capture (process-memory.ts), mirroring bumpHeatFromNewMemory's pattern —
 * a fragment-attach failure must never block memory processing.
 *
 * Best-matching project is found the same way heat scoring does (cosine
 * similarity against project embeddings), then a single capped-thinking
 * Gemini call decides the role and whether it fills a named empty slot.
 * One call, not two — a separate slot-matching pass would double the cost
 * for a decision that's really one judgement ("what kind of thing is this,
 * and does it answer a question this project is already asking").
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { cosineSimilarity } from './gemini-embeddings.js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'

const ATTACH_SIM_THRESHOLD = 0.5
const ROLES = ['reference', 'constraint', 'material', 'deadline', 'obstacle', 'collaborator'] as const
type FragmentRole = typeof ROLES[number]

interface ProjectCandidate {
  id: string
  title: string
  embedding: number[] | null
  slots: Array<{ name: string; filled: boolean }>
}

interface ClassifyResult {
  role: FragmentRole
  fillsSlot: string | null
}

async function classifyFragment(text: string, project: ProjectCandidate): Promise<ClassifyResult | null> {
  const openSlots = project.slots.filter(s => !s.filled).map(s => s.name)

  const prompt = `Someone just captured a thought that connects to their project "${project.title}".

Thought: "${text}"

Open questions this project still has: ${openSlots.length > 0 ? openSlots.join(', ') : 'none named yet'}

What KIND of thing is this thought, in relation to the project? Pick exactly one:
- reference: an inspiration or example
- constraint: a rule or limit it should follow
- material: a physical thing, resource, or asset available to use
- deadline: a time pressure or date
- obstacle: something blocking progress
- collaborator: a person who could help

Does it answer one of the open questions above? If yes, name that exact open question. If no, say null.

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "role": "...", "fills_slot": "exact open question text or null" }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'minimal' })
    const parsed = JSON.parse(response)
    const role = ROLES.includes(parsed?.role) ? (parsed.role as FragmentRole) : 'reference'
    const fillsSlot = typeof parsed?.fills_slot === 'string' && openSlots.includes(parsed.fills_slot)
      ? parsed.fills_slot
      : null
    return { role, fillsSlot }
  } catch (e) {
    console.warn('[fragments] classifyFragment failed:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function attachFragmentFromMemory(
  supabase: SupabaseClient,
  userId: string,
  memory: { id: string; content: string; embedding: number[] | null }
): Promise<number> {
  if (!memory.embedding || memory.embedding.length === 0) return 0

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, embedding, slots')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(200)

  if (!projects || projects.length === 0) return 0

  let best: ProjectCandidate | null = null
  let bestSim = 0
  for (const p of projects as ProjectCandidate[]) {
    if (!p.embedding) continue
    const sim = cosineSimilarity(memory.embedding, p.embedding)
    if (sim > bestSim) {
      bestSim = sim
      best = { ...p, slots: Array.isArray(p.slots) ? p.slots : [] }
    }
  }

  if (!best || bestSim < ATTACH_SIM_THRESHOLD) return 0

  const classification = await classifyFragment(memory.content, best)
  if (!classification) return 0

  const { error: insertErr } = await supabase.from('fragments').insert({
    user_id: userId,
    project_id: best.id,
    memory_id: memory.id,
    role: classification.role,
    fills_slot: classification.fillsSlot,
    text: memory.content,
  })
  if (insertErr) {
    console.warn('[fragments] insert failed:', insertErr.message)
    return 0
  }

  if (classification.fillsSlot) {
    const updatedSlots = best.slots.map(s =>
      s.name === classification.fillsSlot ? { ...s, filled: true } : s
    )
    const { error: updateErr } = await supabase
      .from('projects')
      .update({ slots: updatedSlots })
      .eq('id', best.id)
      .eq('user_id', userId)
    if (updateErr) console.warn('[fragments] slot update failed (non-fatal):', updateErr.message)
  }

  return 1
}
