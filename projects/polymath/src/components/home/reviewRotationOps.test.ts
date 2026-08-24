import { describe, it, expect } from 'vitest'
import { dormancyFade } from './reviewRotationOps'

describe('dormancyFade', () => {
  it('leaves a freshly-touched project at full strength', () => {
    expect(dormancyFade(0)).toBe(1)
  })

  it('dims further the longer a project has sat', () => {
    expect(dormancyFade(30)).toBeGreaterThan(dormancyFade(180))
    expect(dormancyFade(180)).toBeGreaterThan(dormancyFade(365))
  })

  it('never fades below readable, however long it has been forgotten', () => {
    expect(dormancyFade(365)).toBeCloseTo(0.62, 5)
    expect(dormancyFade(10_000)).toBeCloseTo(0.62, 5)
  })

  it('clamps nonsense input rather than producing a value above full', () => {
    expect(dormancyFade(-50)).toBe(1)
  })
})
