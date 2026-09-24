/**
 * The move, where the work is.
 *
 * Once Ableton or the sketchbook is open you don't go back to an app to
 * check a list. So while a session runs on Android, the step you're on
 * sits in a persistent notification: one glance at the shade, no
 * unlocking into the app. Tapping it opens the app, where the running
 * session is waiting. Gone the moment the session stops.
 *
 * Native only, and silent: it's a sticky note, not an alert.
 */

import { useEffect } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '../lib/platform'

/** Fixed, so an update replaces the note in place rather than stacking. */
const SESSION_NOTIFICATION_ID = 7201

/** Called by the session store whenever a session ends, so the note
 *  can't outlive it even if the session screen was never mounted. */
export function clearSessionNotification(): void {
  if (!isNative()) return
  LocalNotifications.cancel({ notifications: [{ id: SESSION_NOTIFICATION_ID }] }).catch(() => {})
}

export function useSessionNotification(
  running: boolean,
  projectTitle: string,
  step: string | null,
) {
  useEffect(() => {
    if (!isNative()) return
    if (!running) {
      clearSessionNotification()
      return
    }
    ;(async () => {
      try {
        const permission = await LocalNotifications.checkPermissions()
        if (permission.display !== 'granted') return
        await LocalNotifications.schedule({
          notifications: [{
            id: SESSION_NOTIFICATION_ID,
            title: projectTitle,
            body: step ?? 'All ticked. Stop whenever you like.',
            ongoing: true,
            autoCancel: false,
            silent: true,
            extra: { path: '/' },
          }],
        })
      } catch (e) {
        console.warn('[session] could not show the session notification:', e)
      }
    })()
  }, [running, projectTitle, step])
}
