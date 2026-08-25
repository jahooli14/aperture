/**
 * Loads the existing Pasco story into Relay.
 *
 * Usage:
 *   npm run seed -- --dan=you@example.com --ben=ben@example.com
 *
 * Optional:
 *   --start=2025-01-14   spread the lines evenly between that date and today
 *   --title="Pasco"      override the story title
 *
 * Without --start every line is stamped with the time it was inserted, which
 * is honest but makes "the story so far" read as though it all happened at
 * once. With it, timestamps are evenly spaced across the range — approximate,
 * anchored to a real date you supply, and only ever used for the stats.
 *
 * Safe to run twice: it finds an existing story by title and skips it if the
 * lines are already in.
 */
import { createClient } from '@supabase/supabase-js'
import { PASCO_BLURB, PASCO_STORY, PASCO_TITLE, type SeedLine } from './pasco-story.js'

try {
  process.loadEnvFile('.env')
} catch {
  // No .env file — rely on the environment.
}

function arg(name: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`))
  return match?.slice(name.length + 3)
}

const danEmail = arg('dan') ?? process.env.RELAY_DAN_EMAIL
const benEmail = arg('ben') ?? process.env.RELAY_BEN_EMAIL
const title = arg('title') ?? PASCO_TITLE
const startDate = arg('start')

if (!danEmail || !benEmail) {
  console.error('Both writers are needed: npm run seed -- --dan=you@example.com --ben=ben@example.com')
  process.exit(1)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (the service key, not the anon key)')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  db: { schema: 'relay' },
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Finds the account for an email, creating a confirmed one if it's new. */
async function resolveUser(email: string, displayName: string): Promise<string> {
  let page = 1
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) {
      await upsertProfile(found.id, displayName)
      return found.id
    }
    if (data.users.length < 200) break
    page += 1
  }

  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  console.log(`  created an account for ${email} — they sign in with a magic link, no password`)
  await upsertProfile(data.user.id, displayName)
  return data.user.id
}

async function upsertProfile(userId: string, displayName: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, display_name: displayName }, { onConflict: 'user_id' })
  if (error) throw error
}

/** Evenly spaced timestamps between --start and now, or null to use insert time. */
function timestamps(count: number): (string | null)[] {
  if (!startDate) return Array(count).fill(null)

  const start = Date.parse(`${startDate}T19:00:00.000Z`)
  if (Number.isNaN(start)) throw new Error(`--start must be a date like 2025-01-14, got "${startDate}"`)

  const end = Date.now()
  const step = (end - start) / Math.max(count - 1, 1)
  return Array.from({ length: count }, (_, index) => new Date(start + step * index).toISOString())
}

async function main() {
  console.log(`Seeding "${title}"…`)

  const danId = await resolveUser(danEmail!, 'Dan')
  const benId = await resolveUser(benEmail!, 'Ben')

  const { data: existing } = await supabase
    .from('stories')
    .select('id')
    .eq('title', title)
    .eq('created_by', danId)
    .maybeSingle()

  let storyId = existing?.id as string | undefined

  if (!storyId) {
    const { data, error } = await supabase
      .from('stories')
      .insert({
        title,
        blurb: PASCO_BLURB,
        created_by: danId,
        turn_mode: 'rotation',
        next_author_id: danId,
      })
      .select('id')
      .single()
    if (error) throw error
    storyId = data.id
    console.log(`  created the story`)
  } else {
    console.log(`  story already exists`)
  }

  for (const [userId, order, role] of [
    [danId, 0, 'owner'],
    [benId, 1, 'writer'],
  ] as const) {
    const { error } = await supabase
      .from('story_members')
      .upsert({ story_id: storyId, user_id: userId, turn_order: order, role }, {
        onConflict: 'story_id,user_id',
      })
    if (error) throw error
  }

  const { count } = await supabase
    .from('lines')
    .select('id', { count: 'exact', head: true })
    .eq('story_id', storyId)

  if ((count ?? 0) > 0) {
    console.log(`  ${count} lines already in — nothing to add`)
    return
  }

  const authorIds: Record<SeedLine['author'], string> = { dan: danId, ben: benId }
  const stamps = timestamps(PASCO_STORY.length)

  const rows = PASCO_STORY.map((line, index) => ({
    story_id: storyId,
    author_id: authorIds[line.author],
    position: index + 1,
    body: line.body,
    chapter_title: line.chapter ?? null,
    ...(stamps[index] ? { created_at: stamps[index] } : {}),
  }))

  const { error } = await supabase.from('lines').insert(rows)
  if (error) throw error

  // The insert trigger left the turn wherever the last line put it. The story
  // alternates, so after Ben's line it is Dan's go.
  const lastAuthor = PASCO_STORY[PASCO_STORY.length - 1].author
  const nextAuthor = lastAuthor === 'dan' ? benId : danId
  await supabase.from('stories').update({ next_author_id: nextAuthor }).eq('id', storyId)

  console.log(`  added ${rows.length} lines`)
  console.log(`Done. It's ${lastAuthor === 'dan' ? 'Ben' : 'Dan'}'s turn.`)
}

main().catch((error) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
