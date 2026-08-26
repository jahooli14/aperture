import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

/**
 * Sign in with a six-digit code rather than a magic link.
 *
 * Relay shares its Supabase project with Pupils, and email templates are
 * per-project: that one sends a code, not a link. Codes also save a trip out
 * to the mail app and back, and phones offer to autofill them.
 */
export default function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (!loading && session) return <Navigate to={from} replace />

  async function requestCode(address: string) {
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    })
    if (sendError) throw new Error(sendError.message)
  }

  async function onSendCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestCode(email.trim())
      setStage('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code')
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })

    setBusy(false)
    if (verifyError) {
      setError(
        /expired/i.test(verifyError.message)
          ? 'That code has expired. Send a new one.'
          : "That code didn't work. Check it and try again."
      )
    }
    // On success the auth listener picks up the session and this page
    // redirects itself via the <Navigate> above.
  }

  async function onResend() {
    setBusy(true)
    setError(null)
    try {
      await requestCode(email.trim())
      setResent(true)
      setTimeout(() => setResent(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send another code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center px-6 py-12">
      <div className="mb-10">
        <h1 className="font-story text-4xl">Relay</h1>
        <p className="mt-2 text-muted">Write a story with your friends, a line at a time.</p>
      </div>

      {stage === 'email' ? (
        <form onSubmit={onSendCode} className="surface p-5">
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
          <p className="mt-2 text-xs text-muted">No password. We email you a six-digit code.</p>
          {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="surface p-5">
          <label className="label" htmlFor="code">
            Your code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            // Deliberately looser than six: the browser truncates on this
            // before onChange runs, so a code pasted with a space in it
            // would silently lose its last digit. onChange does the real
            // work — strip anything that isn't a digit, then take six.
            maxLength={12}
            required
            autoFocus
            className="field text-center font-mono text-2xl tracking-[0.4em]"
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <p className="mt-2 text-xs text-muted">
            Sent to {email}. The email is headed &ldquo;Your Login Code&rdquo; — it comes from the
            same place as Pupils.
          </p>
          {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={busy || code.length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              className="text-muted underline hover:text-ink"
              onClick={() => {
                setStage('email')
                setCode('')
                setError(null)
              }}
            >
              Use a different email
            </button>
            <button
              type="button"
              className="text-muted underline hover:text-ink disabled:opacity-50"
              disabled={busy}
              onClick={onResend}
            >
              {resent ? 'Sent' : 'Send another'}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
