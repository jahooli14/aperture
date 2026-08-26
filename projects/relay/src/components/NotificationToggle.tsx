import { useEffect, useState } from 'react'
import {
  disablePush,
  enablePush,
  isPushSupported,
  isSubscribed,
  needsHomeScreenInstall,
  sendTestPush,
} from '../lib/push'

/**
 * The most important control in the app. If this doesn't work people drift
 * back to WhatsApp, so it says exactly what's wrong rather than failing quietly.
 */
export function NotificationToggle() {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [tested, setTested] = useState(false)

  useEffect(() => {
    isSubscribed()
      .then(setOn)
      .finally(() => setChecked(true))
  }, [])

  if (!isPushSupported()) {
    return (
      <p className="text-sm text-muted">
        This browser can't do notifications. Try Chrome, Safari or Firefox.
      </p>
    )
  }

  if (needsHomeScreenInstall()) {
    return (
      <div className="text-sm text-muted">
        <p className="font-medium text-ink">Add Relay to your home screen first</p>
        <p className="mt-1">
          Tap Share, then Add to Home Screen. iPhone only sends notifications to apps that live
          there. Open Relay from the icon and this switch will work.
        </p>
      </div>
    )
  }

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (on) {
        await disablePush()
        setOn(false)
      } else {
        await enablePush()
        setOn(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Notify me when it's my turn</p>
          <p className="text-sm text-muted">On this device.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Notify me when it's my turn"
          disabled={busy || !checked}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            on ? 'bg-accent' : 'bg-rule'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-all ${
              on ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>
      {on && (
        <button
          type="button"
          className="btn-quiet mt-3 w-full"
          disabled={busy}
          onClick={async () => {
            setError(null)
            try {
              await sendTestPush()
              setTested(true)
              setTimeout(() => setTested(false), 4000)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not send a test')
            }
          }}
        >
          {tested ? 'Sent — check your lock screen' : 'Send a test notification'}
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  )
}
