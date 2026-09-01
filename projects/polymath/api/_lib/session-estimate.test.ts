import { describe, it, expect } from 'vitest'
import { nearestEstimate, bumpEstimate, ESTIMATE_MINUTES } from './session-estimate.js'

describe('nearestEstimate', () => {
  it('snaps to the closest value on the ladder', () => {
    expect(nearestEstimate(7)).toBe(5)
    expect(nearestEstimate(8)).toBe(10)
    expect(nearestEstimate(50)).toBe(45)
  })

  it('leaves an exact ladder value alone', () => {
    for (const m of ESTIMATE_MINUTES) expect(nearestEstimate(m)).toBe(m)
  })
})

describe('bumpEstimate', () => {
  it('moves one rung up the ladder', () => {
    expect(bumpEstimate(15)).toBe(20)
  })

  it('stays put at the top of the ladder', () => {
    expect(bumpEstimate(60)).toBe(60)
  })
})
