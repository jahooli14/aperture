import { describe, it, expect } from 'vitest'
import { kindOfFile, rejectReason, scaledSize, MAX_OUTPUT_BYTES } from './projectOutputsOps'

describe('kindOfFile', () => {
  it('sorts photos and audio', () => {
    expect(kindOfFile({ type: 'image/heic' })).toBe('image')
    expect(kindOfFile({ type: 'audio/mpeg' })).toBe('audio')
    expect(kindOfFile({ type: 'video/mp4' })).toBeNull()
  })
})

describe('rejectReason', () => {
  it('lets a normal photo through', () => {
    expect(rejectReason({ type: 'image/jpeg', size: 3_000_000 })).toBeNull()
  })
  it('refuses other files and anything too big, in plain words', () => {
    expect(rejectReason({ type: 'application/pdf', size: 10 })).toBe('Photos and audio only.')
    expect(rejectReason({ type: 'audio/wav', size: MAX_OUTPUT_BYTES + 1 })).toMatch(/over 50MB/)
  })
})

describe('scaledSize', () => {
  it('never scales up', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
  it('shrinks the long edge and keeps the shape', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 2000, height: 1500 })
    expect(scaledSize(3000, 4000)).toEqual({ width: 1500, height: 2000 })
  })
})
