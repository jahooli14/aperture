import { describe, it, expect } from 'vitest'
import {
  detectSessionBriefPhase,
  detectSessionBriefMomentum,
  buildSessionBriefPrompt,
  parseSessionBriefResponse,
  moveHeadline,
  type SessionBriefPromptInput,
} from './session-brief.js'

const baseInput: SessionBriefPromptInput = {
  title: 'Going Analogue',
  description: 'A manuscript, edited toward something sendable to agents.',
  motivation: null,
  endGoal: 'An updated manuscript which is ready to send to literary agents',
  phase: 'building',
  momentum: 'steady',
  daysSinceActive: 1,
  completedTasks: 3,
  totalTasks: 8,
  progressPercent: 38,
  incompleteTasks: [{ text: 'Convert act 3 to an appendix of definitions', task_type: 'core' }],
  recentCompletionTexts: [],
  recentCaptures: [],
  lastCheckpoint: null,
}

describe('detectSessionBriefPhase', () => {
  it('calls an empty task list shaping, whatever else is true', () => {
    expect(detectSessionBriefPhase([], 0, 100)).toBe('shaping')
  })

  it('calls two weeks of silence stale even with tasks left', () => {
    const tasks = [{ id: 't1', text: 'a', done: false, order: 0 }]
    expect(detectSessionBriefPhase(tasks, 14, 30)).toBe('stale')
  })

  it('calls a brand-new project fresh before staleness or progress matter', () => {
    const tasks = [{ id: 't1', text: 'a', done: false, order: 0 }]
    expect(detectSessionBriefPhase(tasks, 1, 2)).toBe('fresh')
  })

  it('calls 75%+ done with at least 3 tasks closing', () => {
    const tasks = [
      { id: 't1', text: 'a', done: true, order: 0 },
      { id: 't2', text: 'b', done: true, order: 1 },
      { id: 't3', text: 'c', done: true, order: 2 },
      { id: 't4', text: 'd', done: false, order: 3 },
    ]
    expect(detectSessionBriefPhase(tasks, 1, 30)).toBe('closing')
  })

  it('falls back to building for ordinary steady work', () => {
    const tasks = [
      { id: 't1', text: 'a', done: true, order: 0 },
      { id: 't2', text: 'b', done: false, order: 1 },
    ]
    expect(detectSessionBriefPhase(tasks, 3, 30)).toBe('building')
  })
})

describe('detectSessionBriefMomentum', () => {
  it('reads two weeks of silence as cold, however much got done before that', () => {
    expect(detectSessionBriefMomentum(20, 5)).toBe('cold')
  })

  it('reads a week of silence as fading', () => {
    expect(detectSessionBriefMomentum(9, 0)).toBe('fading')
  })

  it('reads recent completions and a recent visit as rising', () => {
    expect(detectSessionBriefMomentum(1, 2)).toBe('rising')
  })

  it('defaults to steady otherwise', () => {
    expect(detectSessionBriefMomentum(3, 1)).toBe('steady')
  })
})

describe('buildSessionBriefPrompt — catching up on what changed', () => {
  it('says nothing was captured when there is nothing to report', () => {
    const p = buildSessionBriefPrompt(baseInput)
    expect(p).not.toContain('NEW SINCE YOUR LAST SESSION')
  })

  it('surfaces a real capture attached to the project since the last visit', () => {
    const p = buildSessionBriefPrompt({
      ...baseInput,
      recentCaptures: [{ text: 'The appendix idea only works if chapter 9 keeps its footnotes', when: 'yesterday' }],
    })
    expect(p).toContain('NEW SINCE YOUR LAST SESSION ON THIS PROJECT')
    expect(p).toContain('(yesterday) "The appendix idea only works if chapter 9 keeps its footnotes"')
  })

  it('tells the model not to force a connection that is not there', () => {
    const p = buildSessionBriefPrompt({
      ...baseInput,
      recentCaptures: [{ text: 'Some unrelated thought', when: 'today' }],
    })
    expect(p.toLowerCase()).toContain("do not force a connection that isn't there")
  })

  it('caps a stale re-open at the stale instructions, not the building ones', () => {
    const p = buildSessionBriefPrompt({ ...baseInput, phase: 'stale', daysSinceActive: 21 })
    expect(p).toContain("THEY'VE BEEN AWAY FOR 21 DAYS")
    expect(p).not.toContain('BUILDING — steps in flight')
  })

  it('says nothing about a checkpoint when there is none yet', () => {
    const p = buildSessionBriefPrompt(baseInput)
    expect(p).not.toContain('LAST TIME THE LIST RAN OUT')
  })

  it('surfaces the last honest "how close is this" verdict when the list has emptied before', () => {
    const p = buildSessionBriefPrompt({
      ...baseInput,
      lastCheckpoint: { reason: 'Still needs a synopsis and three comp titles.' },
    })
    expect(p).toContain('LAST TIME THE LIST RAN OUT')
    expect(p).toContain('Still needs a synopsis and three comp titles.')
    expect(p).toContain('more honest than\na task count')
  })

  it('never asks what done looks like on a project with no tasks', () => {
    const p = buildSessionBriefPrompt({ ...baseInput, phase: 'shaping', totalTasks: 0, incompleteTasks: [] })
    expect(p).toContain('NOTHING ON THE LIST YET')
    expect(p).toContain('Do NOT ask what done looks like')
  })

  it('names the finish line when the project has one', () => {
    const p = buildSessionBriefPrompt(baseInput)
    expect(p).toContain('DONE LOOKS LIKE: An updated manuscript which is ready to send to literary agents')
  })

  it('is honest that an ongoing project may have no end when it has none', () => {
    const p = buildSessionBriefPrompt({ ...baseInput, endGoal: null })
    expect(p).toContain('DONE: not stated')
    expect(p).toContain('this project may be an ongoing thing with no end')
  })
})

