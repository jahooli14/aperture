import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

export default function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (!loading && session) return <Navigate to={from} replace />

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)

    const redirect = `${window.location.origin}${from}`
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect },
    })

    setSending(false)
    if (sendError) setError(sendError.message)
    else setSent(true)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center px-6 py-12">
      <div className="mb-10">
        <h1 className="font-story text-4xl">Relay</h1>
        <p className="mt-2 text-muted">Write a story with your friends, a line at a time.</p>
      </div>

      {sent ? (
        <div className="surface p-5">
          <h2 className="font-story text-xl">Check your email</h2>
          <p className="mt-2 text-sm text-muted">
            We sent a link to {email}. Open it on the phone you want to write on.
          </p>
          <button className="btn-quiet mt-4" onClick={() => setSent(false)}>
            Use a different address
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="surface p-5">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="field"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted">
            No password. We email you a link that signs you in.
          </p>
          {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={sending}>
            {sending ? 'Sending…' : 'Send me a link'}
          </button>
        </form>
      )}
    </main>
  )
}
