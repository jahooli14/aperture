/**
 * The move, where the work is.
 *
 * Once Ableton or the sketchbook is open you don't go back to an app to
 * check a list. So while a session runs on Android, the move you're on
 * sits in a persistent notification with two buttons -- Done and I'm
 * stuck -- so the phone can stay face-down. Tapping the note itself opens
 * the app on the running session. Gone the moment the session stops.
 *
 * Native only, and silent: it's a sticky note, not an alert.
 */

import { useEffect } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '../lib/platform'

/** Fixed, so an update replaces the note in place rather than stacking. */
const SESSION_NOTIFICATION_ID = 7201
const ACTION_TYPE = 'SESSION_MOVE'

/** What a notification button asks the running session to do. */
export type SessionAction = 'done' | 'stuck'
export const SESSION_ACTION_EVENT = 'aperture:session-action'

/** Called by the session store whenever a session ends, so the note
 *  can't outlive it even if the session screen was never mounted. */
export function clearSessionNotification(): void {
  if (!isNative()) return
  LocalNotifications.cancel({ notifications: [{ id: SESSION_NOTIFICATION_ID }] }).catch(() => {})
}

let registered = false
async function registerActions() {
  if (registered) return
  registered = true
  try {
    await LocalNotifications.registerActionTypes({
      types: [{
        id: ACTION_TYPE,
        actions: [
          { id: 'done', title: 'Done' },
          { id: 'stuck', title: 'I’m stuck', foreground: true },
        ],
      }],
    })
    // The buttons reach the running session as a window event, so whatever
    // screen owns the session (home or the project page) can act on it.
    await LocalNotifications.addListener('localNotificationActionPerformed', action => {
      if (action.notification.id !== SESSION_NOTIFICATION_ID) return
      if (action.actionId === 'done' || action.actionId === 'stuck') {
        window.dispatchEvent(new CustomEvent<SessionAction>(SESSION_ACTION_EVENT, { detail: action.actionId }))
      }
    })
  } catch (e) {
    registered = false
    console.warn('[session] could not set up notification buttons:', e)
  }
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
        await registerActions()
        await LocalNotifications.schedule({
          notifications: [{
            id: SESSION_NOTIFICATION_ID,
            title: projectTitle,
            body: step ?? 'All done. Stop whenever you like.',
            ongoing: true,
            autoCancel: false,
            silent: true,
            actionTypeId: step ? ACTION_TYPE : undefined,
            extra: { path: '/' },
          }],
        })
      } catch (e) {
        console.warn('[session] could not show the session notification:', e)
      }
    })()
  }, [running, projectTitle, step])
}
