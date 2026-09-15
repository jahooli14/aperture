import { describe, it, expect } from 'vitest'
import { isAppAuthored, userSaid, SPARK_RESPONSE_TAG } from './corpus-provenance.js'

describe('corpus provenance', () => {
  it('marks an answer to the app as app-authored', () => {
    expect(isAppAuthored({ tags: [SPARK_RESPONSE_TAG] })).toBe(true)
    expect(isAppAuthored({ tags: ['memory', SPARK_RESPONSE_TAG] })).toBe(true)
  })

  it('leaves a real capture alone', () => {
    expect(isAppAuthored({ tags: ['memory', 'dad'] })).toBe(false)
  })

  it('treats a missing or null tags column as user-said, not as app-authored', () => {
    // Almost the whole corpus predates the marker. Reading absent tags as
    // app-authored would empty every timeline at once.
    expect(isAppAuthored({})).toBe(false)
    expect(isAppAuthored({ tags: null })).toBe(false)
    expect(isAppAuthored(null)).toBe(false)
    expect(isAppAuthored(undefined)).toBe(false)
  })

  it('catches the older leaks too, not just spark answers', () => {
    expect(isAppAuthored({ tags: ['morning-followup'] })).toBe(true)
    expect(isAppAuthored({ tags: ['bedtime-synthesis'] })).toBe(true)
  })

  it('filters a list and keeps untagged rows', () => {
    const rows = [
      { id: 'a', tags: ['memory'] },
      { id: 'b', tags: [SPARK_RESPONSE_TAG] },
      { id: 'c' },
      { id: 'd', tags: null },
    ]
    expect(userSaid(rows).map(r => r.id)).toEqual(['a', 'c', 'd'])
  })

  it('survives an empty or missing list', () => {
    expect(userSaid([])).toEqual([])
    expect(userSaid(null)).toEqual([])
  })
})
