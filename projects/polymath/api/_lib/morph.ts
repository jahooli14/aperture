/**
 * Morph rate limiting and citation verification (SPEC.md).
 *
 * "Four projects changed overnight and you trust none of them" is the
 * failure mode this guards against. Two independent limits:
 *   - one morph per project per 14 days
 *   - one project morphed per day, across the whole portfolio
 *
 * Both are pure functions over timestamps so the rate limit itself is
 * unit-tested, not just implied by a cron schedule.
 *
 * Citation verification is the other half of "cite or stay silent": a
 * morph proposal is only as trustworthy as its quotes are real, so this
 * checks that every claimed citation actually appears (loosely) in the
 * fragment text it points at, rather than trusting the model's say-so.
 */

export const MORPH_COOLDOWN_DAYS = 14

export function canMorphProject(lastMorphedAt: string | null, now: Date = new Date()): boolean {
  if (!lastMorphedAt) return true
  const last = new Date(lastMorphedAt)
  const days = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  return days >= MORPH_COOLDOWN_DAYS
}

/** At most one project may morph per calendar day, portfolio-wide. */
export function anyProjectMorphedToday(morphTimestampsToday: string[], now: Date = new Date()): boolean {
  const todayKey = now.toISOString().slice(0, 10)
  return morphTimestampsToday.some(ts => ts.slice(0, 10) === todayKey)
}

export interface FragmentForCitation {
  id: string
  text: string
}

/**
 * A citation is valid when a meaningful chunk of the cited fragment's text
 * (lowercased, punctuation-stripped) appears in the proposal text, or vice
 * versa for a short fragment. This is deliberately loose -- the model is
 * allowed to trim or lightly requote -- but a citation to a fragment whose
 * words don't show up at all is rejected. That's the guard against an
 * invented "you said X" that nobody actually said.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function sharesSubstantialOverlap(fragmentText: string, proposalText: string): boolean {
  const nFragment = normalize(fragmentText)
  const nProposal = normalize(proposalText)
  if (nFragment.length === 0 || nProposal.length === 0) return false
  if (nProposal.includes(nFragment) || nFragment.includes(nProposal)) return true

  // Fall back to word overlap for paraphrase, measured against the
  // FRAGMENT's significant (4+ letter) words -- that's the ground truth
  // the citation is supposed to reflect, so the ratio is always relative
  // to it regardless of which text is longer.
  const fragmentWords = nFragment.split(' ').filter(w => w.length >= 4)
  if (fragmentWords.length === 0) return false
  const proposalWords = new Set(nProposal.split(' ').filter(w => w.length >= 4))
  const hits = fragmentWords.filter(w => proposalWords.has(w)).length
  return hits >= 2 && hits / fragmentWords.length >= 0.4
}

export function verifyCitations(
  proposedText: string,
  citedFragmentIds: string[],
  fragments: FragmentForCitation[]
): { valid: boolean; invalidIds: string[] } {
  const byId = new Map(fragments.map(f => [f.id, f.text]))
  const invalidIds: string[] = []

  for (const id of citedFragmentIds) {
    const fragmentText = byId.get(id)
    if (!fragmentText || !sharesSubstantialOverlap(fragmentText, proposedText)) {
      invalidIds.push(id)
    }
  }

  return { valid: invalidIds.length === 0 && citedFragmentIds.length > 0, invalidIds }
}
