/**
 * "What it is now": one paragraph per project, at the top of its page.
 *
 * Every project was one line, written the day it was made and never again.
 * Going Analogue's still said "a man drops off the internet", while the real
 * book -- he can't sleep, the town lets him, he is the unnamed man, his sleep
 * is forever -- lived only in an answer to one of the app's questions, which
 * everything else ignored. Takes, the catch-up and the picture of the person
 * were all built on the stale line.
 *
 * So the paragraph is drafted from everything they've said about the
 * project, answers to the app's questions included (those are kept out of
 * dated evidence, not out of what we know), newest winning. Their own
 * words win over the draft: once they write or say it, it is theirs and is
 * never redrafted. Pure helpers are tested; the rest is one Flash call.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { parseModelJson } from './schemas.js'
import { PLAIN_ENGLISH_RULES, findVoiceViolations } from './plain-english.js'
import { unsupportedSpecifics } from './mull.js'
import { loadProjectMaterial } from './project-material.js'
import { readParts, partsLine } from './project-parts.js'
import { madeSummary } from './made.js'

const MODEL = 'gemini-flash-latest'
export const SUMMARY_MAX_WORDS = 110
const ANSWERS = 8

export interface ProjectSummary {
  text: string
  /** 'you' = written or said by them, never redrafted. */
  by: 'notes' | 'you'
  at: string
  /** Fingerprint of the material it was drafted from. */
  basis?: string
}

export interface SummaryMaterial {
  title: string
  description: string | null
  endGoal: string | null
  /** What's ticked off and what isn't (project-parts.ts). */
  progress?: string
  /** What they've made on it (made.ts). */
  made?: string
  /** Newest first: what they said, and when. */
  said: { at: string; text: string; answer?: string }[]
}

export function readSummary(metadata: unknown): ProjectSummary | null {
  const s = (metadata as { summary?: unknown } | null)?.summary as Partial<ProjectSummary> | undefined
  if (!s || typeof s.text !== 'string' || !s.text.trim()) return null
  return { text: s.text.trim(), by: s.by === 'you' ? 'you' : 'notes', at: typeof s.at === 'string' ? s.at : '', basis: typeof s.basis === 'string' ? s.basis : undefined }
}

/** Changes when something new has been said about the project. Pure. */
export function basisOf(m: SummaryMaterial): string {
  return `${m.said.length}:${m.said[0]?.at ?? ''}:${(m.description ?? '').length}:${m.progress ?? ''}:${m.made ?? ''}`
}

