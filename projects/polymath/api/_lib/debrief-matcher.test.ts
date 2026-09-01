import { describe, it, expect } from 'vitest'
import { quoteVerified, sanitizeDebrief, buildDebriefPrompt, type DebriefOpenTask } from './debrief-matcher.js'

describe('quoteVerified', () => {
  it('accepts a quote that genuinely appears in the source', () => {
    expect(quoteVerified('got the intro sorted', 'Did the intro today, got the intro sorted finally.')).toBe(true)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(quoteVerified('Got   The Intro', 'i finally got the intro done')).toBe(true)
  })

  it('rejects a quote that does not appear at all', () => {
    expect(quoteVerified('recorded the guitar solo', 'worked on the intro a bit')).toBe(false)
  })

  it('rejects a missing or trivially short quote', () => {
    expect(quoteVerified(undefined, 'anything')).toBe(false)
    expect(quoteVerified('', 'anything')).toBe(false)
    expect(quoteVerified('it', 'did it today')).toBe(false)
  })
})

describe('sanitizeDebrief', () => {
  const openTasks: DebriefOpenTask[] = [
    { id: 't1', text: 'Fix the transition out of track two' },
    { id: 't2', text: 'Record the second verse' },
  ]
  const closeoutText = 'Finally fixed the transition, and also bounced a rough mix. Next time I want to add a bassline.'

  it('keeps a done match whose task id was actually offered', () => {
    const result = sanitizeDebrief({ done: [{ task_id: 't1' }] }, closeoutText, openTasks)
    expect(result.doneTaskIds).toEqual(['t1'])
  })

  it('drops a done match citing a task id that was never offered', () => {
    const result = sanitizeDebrief({ done: [{ task_id: 't-invented' }] }, closeoutText, openTasks)
    expect(result.doneTaskIds).toEqual([])
  })

  it('dedupes repeated done ids', () => {
    const result = sanitizeDebrief({ done: [{ task_id: 't1' }, { task_id: 't1' }] }, closeoutText, openTasks)
    expect(result.doneTaskIds).toEqual(['t1'])
  })

  it('keeps a new-done claim whose quote genuinely appears in the text', () => {
    const result = sanitizeDebrief(
      { new_done: [{ text: 'Bounced a rough mix', quote: 'bounced a rough mix' }] },
      closeoutText, openTasks,
    )
    expect(result.newDone).toEqual(['Bounced a rough mix'])
  })

  it('drops a new-done claim with no verifiable quote -- no citation, no task', () => {
    const result = sanitizeDebrief(
      { new_done: [{ text: 'Recorded a full guitar solo', quote: 'recorded a full guitar solo' }] },
      closeoutText, openTasks,
    )
    expect(result.newDone).toEqual([])
  })

  it('keeps a grounded next item', () => {
    const result = sanitizeDebrief(
      { next: [{ text: 'Add a bassline', quote: 'add a bassline' }] },
      closeoutText, openTasks,
    )
    expect(result.next).toEqual(['Add a bassline'])
  })

  it('drops a next item that is really the same as an existing open task', () => {
    const result = sanitizeDebrief(
      { next: [{ text: 'Fix the transition between tracks', quote: 'add a bassline' }] },
      closeoutText, openTasks,
    )
    // Note: quote is unrelated on purpose here -- the dedupe check should
    // fire regardless of which gate would have caught it.
    expect(result.next.some(t => t.toLowerCase().includes('transition'))).toBe(false)
  })

  it('drops a next item that is admin, not a real move', () => {
    const result = sanitizeDebrief(
      { next: [{ text: 'Decide on the running order', quote: 'add a bassline' }] },
      closeoutText, openTasks,
    )
    expect(result.next).toEqual([])
  })

  it('is empty for junk input', () => {
    expect(sanitizeDebrief(null, closeoutText, openTasks)).toEqual({ doneTaskIds: [], newDone: [], next: [] })
    expect(sanitizeDebrief({}, closeoutText, openTasks)).toEqual({ doneTaskIds: [], newDone: [], next: [] })
  })
})

describe('buildDebriefPrompt', () => {
  const openTasks: DebriefOpenTask[] = [{ id: 't1', text: 'Fix the transition' }]

  it('hands over the open tasks as a closed, id-labelled list', () => {
    const p = buildDebriefPrompt('did the transition', openTasks, 'Graham song')
    expect(p).toContain('[t1] Fix the transition')
  })

  it('says plainly when nothing is open', () => {
    const p = buildDebriefPrompt('did some stuff', [], 'Graham song')
    expect(p).toContain('(none open right now)')
  })

  it('requires a quote for the categories that create new tasks', () => {
    const p = buildDebriefPrompt('did some stuff', openTasks, 'Graham song')
    expect(p).toContain('quote')
    expect(p).toContain("If you can't quote it,\nyou can't include it")
  })

  it('tells the model an empty close-out produces empty lists, not invention', () => {
    const p = buildDebriefPrompt('got nowhere, distracted the whole time', openTasks, 'Graham song')
    expect(p).toContain("don't invent content to fill a category")
  })

  it('bans admin verbs in next-session items', () => {
    const p = buildDebriefPrompt('did some stuff', openTasks, 'Graham song')
    expect(p).toContain('decide')
    expect(p).toContain('not a task yet')
  })
})
