import { describe, it, expect } from 'vitest'
import { freshNoteLabel } from './freshNote'

const now = Date.parse('2026-11-14T09:00:00Z')
const ago = (h: number) => new Date(now - h * 3600_000).toISOString()

describe('freshNoteLabel', () => {
  it('says today for a note from the last day', () => {
    expect(freshNoteLabel([{ kind: 'memory', at: ago(5) }], now)).toBe('Built from what you said today.')
  })
  it('says yesterday for a note a day or so old', () => {
    expect(freshNoteLabel([{ kind: 'fragment', at: ago(30) }], now)).toBe('Built from what you said yesterday.')
  })
  it('says nothing for older notes, undated rows, projects or list items', () => {
    expect(freshNoteLabel([{ kind: 'memory', at: ago(96) }], now)).toBeNull()
    expect(freshNoteLabel([{ kind: 'memory' }], now)).toBeNull()
    expect(freshNoteLabel([{ kind: 'project', at: ago(1) }, { kind: 'list_item', at: ago(1) }], now)).toBeNull()
    expect(freshNoteLabel(null, now)).toBeNull()
  })
  it('uses the newest note when there are several', () => {
    expect(freshNoteLabel([{ kind: 'memory', at: ago(96) }, { kind: 'memory', at: ago(2) }], now)).toBe('Built from what you said today.')
  })
})
