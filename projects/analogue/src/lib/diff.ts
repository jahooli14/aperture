// Word-level diff for the rewrite panel — tracked-changes style.

export type DiffPart = { type: 'same' | 'add' | 'del'; value: string }

// Split into words while keeping whitespace as its own tokens so spacing survives.
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? []
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before)
  const b = tokenize(after)
  const n = a.length
  const m = b.length

  // LCS table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const parts: DiffPart[] = []
  const push = (type: DiffPart['type'], value: string) => {
    const last = parts[parts.length - 1]
    if (last && last.type === type) last.value += value
    else parts.push({ type, value })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('same', a[i])
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('del', a[i])
      i++
    } else {
      push('add', b[j])
      j++
    }
  }
  while (i < n) push('del', a[i++])
  while (j < m) push('add', b[j++])

  return parts
}
