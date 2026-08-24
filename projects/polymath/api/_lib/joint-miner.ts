/**
 * Joint mining (IO half) — weekly. Clusters fragments by embedding
 * (joints.ts's findRecurringThemes, pure and tested), then asks Gemini to
 * turn each recurring cluster into ONE quoted-or-tightly-paraphrased
 * sentence. Upserts against existing joints by simple text similarity so
 * a theme that keeps recurring accumulates occurrence_count rather than
 * spawning near-duplicate joints every week.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { generateEmbedding, cosineSimilarity } from './gemini-embeddings.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { findRecurringThemes, type FragmentForClustering } from './joints.js'

const EXISTING_JOINT_SIM_THRESHOLD = 0.85

async function summarizeCluster(texts: string[]): Promise<string | null> {
  const prompt = `The user has said something like this more than once, in their own words:
${texts.map(t => `- "${t}"`).join('\n')}

Write ONE short sentence that captures the recurring thing -- stay as close to their actual
words as you can. This isn't a summary for them to read casually; it needs to be quotable back
at them later as evidence.

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "joint": "..." }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'low' })
    const parsed = JSON.parse(response)
    const text = typeof parsed?.joint === 'string' ? parsed.joint.trim() : ''
    return text.length > 0 ? text : null
  } catch (e) {
    console.warn('[joint-miner] summarize failed:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function mineJoints(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: fragmentRows } = await supabase
    .from('fragments')
    .select('id, text, memory_id, memories(embedding)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(150)

  const fragments: FragmentForClustering[] = (fragmentRows ?? [])
    .map((f: any) => ({ id: f.id, text: f.text, embedding: f.memories?.embedding ?? [] }))
    .filter((f: FragmentForClustering) => f.embedding.length > 0)

  const clusters = findRecurringThemes(fragments)
  if (clusters.length === 0) return 0

  const { data: existingJoints } = await supabase
    .from('joints')
    .select('id, text, fragment_ids, occurrence_count')
    .eq('user_id', userId)

  let written = 0
  for (const cluster of clusters) {
    const jointText = await summarizeCluster(cluster.texts)
    if (!jointText) continue

    const jointEmbedding = await generateEmbedding(jointText).catch(() => null)

    // Only dedupe against existing joints when we can compare embeddings --
    // an embedding failure should never silently drop a new joint.
    let matched: { id: string; fragment_ids: string[]; occurrence_count: number } | null = null
    if (jointEmbedding && existingJoints) {
      for (const existing of existingJoints) {
        const existingEmbedding = await generateEmbedding(existing.text).catch(() => null)
        if (existingEmbedding && cosineSimilarity(jointEmbedding, existingEmbedding) >= EXISTING_JOINT_SIM_THRESHOLD) {
          matched = existing
          break
        }
      }
    }

    if (matched) {
      const mergedIds = Array.from(new Set([...matched.fragment_ids, ...cluster.fragmentIds]))
      await supabase
        .from('joints')
        .update({
          fragment_ids: mergedIds,
          occurrence_count: mergedIds.length,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', matched.id)
        .eq('user_id', userId)
    } else {
      await supabase.from('joints').insert({
        user_id: userId,
        text: jointText,
        fragment_ids: cluster.fragmentIds,
        occurrence_count: cluster.fragmentIds.length,
      })
    }
    written++
  }

  return written
}
