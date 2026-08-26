import { describe, expect, it } from 'vitest'
import { normaliseSupabaseUrl } from './supabase.js'

describe('normaliseSupabaseUrl', () => {
  const project = 'https://zaruvcwdqkqmyscwvxci.supabase.co'

  it('leaves a correct project URL alone', () => {
    expect(normaliseSupabaseUrl(project)).toBe(project)
  })

  it('strips the REST endpoint people copy from the dashboard by mistake', () => {
    expect(normaliseSupabaseUrl(`${project}/rest/v1/`)).toBe(project)
    expect(normaliseSupabaseUrl(`${project}/rest/v1`)).toBe(project)
  })

  it('strips the other versioned service paths too', () => {
    expect(normaliseSupabaseUrl(`${project}/auth/v1`)).toBe(project)
    expect(normaliseSupabaseUrl(`${project}/storage/v1`)).toBe(project)
    expect(normaliseSupabaseUrl(`${project}/realtime/v1`)).toBe(project)
  })

  it('strips trailing slashes, including doubled ones supabase-js keeps', () => {
    expect(normaliseSupabaseUrl(`${project}/`)).toBe(project)
    expect(normaliseSupabaseUrl(`${project}//`)).toBe(project)
  })

  it('trims stray whitespace from a copy and paste', () => {
    expect(normaliseSupabaseUrl(`  ${project}  `)).toBe(project)
  })

  it('leaves an empty value empty rather than inventing one', () => {
    expect(normaliseSupabaseUrl('')).toBe('')
  })
})
