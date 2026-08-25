/**
 * Morph proposal generation (SPEC.md).
 *
 * Fragments accumulate; the project recomputes over them. Structure does
 * the thinking (rate limiting in morph.ts, citation verification below),
 * the model only writes the sentence. A proposal that fails citation
 * verification is discarded rather than stored — a morph that can't prove
 * its own quote is exactly the invented-causal-story failure mode SPEC.md
 * bans.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { canMorphProject, anyProjectMorphedToday, verifyCitations } from './morph.js'

const FRAGMENT_LIMIT = 20

export interface MorphCandidate {
  projectId: string
  proposedText: string
  citedFragmentIds: string[]
}

async function generateMorphText(
  projectTitle: string,
  projectDescription: string | null,
  fragments: { id: string; text: string }[]
): Promise<{ text: string; citedIds: string[] } | null> {
  const prompt = `Project: "${projectTitle}" -- ${projectDescription || 'no description yet'}

Recent things the user has captured that connect to this project:
${fragments.map(f => `[${f.id}] "${f.text}"`).join('\n')}

Does anything here suggest a real, specific shift in what this project is or does? Cite the
fragment ids you're drawing from -- the connection must be a real quote, never an invented
causal story ("the April note means..."). If nothing here actually changes the project, say so.

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "shift": "one or two sentences, or null if nothing real", "cited_ids": ["..."] }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.7 })
    const parsed = JSON.parse(response)
    const text = typeof parsed?.shift === 'string' ? parsed.shift.trim() : ''
    if (!text || text.toLowerCase() === 'null') return null
    const citedIds = Array.isArray(parsed?.cited_ids) ? parsed.cited_ids.filter((x: unknown) => typeof x === 'string') : []
    return { text, citedIds }
  } catch (e) {
    console.warn('[morph-generator] generation failed:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Considers at most one project (the caller picks which, per the
 * one-project-per-day rate limit) and returns a verified proposal or null.
 * Never writes to the database -- that's the caller's job, so the cron
 * endpoint stays the only place that decides what "proposing" means.
 */
export async function considerMorph(
  supabase: SupabaseClient,
  userId: string,
  project: { id: string; title: string; description: string | null }
): Promise<MorphCandidate | null> {
  const { data: fragmentRows } = await supabase
    .from('fragments')
    .select('id, text')
    .eq('project_id', project.id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(FRAGMENT_LIMIT)

  const fragments = fragmentRows ?? []
  if (fragments.length === 0) return null

  const generated = await generateMorphText(project.title, project.description, fragments)
  if (!generated) return null

  const verification = verifyCitations(generated.text, generated.citedIds, fragments)
  if (!verification.valid) {
    console.warn(`[morph-generator] citation verification failed for project ${project.id}:`, verification.invalidIds)
    return null
  }

  return { projectId: project.id, proposedText: generated.text, citedFragmentIds: generated.citedIds }
}

export { canMorphProject, anyProjectMorphedToday }
