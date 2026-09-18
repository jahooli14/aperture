/**
 * Run the real question channel against the real corpus, locally.
 *
 * One model call, handed the whole corpus at once — about half a cent a
 * run at this corpus's current size. That number is the point: whole
 * design changes to this channel have been settled by a handful of real
 * runs rather than by argument, and that only works while it costs this
 * little to look.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
 *     npm run mull:try
 *
 * Writes nothing. `bakeMull` returns the sparks; only the `bake` endpoint
 * inserts them, and this never calls it.
 */

import { createClient } from '@supabase/supabase-js'
import { bakeMull } from '../api/_lib/mull-generator.js'

const NEEDED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY'] as const

async function main() {
  const missing = NEEDED.filter(k => !process.env[k])
  if (missing.length > 0) {
    console.error(`Missing: ${missing.join(', ')}\nAll three are in the Vercel dashboard.`)
    process.exit(1)
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Whose corpus. Passed in, or the only user with memories — this is a
  // single-user app and asking for a UUID every time is friction for
  // nothing. A hardcoded default is how the first run of this printed
  // "0 rows" for every table and looked like a broken corpus.
  let userId = process.env.POLYMATH_USER_ID ?? ''
  if (!userId) {
    const { data } = await supabase.from('memories').select('user_id').limit(1)
    userId = data?.[0]?.user_id ?? ''
  }
  if (!userId) {
    console.error('No user found. Set POLYMATH_USER_ID.')
    process.exit(1)
  }

  const trace: string[] = []
  const baked = await bakeMull(supabase as any, userId, undefined, trace)

  console.log('\n─── trace ───')
  for (const line of trace) console.log(' ', line)

  console.log('\n─── questions ───')
  if (baked.length === 0) {
    console.log('  (none — the trace above says which step declined)')
  } else {
    // The stake too, because it is the evidence behind the one gate that
    // can be argued with: a binary ships only when stakeSplits says the two
    // branches land somewhere different, and reading the question alone
    // cannot tell you whether that was true.
    for (const s of baked) console.log(`\n  ${s.text}\n    stake: ${s.stake ?? '(none)'}`)
  }
  console.log('\nNothing was written.')
}

main().catch(e => { console.error('failed:', e); process.exit(1) })
