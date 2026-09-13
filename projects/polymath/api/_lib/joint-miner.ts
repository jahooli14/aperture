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
import { describeTimeline, MIN_SPAN_DAYS } from './corpus-time.js'

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

export interface MineResult { written: number; trace: string[] }

export async function mineJoints(supabase: SupabaseClient, userId: string): Promise<MineResult> {
  // Same reasoning as the mull channel's `bake?explain=1`: this returns 0
  // for five different reasons and they are indistinguishable from outside.
  const trace: string[] = []
  // The whole corpus, not the newest 150.
  //
  // This used to read one recency window, which made a "recurrence" mean
  // "said twice lately" — five fragments from one Tuesday afternoon
  // counted, and a thing said every autumn since 2023 did not. That is
  // backwards: the years are where someone's convictions are, and they
  // were the part being thrown away.
  // Two plain reads joined in JS, not a PostgREST embed.
  //
  // This was `select('... memories(embedding)')`, which needs a foreign-key
  // relationship PostgREST can see. When it can't, the whole query is
  // REJECTED -- and the result was read as `const { data } = await`, so a
  // rejection and an empty table were the same value. Joints have been
  // empty in production for as long as anyone has looked, the mull channel
  // has never once had its strongest subject available, and nothing
  // anywhere said why. Exactly the defect that hid `memories.project_id`.
  const fragmentsRes = await supabase
    .from('fragments')
    .select('id, text, created_at, memory_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (fragmentsRes.error) {
    trace.push(`!! fragments query FAILED: ${fragmentsRes.error.message}`)
    return { written: 0, trace }
  }
  const fragmentRows = fragmentsRes.data ?? []
  trace.push(`fragments: ${fragmentRows.length} rows`)

  const memoryIds = [...new Set(fragmentRows.map((f: any) => f.memory_id).filter(Boolean))]
  const embeddingById = new Map<string, unknown>()
  if (memoryIds.length > 0) {
    const memoriesRes = await supabase
      .from('memories')
      .select('id, embedding')
      .eq('user_id', userId)
      .in('id', memoryIds)
    if (memoriesRes.error) {
      trace.push(`!! memories query FAILED: ${memoriesRes.error.message}`)
      return { written: 0, trace }
    }
    for (const m of memoriesRes.data ?? []) embeddingById.set((m as any).id, (m as any).embedding)
    trace.push(`embeddings: ${memoryIds.length} memories referenced, ${memoriesRes.data?.length ?? 0} found`)
  }

  const fragments: FragmentForClustering[] = (fragmentRows as any[])
    .map(f => ({ id: f.id, text: f.text, embedding: embeddingById.get(f.memory_id) as number[] }))
    .filter((f): f is FragmentForClustering => {
      // pgvector arrives as a JSON string; cosineSimilarity parses either.
      const e: unknown = f.embedding
      return Array.isArray(e) ? e.length > 0 : typeof e === 'string' && e.length > 2
    })
  trace.push(
    `clusterable: ${fragments.length} of ${fragmentRows.length} fragments have an embedding` +
    `${fragmentRows.length > 0 && fragments.length === 0 ? ' — nothing can cluster, so no joint can ever be found' : ''}`,
  )

  const datesById = new Map<string, string>(
    (fragmentRows ?? []).map((f: any) => [f.id, f.created_at]),
  )

  // Span, not count. A cluster confined to one sitting is one thought
  // however many fragments it left behind, and summarising it into a
  // "joint" spends a model call to manufacture a recurrence that isn't one.
  const clusters = findRecurringThemes(fragments).filter(cluster => {
    const timeline = describeTimeline(
      cluster.fragmentIds.map(id => datesById.get(id)).filter((d): d is string => !!d),
    )
    return timeline !== null && timeline.spanDays >= MIN_SPAN_DAYS
  })
  trace.push(
    `clusters: ${clusters.length} recurring themes spanning at least ${MIN_SPAN_DAYS} days`,
  )
  if (clusters.length === 0) return { written: 0, trace }

  const existingRes = await supabase
    .from('joints')
    .select('id, text, fragment_ids, occurrence_count')
    .eq('user_id', userId)
  if (existingRes.error) trace.push(`!! joints query FAILED: ${existingRes.error.message}`)
  const existingJoints = existingRes.data

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
      const upd = await supabase
        .from('joints')
        .update({
          fragment_ids: mergedIds,
          occurrence_count: mergedIds.length,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', matched.id)
        .eq('user_id', userId)
      if (upd.error) {
        trace.push(`!! joint update FAILED: ${upd.error.message}`)
        continue
      }
    } else {
      const ins = await supabase.from('joints').insert({
        user_id: userId,
        text: jointText,
        fragment_ids: cluster.fragmentIds,
        occurrence_count: cluster.fragmentIds.length,
      })
      // A rejected insert is how `sparks.type` stayed broken for four days.
      if (ins.error) {
        trace.push(`!! joint insert FAILED: ${ins.error.message}`)
        continue
      }
    }
    written++
  }

  trace.push(`written: ${written} joints`)
  return { written, trace }
}
