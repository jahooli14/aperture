/**
 * Open straight into recording from outside the app.
 *
 * Three ways in, one outcome — the voice recorder already running:
 *   - the home-screen icon's long-press shortcut (PWA manifest → `/?capture=voice`)
 *   - the Android app's shortcut and home-screen widget (`polymath://capture`)
 *   - any link to `/?capture=voice`
 *
 * A launch can arrive before anything that can record has mounted (a cold
 * start, or before sign-in finishes), so the request is held here until
 * FloatingNav — which owns the recorder — takes it.
 */

export const CAPTURE_PARAM = 'capture'
export const CAPTURE_EVENT = 'launch-capture'

let pending = false

/** Is this a launch that should start recording? */
export function isCaptureLaunch(url: string): boolean {
  try {
    const u = new URL(url, 'https://x.invalid')
    if (u.protocol === 'polymath:') {
      // polymath://capture parses with the host as "capture" in browsers
      // that know the scheme, and as a path in ones that don't.
      return u.host === 'capture' || u.pathname.replace(/^\/+/, '') === 'capture'
    }
    return u.searchParams.get(CAPTURE_PARAM) === 'voice'
  } catch {
    return false
  }
}

/** Ask for a recording. Taken now if the recorder is listening, else later. */
export function requestCapture(): void {
  pending = true
  window.dispatchEvent(new Event(CAPTURE_EVENT))
}

/** Take the pending request, if any. True at most once per request. */
export function takePendingCapture(): boolean {
  const was = pending
  pending = false
  return was
}
