#!/usr/bin/env tsx
/**
 * Backfill Thought Tags
 *
 * Re-runs the constrained tag pipeline against every existing thought so
 * the corpus no longer carries the old "3-5 entities per note" output that
 * produced ~50 unique tags across ~50 notes (≈ one tag per thought).
 *
 * The pipeline:
 *   1. Pull the user's current tag vocabulary (themes only, system
 *      markers excluded).
 *   2. Walk every thought.
 *   3. Ask Gemini Flash for 0-3 short theme tags per thought, strongly
 *      preferring an existing vocabulary entry over a new one.
 *   4. Merge: keep system markers (onboarding, live-hybrid, etc.) and
 *      cap the AI tags at MAX_TAGS_PER_THOUGHT.
 *   5. Skip writes that don't change anything.
 *
 * Idempotent — re-running it should be a no-op once the corpus is clean.
 *
 * Usage:
 *   npm run backfill:tags -- --user-id=<uuid> [--limit=500] [--dry-run]
 *
 *   --user-id=<uuid>  (required) the user whose thoughts to retag
 *   --limit=<n>       max thoughts to process (default 500)
 *   --dry-run         print proposed changes, write nothing
 *
 * The user is left to invoke this — never wired into cron.
 */

// Load env before importing anything that validates env on import.
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from '../api/_lib/models.js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const geminiKey = process.env.GEMINI_API_KEY

if (!url || !serviceRoleKey) {
  console.error('Missing Supabase env vars (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
if (!geminiKey) {
  console.error('Missing GEMINI_API_KEY.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)
const genAI = new GoogleGenerativeAI(geminiKey)

// Mirrors process-memory.ts — keep these in sync.
const MAX_TAGS_PER_THOUGHT = 3
const SYSTEM_TAGS = new Set<string>([
  'onboarding',
  'live-hybrid',
  'morning-followup',
  'bedtime-synthesis',
])
// Same model the live pipeline uses (process-memory.ts) — sourced from the
// shared constant so it can't drift out of sync again.
const MODEL_NAME = MODELS.DEFAULT_CHAT

interface Options {
  userId: string | null
  limit: number
  dryRun: boolean
}

function parseArgs(): Options {
  const opts: Options = { userId: null, limit: 500, dryRun: false }
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--user-id=')) opts.userId = arg.slice('--user-id='.length).trim()
    else if (arg.startsWith('--limit=')) opts.limit = Number.parseInt(arg.slice('--limit='.length), 10) || 500
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run backfill:tags -- --user-id=<uuid> [--limit=500] [--dry-run]')
      process.exit(0)
    }
  }
  return opts
}

async function fetchVocabulary(userId: string, limit = 40): Promise<string[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('tags')
    .eq('user_id', userId)
    .range(0, 4999)

  if (error) {
    console.error('[vocab] read failed:', error)
    return []
  }

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ tags: string[] | null }>) {
    for (const t of row.tags ?? []) {
      const norm = (t || '').trim().toLowerCase()
      if (!norm || SYSTEM_TAGS.has(norm)) continue
      counts.set(norm, (counts.get(norm) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag)
}

const TAG_PROMPT_TEMPLATE = (vocab: string[], title: string, body: string) => `You are a tag librarian. Pick 0-3 short THEME tags for this voice note. Zero is fine — better empty than padded.

Rules:
- Tags are short THEMES the user is circling — creative direction, mood, domain. NOT proper nouns, NOT entities, NOT people, places, or brands.
- Strongly prefer tags from the user's existing vocabulary below. Only invent a new tag if no existing one fits AND the theme is likely to recur.
- 3 tags MAX. Ideally 1-2. Empty array is allowed and often correct.
- Lowercase. Single word or 2-word kebab-case. No punctuation.
- Plain English. No invented jargon. Avoid: thought, note, idea, voice, musing, reflection, interesting, journey, essence.

ANTI-EXAMPLES (do NOT do this):
- "Saw Arsenal beat Spurs on BBC" → ["arsenal","spurs","bbc","football"]  Entity dump. Wrong.
- Correct: ["football"] only if "football" is already in the vocabulary below, else [].

USER'S EXISTING VOCABULARY (prefer these):
${vocab.length ? vocab.map(v => `  - ${v}`).join('\n') : '  (none yet — pick at most one or two broad theme words, or leave empty)'}

NOTE TITLE: ${title}
NOTE BODY: ${body}

Return strict JSON: { "tags": ["a", "b"] }
`

async function generateTags(vocab: string[], title: string, body: string): Promise<string[]> {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 200 },
  })

  const prompt = TAG_PROMPT_TEMPLATE(
    vocab,
    (title || '').slice(0, 120),
    (body || '').replace(/\s+/g, ' ').trim().slice(0, 800),
  )

  let raw: string
  try {
    const result = await model.generateContent(prompt)
    raw = result.response.text()
  } catch (e) {
    console.warn('[tags] LLM call failed:', e)
    return []
  }

  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
    const parsed: unknown = JSON.parse(cleaned)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'tags' in (parsed as Record<string, unknown>) &&
      Array.isArray((parsed as { tags: unknown }).tags)
    ) {
      return ((parsed as { tags: unknown[] }).tags)
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0 && t.length <= 32)
        .slice(0, MAX_TAGS_PER_THOUGHT)
    }
    return []
  } catch (e) {
    console.warn('[tags] parse failed; raw preview:', raw.slice(0, 200))
    return []
  }
}