export function summaryPrompt(m: SummaryMaterial): string {
  return `Write what this project is NOW, in one paragraph, for the top of its page.

PROJECT: "${m.title}"
${m.description ? `WHAT THEY WROTE WHEN THEY STARTED IT (may be out of date): ${m.description}\n` : ''}${m.progress ? `WHAT THEY'VE TICKED OFF (this is current, trust it): ${m.progress}\n` : ''}${m.made ? `WHAT THEY'VE MADE ON IT: ${m.made}\n` : ''}${m.endGoal ? `WHERE IT'S HEADED: ${m.endGoal}\n` : ''}
EVERYTHING THEY'VE SAID ABOUT IT, NEWEST FIRST:
${m.said.map(s => `- ${s.at.slice(0, 10)}: ${s.answer ? `(answering "${s.answer.slice(0, 160)}") ` : ''}${s.text}`).join('\n')}

Write:
- What it is: the premise or shape as it stands now. Newer words override older ones -- if they changed the plot, the new plot is the plot.
- What's decided, and where they've got to.
- Their nouns, plain. Under ${SUMMARY_MAX_WORDS - 20} words. Second person ("your book", "you're editing").
- Only what they said. No invented details, no advice, no praise, no next steps.
${PLAIN_ENGLISH_RULES}

JSON only: {"text": ""}`
}

/** Pure: the drafted paragraph, or why it can't be shown. */
export function checkSummary(text: string, m: SummaryMaterial): string | null {
  if (!text.trim()) return 'empty'
  if (text.split(/\s+/).length > SUMMARY_MAX_WORDS) return 'too long'
  const voice = findVoiceViolations(text)
  if (voice.length) return `voice: ${voice[0]}`
  const evidence = [m.title, m.description ?? '', m.endGoal ?? '', m.progress ?? '', m.made ?? '', ...m.said.map(s => `${s.at} ${s.text} ${s.answer ?? ''}`)]
  const invented = unsupportedSpecifics(text, evidence)
  if (invented.length) return `names something nobody said: ${invented.join(', ')}`
  return null
}

/** Everything said about a project, answers to the app's questions included. */
export async function loadSummaryMaterial(supabase: SupabaseClient, userId: string, projectId: string): Promise<SummaryMaterial | null> {
  const material = await loadProjectMaterial(supabase, userId, projectId)
  if (!material) return null
  const said: SummaryMaterial['said'] = material.rows.map(r => ({ at: r.at, text: r.text }))
  // Answers to takes filed under this project: their words, about it.
  const { data: asked } = await supabase.from('sparks')
    .select('text, response_memory_id')
    .eq('user_id', userId).eq('project_id', projectId)
    .not('response_memory_id', 'is', null)
    .order('created_at', { ascending: false }).limit(ANSWERS)
  const ids = (asked ?? []).map((s: any) => s.response_memory_id).filter(Boolean)
  if (ids.length) {
    const { data: answers } = await supabase.from('memories').select('id, body, created_at').eq('user_id', userId).in('id', ids)
    for (const a of answers ?? []) {
      const q = (asked ?? []).find((s: any) => s.response_memory_id === (a as any).id) as any
      if (typeof (a as any).body === 'string') said.push({ at: (a as any).created_at, text: (a as any).body.slice(0, 600), answer: q?.text })
    }
  }
  const { data: made } = await supabase.from('project_outputs').select('kind, title, note, link_meta, made_on, created_at').eq('user_id', userId).eq('project_id', projectId).limit(500)
  said.sort((a, b) => b.at.localeCompare(a.at))
  const seen = new Set<string>()
  return {
    title: material.title,
    description: material.description,
    endGoal: material.endGoal,
    progress: partsLine(readParts(material.metadata)) || undefined,
    made: madeSummary((made ?? []) as Parameters<typeof madeSummary>[0]) || undefined,
    said: said.filter(s => { const k = s.text.slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 24),
  }
}

export async function draftSummary(m: SummaryMaterial, timeoutMs = 15_000): Promise<{ text: string } | { error: string }> {
  if (m.said.length === 0 && !m.description) return { error: 'nothing said about it yet' }
  try {
    const raw = await generateText(summaryPrompt(m), { responseFormat: 'json', model: MODEL, maxTokens: 2048, thinkingLevel: 'low', timeoutMs })
    const text = String((parseModelJson(raw) as { text?: unknown })?.text ?? '').trim()
    const problem = checkSummary(text, m)
    return problem ? { error: problem } : { text }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

async function saveSummary(supabase: SupabaseClient, userId: string, projectId: string, summary: ProjectSummary): Promise<void> {
  const { data } = await supabase.from('projects').select('metadata').eq('id', projectId).eq('user_id', userId).single()
  const metadata = { ...((data?.metadata as Record<string, unknown>) ?? {}), summary }
  const { error } = await supabase.from('projects').update({ metadata }).eq('id', projectId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/** The paragraph, drafted or refreshed if the notes have moved on. Theirs is never touched. */
export async function currentSummary(
  supabase: SupabaseClient, userId: string, projectId: string, opts: { force?: boolean } = {},
): Promise<ProjectSummary | null> {
  const { data } = await supabase.from('projects').select('metadata').eq('id', projectId).eq('user_id', userId).single()
  const existing = readSummary(data?.metadata)
  if (existing?.by === 'you' && !opts.force) return existing
  const m = await loadSummaryMaterial(supabase, userId, projectId)
  if (!m) return existing
  const basis = basisOf(m)
  if (existing && existing.basis === basis && !opts.force) return existing
  const drafted = await draftSummary(m)
  if ('error' in drafted) return existing
  const summary: ProjectSummary = { text: drafted.text, by: 'notes', at: new Date().toISOString(), basis }
  await saveSummary(supabase, userId, projectId, summary)
  return summary
}

/** Their own words, said or typed. Empty hands it back to the notes. */
export async function setSummary(supabase: SupabaseClient, userId: string, projectId: string, text: string): Promise<ProjectSummary | null> {
  const clean = text.trim().slice(0, 1200)
  if (!clean) return currentSummary(supabase, userId, projectId, { force: true })
  const summary: ProjectSummary = { text: clean, by: 'you', at: new Date().toISOString() }
  await saveSummary(supabase, userId, projectId, summary)
  return summary
}
