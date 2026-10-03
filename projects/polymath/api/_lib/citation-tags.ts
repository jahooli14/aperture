/**
 * Evidence tags that models write into prose.
 *
 * Grounded prompts number what the user said (`[e1] I have a chainsaw…`) so a
 * step can cite where it came from. The citation belongs in the `evidence`
 * field. Models copy the habit into the sentence itself, and it was saved:
 * "Done when: a side table [e1]", "Apply oil to the wood [e1, e2]" — on the
 * plan screen, the home card, the project's finish line and its steps.
 *
 * Strip them where model output is parsed. The mull channel's `[N12]` / `[P3]`
 * refs are structured fields, not prose, and are deliberately not matched.
 */

const TAG = /\s*\[\s*e\d+(?:\s*[,;]\s*e\d+)*\s*\]/gi

export function stripCitationTags(text: string): string {
  if (!TAG.test(text)) return text
  TAG.lastIndex = 0
  // Only spaces collapse: paragraph breaks in a description survive.
  return text.replace(TAG, '').replace(/[ \t]{2,}/g, ' ').trim()
}

/** Every string anywhere inside a parsed model response, cleaned. */
export function stripCitationTagsDeep<T>(value: T): T {
  if (typeof value === 'string') return stripCitationTags(value) as unknown as T
  if (Array.isArray(value)) return value.map(stripCitationTagsDeep) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripCitationTagsDeep(v)
    return out as T
  }
  return value
}
