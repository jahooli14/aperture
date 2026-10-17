import { describe, it, expect } from 'vitest'
import { deriveSessionShapes } from './session-shapes.js'

describe('deriveSessionShapes', () => {
  it('gives a brand-new project a single start shape', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: null,
      slots: [],
      mvsMinutes: null,
      windowMinutes: 60,
    })
    expect(shapes).toEqual([{ text: 'Start it.', source: 'start', partial: false }])
  })

  it('reads the next move back from the close-out marker', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: 'Got the intro sorted. Next: fix the transition out of track two.',
      slots: [],
      mvsMinutes: null,
      windowMinutes: 60,
    })
    // Ignition first (Power Hour's surviving idea), then the real move.
    expect(shapes[0].source).toBe('ignition')
    expect(shapes[1]).toEqual({
      text: 'fix the transition out of track two.',
      source: 'closeout',
      partial: false,
    })
  })

  it('falls back to the whole close-out when there is no "next:" marker', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: 'Ran out of time before the bridge section.',
      slots: [],
      mvsMinutes: null,
      windowMinutes: 60,
    })
    expect(shapes[1].text).toBe('Ran out of time before the bridge section.')
  })

  it('fills remaining slots (up to 3) from empty slots', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: 'Next: pick a venue.',
      slots: [
        { name: 'first track', filled: false },
        { name: 'sound', filled: true },
        { name: 'deadline', filled: false },
      ],
      mvsMinutes: null,
      windowMinutes: 60,
    })
    // Ignition + close-out + first empty slot, capped at 3.
    expect(shapes).toHaveLength(3)
    expect(shapes[0].source).toBe('ignition')
    expect(shapes[1].source).toBe('closeout')
    expect(shapes[2]).toEqual({ text: 'Find or decide: first track', source: 'slot', partial: false })
  })

  it('never returns more than 3 items', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: 'Next: A.',
      slots: [
        { name: 'B', filled: false },
        { name: 'C', filled: false },
        { name: 'D', filled: false },
        { name: 'E', filled: false },
      ],
      mvsMinutes: null,
      windowMinutes: 60,
    })
    expect(shapes.length).toBeLessThanOrEqual(3)
  })

  it('decomposes into one partial shape when the window is smaller than MVS', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: 'Next: redraft chapter 4.',
      slots: [{ name: 'ending', filled: false }],
      mvsMinutes: 120,
      windowMinutes: 20,
    })
    expect(shapes).toHaveLength(2)
    expect(shapes[0].source).toBe('ignition')
    expect(shapes[1].partial).toBe(true)
    expect(shapes[1].source).toBe('decomposition')
    expect(shapes[1].text).toContain('redraft chapter 4.')
  })

  it('does not decompose when the window meets or exceeds MVS', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: 'Next: redraft chapter 4.',
      slots: [],
      mvsMinutes: 60,
      windowMinutes: 60,
    })
    expect(shapes.every(sh => !sh.partial)).toBe(true)
  })

  it('does not decompose when MVS is unseeded', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: 'Next: redraft chapter 4.',
      slots: [],
      mvsMinutes: null,
      windowMinutes: 15,
    })
    expect(shapes.every(sh => !sh.partial)).toBe(true)
  })

  it('treats blank close-out text as absent', () => {
    const shapes = deriveSessionShapes({
      lastClosingText: '   ',
      slots: [{ name: 'first track', filled: false }],
      mvsMinutes: null,
      windowMinutes: 30,
    })
    expect(shapes[0].source).toBe('ignition')
    expect(shapes[1].source).toBe('slot')
  })
})
