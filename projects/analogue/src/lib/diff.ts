// Word-level diff for the rewrite panel — tracked-changes style.
//
// A naive full-matrix LCS is O(n*m) in time and memory. On a whole-scene
// redraft (thousands of words on each side) that means a multi-second freeze
// and a huge allocation — unacceptable on a phone. So we:
//   1. strip the common prefix/suffix (cheap; handles "changed one sentence"),
//   2. run the quadratic LCS only when the differing core is small,
//   3. otherwise fall back to a paragraph-level diff and recurse word-level
//      only into the small changed paragraph runs.
// Every quadratic call is therefore bounded by LCS_MAX tokens per side.

export type DiffPart = { type: 'same' | 'add' | 'del'; value: string }

const LCS_MAX = 1200

function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? []
}

// Split into paragraph + separator tokens (separators kept so text round-trips).
function paragraphs(text: string): string[] {
  return text.match(/\n{2,}|(?:(?!\n{2,})[\s\S])+/g) ?? []
}

function coalesce(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = []
  for (const p of parts) {
    if (!p.value) continue
    const last = out[out.length - 1]
    if (last && last.type === p.type) last.value += p.value
    else out.push({ ...p })
  }
  return out
}

// Classic LCS diff over a token array. Only ever called with bounded input.
function lcsDiff(a: string[], b: string[]): DiffPart[] {
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const parts: DiffPart[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { parts.push({ type: 'same', value: a[i] }); i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { parts.push({ type: 'del', value: a[i] }); i++ }
    else { parts.push({ type: 'add', value: b[j] }); j++ }
  }
  while (i < n) parts.push({ type: 'del', value: a[i++] })
  while (j < m) parts.push({ type: 'add', value: b[j++] })
  return parts
}

function diffCore(before: string, after: string, allowParagraphFallback: boolean): DiffPart[] {
  if (before === after) return before ? [{ type: 'same', value: before }] : []
  if (!before) return [{ type: 'add', value: after }]
  if (!after) return [{ type: 'del', value: before }]

  const a = tokenize(before)
  const b = tokenize(after)

  // Strip common prefix / suffix so the quadratic core is as small as possible.
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let ea = a.length
  let eb = b.length
  while (ea > p && eb > p && a[ea - 1] === b[eb - 1]) { ea--; eb-- }

  const prefix = a.slice(0, p).join('')
  const suffix = a.slice(ea).join('')
  const coreA = a.slice(p, ea)
  const coreB = b.slice(p, eb)

  let middle: DiffPart[]
  if (coreA.length === 0) middle = coreB.length ? [{ type: 'add', value: coreB.join('') }] : []
  else if (coreB.length === 0) middle = [{ type: 'del', value: coreA.join('') }]
  else if (Math.max(coreA.length, coreB.length) <= LCS_MAX) middle = lcsDiff(coreA, coreB)
  else if (allowParagraphFallback) middle = paragraphDiff(coreA.join(''), coreB.join(''))
  else middle = [{ type: 'del', value: coreA.join('') }, { type: 'add', value: coreB.join('') }]

  return [
    ...(prefix ? [{ type: 'same' as const, value: prefix }] : []),
    ...middle,
    ...(suffix ? [{ type: 'same' as const, value: suffix }] : []),
  ]
}

// Diff at paragraph granularity, then recurse word-level into the changed
// runs only. Paragraph counts are small, so this LCS is cheap, and each
// recursive word diff is bounded to a few paragraphs.
function paragraphDiff(before: string, after: string): DiffPart[] {
  const pa = paragraphs(before)
  const pb = paragraphs(after)
  const blocks =
    Math.max(pa.length, pb.length) <= LCS_MAX
      ? lcsDiff(pa, pb)
      : [{ type: 'del' as const, value: before }, { type: 'add' as const, value: after }]

  const merged = coalesce(blocks)
  const out: DiffPart[] = []
  for (let k = 0; k < merged.length; k++) {
    const cur = merged[k]
    const nxt = merged[k + 1]
    if (cur.type === 'del' && nxt && nxt.type === 'add') {
      // A replaced run — show what actually changed inside it.
      out.push(...diffCore(cur.value, nxt.value, false))
      k++
    } else {
      out.push(cur)
    }
  }
  return out
}

export function diffWords(before: string, after: string): DiffPart[] {
  return coalesce(diffCore(before, after, true))
}
