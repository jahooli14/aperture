import { getStorageText } from './mask'

// Replace the half-open range [start, end) in the displayed (possibly masked)
// prose with newText, and return both the new display text and the storage
// form to persist. This is the single source of truth for applying a redraft,
// so the text outside the selection is provably preserved.
export function applyRewrite(
  displayBase: string,
  start: number,
  end: number,
  newText: string,
  realName: string,
  maskEnabled: boolean
): { displayProse: string; storageProse: string } {
  const safeStart = Math.max(0, Math.min(start, displayBase.length))
  const safeEnd = Math.max(safeStart, Math.min(end, displayBase.length))
  const before = displayBase.slice(0, safeStart)
  const after = displayBase.slice(safeEnd)
  const displayProse = before + newText + after
  return {
    displayProse,
    storageProse: getStorageText(displayProse, realName, maskEnabled),
  }
}

// Map a read-mode text selection back to offsets in the display prose.
// Returns null when the selection is too short or can't be located
// unambiguously enough to redraft the right span safely.
export function locateSelection(
  displayBase: string,
  selected: string
): { start: number; end: number } | null {
  if (selected.trim().length < 4) return null
  const start = displayBase.indexOf(selected)
  if (start === -1) return null
  const ambiguous = displayBase.indexOf(selected, start + 1) !== -1
  if (ambiguous && selected.trim().length < 12) return null
  return { start, end: start + selected.length }
}

// Build the context the AI sees when redrafting a passage. For a long scene,
// centre the window on the passage so the model sees the voice immediately
// around it — not just the scene's opening, which is what it would get from
// a naive head-slice and which produces tonally-off redrafts deep in a scene.
export function passageContextWindow(
  fullProse: string,
  passage: string,
  radius = 900
): string {
  if (fullProse.length <= radius * 2) return fullProse
  const idx = fullProse.indexOf(passage)
  if (idx === -1) return fullProse.slice(0, radius * 2) + '…'
  const start = Math.max(0, idx - radius)
  const end = Math.min(fullProse.length, idx + passage.length + radius)
  return (
    (start > 0 ? '…' : '') +
    fullProse.slice(start, end) +
    (end < fullProse.length ? '…' : '')
  )
}
