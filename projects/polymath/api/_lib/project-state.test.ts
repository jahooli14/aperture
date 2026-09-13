import { describe, it, expect } from 'vitest'
import { isGraveyarded } from './project-state.js'

describe('isGraveyarded', () => {
  it('catches the harvested state (completion, or drift-decay letting a project go)', () => {
    expect(isGraveyarded({ state: 'harvested', status: 'active' })).toBe(true)
  })

  it('catches a project sent to the graveyard -- state stays "mull", only status changes', () => {
    // The real leak: burying a project (projects.ts) sets status:
    // 'abandoned' and leaves state at 'mull'. Every existing
    // `.neq('state', 'harvested')` guard in the codebase misses this.
    expect(isGraveyarded({ state: 'mull', status: 'abandoned' })).toBe(true)
  })

  it('leaves a live or dormant project alone -- dormant is explicitly not waste', () => {
    expect(isGraveyarded({ state: 'mull', status: 'dormant' })).toBe(false)
    expect(isGraveyarded({ state: 'live', status: 'active' })).toBe(false)
  })

  it('does not treat a missing status as abandoned', () => {
    expect(isGraveyarded({ state: 'mull', status: null })).toBe(false)
    expect(isGraveyarded({ state: 'mull' })).toBe(false)
  })
})
