import { describe, it, expect } from 'vitest'
import { pickGap, closeoutNamesNextStep, quoteCloseout } from './session-gap.js'

const BASE = {
  title: 'Graham song',
  endGoal: null as string | null,
  lastCloseout: null as string | null,
  openTaskCount: 0,
  unfilledSlots: [] as string[],
}

describe('closeoutNamesNextStep', () => {
  it('sees an explicit next step', () => {
    expect(closeoutNamesNextStep('Got the intro sorted. Next: fix the transition.')).toBe(true)
    expect(closeoutNamesNextStep('Ran out of time, will carry on with the bridge')).toBe(true)
  })

  it('sees when there is only a where-I-got-to', () => {
    expect(closeoutNamesNextStep('Got the intro sorted.')).toBe(false)
    expect(closeoutNamesNextStep(null)).toBe(false)
  })
})

describe('quoteCloseout', () => {
  it('leaves a short close-out alone', () => {
    expect(quoteCloseout('Got the intro sorted.')).toBe('Got the intro sorted.')
  })

  it('trims a long one so the question stays readable', () => {
    const q = quoteCloseout('a b c d e f g h i j k l m n o p')
    expect(q.endsWith('…')).toBe(true)
    expect(q.split(' ')).toHaveLength(12)
  })
})

describe('pickGap', () => {
  it('asks for the finish line first — everything reasons backwards from it', () => {
    const gap = pickGap(BASE)
    expect(gap?.kind).toBe('end_goal')
    expect(gap?.question).toContain('what have you actually got')
  })

  it('asks for the first real thing when there is a goal but no motion', () => {
    expect(pickGap({ ...BASE, endGoal: 'A finished mix' })?.kind).toBe('first_step')
  })

  it('quotes the close-out back when it says where but not where next', () => {
    const gap = pickGap({
      ...BASE,
      endGoal: 'A finished mix',
      lastCloseout: 'Got the intro sorted.',
    })
    expect(gap?.kind).toBe('next_step')
    expect(gap?.question).toContain('Got the intro sorted.')
  })

  it('does not re-ask for a next step the close-out already names', () => {
    const gap = pickGap({
      ...BASE,
      endGoal: 'A finished mix',
      lastCloseout: 'Got the intro sorted. Next: fix the transition.',
      unfilledSlots: ['first track'],
    })
    expect(gap?.kind).toBe('slot')
    expect(gap?.slotName).toBe('first track')
  })

  it('has nothing to ask when the project is properly shaped', () => {
    expect(pickGap({
      ...BASE,
      endGoal: 'A finished mix',
      lastCloseout: 'Next: fix the transition.',
      openTaskCount: 3,
    })).toBeNull()
  })

  it('never asks two things at once', () => {
    // Every gap present at the same time still yields exactly one question.
    const gap = pickGap({ ...BASE, unfilledSlots: ['first track', 'venue'] })
    expect(gap).not.toBeNull()
    expect(gap!.question.split('?')).toHaveLength(2)
  })
})
