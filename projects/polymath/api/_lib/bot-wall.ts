/**
 * Detecting a bot-challenge page that got extracted as if it were the
 * article.
 *
 * The two symptoms this exists for: "sometimes it says there's a Vercel
 * security thing and won't return any of the article" and, less visibly,
 * the same failure for every other anti-bot vendor — the extraction
 * "succeeds" because Readability's charThreshold is 0 and Jina's own
 * validation only checks text length, so a challenge/interstitial page
 * with a couple hundred words of "please verify you're human" sails
 * through every gate we had.
 *
 * Two checks, used together:
 *  - `mitigationFromHeaders` — authoritative and free. Vercel's Attack
 *    Challenge and Cloudflare's newer challenge action both stamp a
 *    header on the response saying so outright, no guessing required.
 *  - `detectBotWallText` — a fallback signature match on the extracted
 *    text/title, for every vendor that doesn't stamp a header (Akamai,
 *    PerimeterX, Kasada, generic "Attention Required" pages, and
 *    Cloudflare/Vercel cases where the header got stripped somewhere in
 *    the fetch chain).
 */

/** Response headers documented to name a challenge outright. No guessing. */
export function mitigationFromHeaders(headers: Headers | Record<string, string | null | undefined>): string | null {
  const get = (name: string): string | null =>
    headers instanceof Headers ? headers.get(name) : (headers[name] ?? null)

  if (get('x-vercel-mitigated') === 'challenge') return 'Vercel'
  if (get('cf-mitigated') === 'challenge') return 'Cloudflare'
  return null
}

/**
 * Phrases that show up on the challenge page itself, not the article.
 * Deliberately phrase-level rather than single words ("access" alone would
 * false-positive on half the internet) — every entry here is a phrase that
 * only makes sense coming from an interstitial.
 */
const BOT_WALL_PATTERNS: RegExp[] = [
  /just a moment/i,
  /checking your browser/i,
  /verify you(?:'re| are) (?:a )?human/i,
  /enable javascript and cookies/i,
  /attention required/i,
  /security checkpoint/i,
  /ddos protection by/i,
  /unusual traffic (?:from|detected)/i,
  /are you a robot/i,
  /human verification/i,
  /complete the security check/i,
  /access to this page has been denied/i,
  /additional security check/i,
  /press and hold/i,
  /this process is automatic/i,
  /your browser will redirect/i,
]

/**
 * Post-extraction gate: does the title/text this tier came back with look
 * like an interstitial rather than an article? Checked against every tier
 * (fetchArticle's orchestrator), not just the raw HTTP layer, because the
 * page that fooled us was already "successfully" parsed by the time we'd
 * know from a status code alone.
 *
 * Returns the phrase that matched, or null when it reads like a real page.
 * Deliberately only looks at the first ~2KB — a challenge page's text IS
 * the challenge; a real article that happens to quote one of these phrases
 * once, deep in a 3000-word piece, won't trip it.
 */
export function detectBotWallText(title: string | null | undefined, text: string | null | undefined): string | null {
  const haystack = `${title || ''}\n${(text || '').slice(0, 2000)}`
  for (const pattern of BOT_WALL_PATTERNS) {
    if (pattern.test(haystack)) return pattern.source
  }
  return null
}