describe('parseSessionBriefResponse', () => {
  it('reads a well-formed reply straight through', () => {
    const result = parseSessionBriefResponse(
      JSON.stringify({
        greeting: 'You just finished the appendix conversion.',
        focusSuggestion: 'Reread act 3 for anything the appendix now needs to cover.',
        proactiveQuestion: 'Does that task still need doing, or has it moved on?',
      }),
      { firstIncompleteTaskText: 'Reread act 3', title: 'Going Analogue' },
    )
    expect(result.greeting).toBe('You just finished the appendix conversion.')
    expect(result.proactiveQuestion).toBe('Does that task still need doing, or has it moved on?')
  })

  it('falls back to a concrete, task-aware greeting on malformed JSON', () => {
    const result = parseSessionBriefResponse('not json at all', {
      firstIncompleteTaskText: 'Reread act 3',
      title: 'Going Analogue',
    })
    expect(result.greeting).toBe('Ready to pick up where you left off.')
    expect(result.focusSuggestion).toBe('Reread act 3')
    expect(result.proactiveQuestion).toContain('30 minutes')
  })

  it('falls back to the project-naming question when there is no task to fall back on', () => {
    const result = parseSessionBriefResponse('{}', { firstIncompleteTaskText: null, title: 'Going Analogue' })
    expect(result.proactiveQuestion).toBe("What's the first thing that has to exist for Going Analogue?")
  })

  it('never returns an empty greeting even if the model wrote one', () => {
    const result = parseSessionBriefResponse(
      JSON.stringify({ greeting: '', focusSuggestion: 'x', proactiveQuestion: 'y' }),
      { firstIncompleteTaskText: 'Reread act 3', title: 'Going Analogue' },
    )
    expect(result.greeting).toBe('Ready to pick up where you left off.')
  })

  // Live, Sept 2026: every step ticked, a move on the card below -- and the
  // Guide opened with "The task list is clear" and asked "What's the last
  // thing on this list you'd want out of the way?"
  describe('when a next move is already written', () => {
    const withMove: SessionBriefPromptInput = {
      ...baseInput,
      phase: 'closing',
      completedTasks: 4,
      totalTasks: 4,
      progressPercent: 100,
      incompleteTasks: [],
      nextMove: {
        text: 'Paste the first section of text into Claude AI along with your comments and hit send. Done when Claude AI starts generating the rewrite in plain English.',
        kind: 'move',
      },
      lastNote: 'Fed the rewrite comments in. Next is the first section.',
    }

    it('talks about the move and the note, not the list', () => {
      const p = buildSessionBriefPrompt(withMove)
      expect(p).toContain('THE NEXT MOVE, ALREADY ON THE CARD BELOW YOU: "Paste the first section of text into Claude AI along with your comments and hit send."')
      expect(p).toContain('WHERE THEY LEFT OFF (their own note): "Fed the rewrite comments in.')
      expect(p).toContain('never call it clear')
      expect(p).not.toContain('HOME STRETCH')
      expect(p).not.toContain("What's the last thing on this list")
      expect(p).not.toContain('PROGRESS: 4/4')
    })

    it('treats an open fork as the question to ask', () => {
      const p = buildSessionBriefPrompt({ ...withMove, nextMove: { text: 'The pole, or the wires?', kind: 'fork' } })
      expect(p).toContain('OPEN QUESTION ON THE CARD BELOW YOU: "The pole, or the wires?"')
    })

    it('falls back to the list when no move exists', () => {
      const p = buildSessionBriefPrompt({ ...withMove, nextMove: null, incompleteTasks: [{ text: 'x' }], totalTasks: 5 })
      expect(p).toContain('HOME STRETCH')
    })
  })
})

describe('moveHeadline', () => {
  it('drops the "Done when" tail the card already shows', () => {
    expect(moveHeadline('Sand the edge. Done when it is smooth.')).toBe('Sand the edge.')
    expect(moveHeadline('Sand the edge.')).toBe('Sand the edge.')
  })
})
