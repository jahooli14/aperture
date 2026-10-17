/**
 * Keys in projects.metadata that only the server writes.
 *
 * The PATCH route (and the offline sync queue behind it) replaces
 * `metadata` WHOLESALE from the client's cached copy. A device with a stale
 * cache therefore erases anything written server-side since it last
 * synced: the season tags and the themes just disappear, with nothing to
 * say so. These are written by utilities routes (`season`, `themes`,
 * `up-to-speed`), never edited through PATCH, so a PATCH keeps whatever the
 * database already holds for them and ignores what the client sent.
 */

export const SERVER_OWNED_KEYS = ['season', 'themes', 'themes_signature', 'themes_update', 'up_to_speed'] as const

export function preserveServerOwned(
  incoming: Record<string, unknown>,
  existing: unknown,
): Record<string, unknown> {
  const current = (existing && typeof existing === 'object' ? existing : {}) as Record<string, unknown>
  const out = { ...incoming }
  for (const key of SERVER_OWNED_KEYS) {
    if (current[key] !== undefined) out[key] = current[key]
    else delete out[key]
  }
  return out
}
