import { describe, it, expect } from 'vitest'
import { isCaptureLaunch, requestCapture, takePendingCapture } from './launchCapture'

describe('isCaptureLaunch', () => {
  it('knows every way in', () => {
    expect(isCaptureLaunch('polymath://capture')).toBe(true)
    expect(isCaptureLaunch('https://aper-ture.vercel.app/?capture=voice')).toBe(true)
    expect(isCaptureLaunch('?capture=voice')).toBe(true)
  })
  it('ignores everything else', () => {
    expect(isCaptureLaunch('polymath://share?url=x')).toBe(false)
    expect(isCaptureLaunch('https://aper-ture.vercel.app/memories')).toBe(false)
    expect(isCaptureLaunch('?capture=text')).toBe(false)
    expect(isCaptureLaunch('')).toBe(false)
  })
})

describe('pending capture', () => {
  it('is taken once', () => {
    requestCapture()
    expect(takePendingCapture()).toBe(true)
    expect(takePendingCapture()).toBe(false)
  })
})