function mergeTags(existing: string[] | null, aiTags: string[]): string[] {
  const systemMarkers = (existing ?? []).filter(t => SYSTEM_TAGS.has(t))
  return Array.from(new Set([...systemMarkers, ...aiTags])).slice(0, 5)
}

function shallowEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

async function main() {
  const opts = parseArgs()
  if (!opts.userId) {
    console.error('Missing --user-id=<uuid>. See --help.')
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log('Backfill thought tags')
  console.log('='.repeat(60))
  console.log(`User:    ${opts.userId}`)
  console.log(`Limit:   ${opts.limit}`)
  console.log(`Dry run: ${opts.dryRun}`)
  console.log('='.repeat(60))

  let vocab = await fetchVocabulary(opts.userId)
  console.log(`[vocab] starting size: ${vocab.length}`)

  const { data, error } = await supabase
    .from('memories')
    .select('id, title, body, tags')
    .eq('user_id', opts.userId)
    .order('created_at', { ascending: false })
    .limit(opts.limit)

  if (error) {
    console.error('[fetch] failed:', error)
    process.exit(1)
  }

  const rows = (data ?? []) as Array<{ id: string; title: string | null; body: string | null; tags: string[] | null }>
  console.log(`[fetch] ${rows.length} thoughts to inspect`)

  let updated = 0
  let unchanged = 0
  let errored = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const title = row.title ?? ''
    const body = row.body ?? ''
    try {
      const aiTags = await generateTags(vocab, title, body)
      const merged = mergeTags(row.tags, aiTags)
      const before = row.tags ?? []

      if (shallowEqual(before, merged)) {
        unchanged++
        console.log(`[${i + 1}/${rows.length}] ${row.id.slice(0, 8)} unchanged (${merged.join(',') || '∅'})`)
      } else {
        console.log(`[${i + 1}/${rows.length}] ${row.id.slice(0, 8)} ${before.join(',') || '∅'} → ${merged.join(',') || '∅'}`)
        if (!opts.dryRun) {
          const { error: upErr } = await supabase
            .from('memories')
            .update({ tags: merged })
            .eq('id', row.id)
            .eq('user_id', opts.userId)
          if (upErr) {
            console.warn(`[${row.id}] update failed:`, upErr)
            errored++
            continue
          }
        }
        updated++
        // Fold any newly-introduced tag into the live vocab so later rows
        // can prefer it. Cheap; keeps the run self-reinforcing.
        for (const t of aiTags) if (!vocab.includes(t)) vocab.push(t)
      }
    } catch (e) {
      console.warn(`[${row.id}] error:`, e)
      errored++
    }

    // Light rate-limiting so we don't fan-out faster than Gemini lets us.
    await new Promise(r => setTimeout(r, 150))
  }

  console.log('='.repeat(60))
  console.log(`Done. updated=${updated} unchanged=${unchanged} errored=${errored} ${opts.dryRun ? '(dry-run)' : ''}`)
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
