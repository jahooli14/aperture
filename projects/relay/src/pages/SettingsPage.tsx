import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { NotificationToggle } from '../components/NotificationToggle'
import { useAuth } from '../lib/useAuth'
import { api } from '../lib/api'

export default function SettingsPage() {
  const { profile, setProfile, signOut, session } = useAuth()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) setName(profile.display_name)
  }, [profile])

  async function save() {
    setStatus('saving')
    setError(null)
    try {
      const { profile: saved } = await api.rename(name)
      setProfile(saved)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that')
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-dvh">
      <PageHeader title="Settings" back="/" />
      <main className="mx-auto max-w-reading space-y-4 px-4 py-5">
        <section className="surface p-5">
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="field"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted">This is what your friends see next to your lines.</p>
          {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button
            className="btn-primary mt-4"
            onClick={save}
            disabled={status === 'saving' || !name.trim() || name === profile?.display_name}
          >
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save'}
          </button>
        </section>

        <section className="surface p-5">
          <NotificationToggle />
        </section>

        <section className="surface p-5">
          <p className="text-sm text-muted">Signed in as {session?.user?.email}</p>
          <button className="btn-quiet mt-3" onClick={signOut}>
            Sign out
          </button>
        </section>
      </main>
    </div>
  )
}
