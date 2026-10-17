import { describe, it, expect } from 'vitest'
import { splitDoneWhen } from './moveText'

describe('splitDoneWhen', () => {
  it('pulls the stopping point out from under the move', () => {
    expect(splitDoneWhen('Loop bars 9-12 and program a kick. Done when it loops without wincing.'))
      .toEqual({ move: 'Loop bars 9-12 and program a kick.', doneWhen: 'Done when it loops without wincing.' })
  })
  it('leaves a step without one alone', () => {
    expect(splitDoneWhen('Record verse two')).toEqual({ move: 'Record verse two', doneWhen: null })
  })
})
