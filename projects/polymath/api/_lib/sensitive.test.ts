import { describe, it, expect } from 'vitest'
import { isSensitive } from './sensitive.js'
import { isElicitedAnswer } from './corpus-provenance.js'
import { filedProjectId, isAppSuggested } from './mull-corpus.js'

describe('isSensitive', () => {
  it('catches the notes that topped a real run', () => {
    expect(isSensitive('My dad had a heart attack a few weeks ago')).toBe(true)
    expect(isSensitive('my mom has Alzheimer\'s and can wander off')).toBe(true)
    expect(isSensitive('a nerve root injection into my cervical spine')).toBe(true)
    expect(isSensitive('when I get excited, with beers, etcetera')).toBe(true)
    expect(isSensitive("my default state when I'm high is being proud")).toBe(true)
  })
  it('leaves ordinary creative notes alone', () => {
    expect(isSensitive('his sleep is forever at the end of the book')).toBe(false)
    expect(isSensitive('finishing my second track in Brockwell Park')).toBe(false)
    expect(isSensitive('the high level beats rewrite')).toBe(false)
    expect(isSensitive(null)).toBe(false)
  })
})

describe('isElicitedAnswer', () => {
  it('spots an untagged spark answer by its opening', () => {
    expect(isElicitedAnswer('Spark response - It was never going to be a single word')).toBe(true)
    expect(isElicitedAnswer('  spark response, I am moving it to him not sleeping')).toBe(true)
    expect(isElicitedAnswer('A spark response would be nice')).toBe(false)
  })
})

describe('filedProjectId', () => {
  it('trusts the page it was said on, then triage, never a guess', () => {
    expect(filedProjectId({ source_reference: 'project:p1', triage: { project_id: 'p2' } })).toBe('p1')
    expect(filedProjectId({ source_reference: { type: 'project', id: 'p3' } })).toBe('p3')
    expect(filedProjectId({ source_reference: { type: 'spark', id: 's1' }, triage: { project_id: 'p2' } })).toBe('p2')
    expect(filedProjectId({ source_reference: null, triage: { project_id: null } })).toBeNull()
  })
})

describe('isAppSuggested', () => {
  it('marks a project the app proposed', () => {
    expect(isAppSuggested({ metadata: { from_idea: 'abc' } })).toBe(true)
    expect(isAppSuggested({ metadata: { tasks: [] } })).toBe(false)
    expect(isAppSuggested({ metadata: null })).toBe(false)
  })
})
