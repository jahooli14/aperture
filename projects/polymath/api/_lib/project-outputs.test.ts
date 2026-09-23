import { describe, it, expect } from 'vitest'
import { parseOutputInput, pathFromPublicUrl, isMissingTable } from './project-outputs'

const PREFIX = 'https://abc.supabase.co/storage/v1/object/public/thought-images/'
const PROJECT = '11111111-2222-4333-8444-555555555555'
const SESSION = '66666666-7777-4888-9999-000000000000'

describe('pathFromPublicUrl', () => {
  it('takes the object name from one of our URLs', () => {
    expect(pathFromPublicUrl(PREFIX + '1727000000_ab12cd.jpg', PREFIX)).toBe('1727000000_ab12cd.jpg')
  })
  it('refuses anywhere else', () => {
    expect(pathFromPublicUrl('https://evil.example/x.jpg', PREFIX)).toBeNull()
    expect(pathFromPublicUrl(PREFIX + '../other-bucket/x.jpg', PREFIX)).toBeNull()
    expect(pathFromPublicUrl(PREFIX + 'a/b.jpg', PREFIX)).toBeNull()
    expect(pathFromPublicUrl(PREFIX, PREFIX)).toBeNull()
    expect(pathFromPublicUrl(42, PREFIX)).toBeNull()
  })
})

describe('parseOutputInput', () => {
  const good = { project_id: PROJECT, session_id: SESSION, url: PREFIX + 'a.jpg', kind: 'image' }

  it('reads a good body', () => {
    const r = parseOutputInput(good, PREFIX)
    expect(r).toEqual({ ok: true, value: { project_id: PROJECT, session_id: SESSION, path: 'a.jpg', kind: 'image', note: null } })
  })
  it('drops a session id that is not a real one (offline sessions)', () => {
    const r = parseOutputInput({ ...good, session_id: 'offline-123' }, PREFIX)
    expect(r.ok && r.value.session_id).toBeNull()
  })
  it('trims and caps the note', () => {
    const r = parseOutputInput({ ...good, note: '  ' + 'x'.repeat(300) + ' ' }, PREFIX)
    expect(r.ok && r.value.note?.length).toBe(200)
  })
  it('says what is wrong', () => {
    expect(parseOutputInput({ ...good, project_id: 'nope' }, PREFIX)).toEqual({ ok: false, error: 'project_id required' })
    expect(parseOutputInput({ ...good, url: 'https://x.test/a.jpg' }, PREFIX).ok).toBe(false)
    expect(parseOutputInput({ ...good, kind: 'video' }, PREFIX).ok).toBe(false)
    expect(parseOutputInput(null, PREFIX).ok).toBe(false)
  })
})

describe('isMissingTable', () => {
  it('knows the codes for a table that does not exist yet', () => {
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
