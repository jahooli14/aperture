/**
 * Does everything that should have a vector actually have one, and is it
 * still the vector for what the row currently says?
 *
 * "Everything is embedded" was an assumption nobody could check. The
 * failures it hid are the ones this channel keeps rediscovering: a
 * gatherer returning zero because the rows it wanted had no vector, and a
 * search quietly missing a note because its embedding was built from text
 * that has since been rewritten. Both look identical from outside — an
 * empty result — and neither raises anything.
 *
 * So coverage is counted, per table, with the reason a row is out:
 *
 *   MISSING — should have a vector and does not.
 *   STALE   — has one, but the TEXT THAT WAS EMBEDDED has changed since it
 *             was computed. A stale vector is worse than a missing one:
 *             nothing retries it, and it is wrong rather than absent.
 *
 *             `updated_at` does not mean that. A project's row is written
 *             every time its heat is recomputed or a task is ticked, none
 *             of which touches its title or description -- so comparing the
 *             two reported all 34 projects stale on a corpus where not one
 *             had been reworded. A check that cries wolf on everything is
 *             the same as no check, and this one would have sent the whole
 *             table back through the embedder every run.
 *   N/A     — deliberately excluded. An article without a "good" verdict
 *             is not corpus (reading-corpus.ts), so it is not a gap.
 */

export interface TableCoverage {
  table: string
  total: number
  embedded: number
  missing: number
  stale: number
  /** Rows deliberately not embedded — not a gap. */
  excluded: number
}

export interface CoverageRow {
  id: string
  embedding: unknown
  embedded_at?: string | null
  /** When the text that gets embedded last changed — NOT `updated_at`, which
   *  moves for reasons that have nothing to do with the text. */
  text_updated_at?: string | null
  created_at?: string | null
}

function hasVector(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0
  return typeof v === 'string' && v.length > 2
}

/**
 * A vector is stale when the row changed after it was computed.
 *
 * Missing `embedded_at` on a row that HAS a vector means it predates the
 * column — the migration stamps those, so treating it as stale here would
 * rebuild the whole corpus on the first run for no reason.
 */
export function isStale(row: CoverageRow): boolean {
  if (!hasVector(row.embedding)) return false
  if (!row.embedded_at) return false
  // Only a column that actually carries the embedded text can date it.
  // Nothing does yet, so staleness is honestly unanswerable and reported
  // as such rather than guessed at from an unrelated timestamp.
  const changed = row.text_updated_at
  if (!changed) return false
  const changedAt = new Date(changed).getTime()
  const embeddedAt = new Date(row.embedded_at).getTime()
  if (!Number.isFinite(changedAt) || !Number.isFinite(embeddedAt)) return false
  // A second of slack: the embedding is written in the same update as the
  // content on the capture path, and the two timestamps race.
  return changedAt > embeddedAt + 1000
}

export function summarise(
  table: string,
  rows: CoverageRow[],
  isExcluded: (row: CoverageRow) => boolean = () => false,
): TableCoverage {
  let embedded = 0, missing = 0, stale = 0, excluded = 0
  for (const row of rows) {
    if (isExcluded(row)) { excluded++; continue }
    if (!hasVector(row.embedding)) { missing++; continue }
    embedded++
    if (isStale(row)) stale++
  }
  return { table, total: rows.length, embedded, missing, stale, excluded }
}

export function describeCoverage(all: TableCoverage[]): string[] {
  const out = all.map(c =>
    `coverage ${c.table}: ${c.embedded}/${c.total - c.excluded} embedded` +
    `${c.missing ? `, ${c.missing} MISSING` : ''}` +
    `${c.stale ? `, ${c.stale} STALE` : ''}` +
    `${c.excluded ? `, ${c.excluded} not corpus` : ''}`,
  )
  const gaps = all.reduce((n, c) => n + c.missing + c.stale, 0)
  out.push(gaps === 0
    ? 'coverage: every corpus row has a current vector'
    : `coverage: ${gaps} rows need embedding — run utilities?resource=backfill-embeddings`)
  return out
}
