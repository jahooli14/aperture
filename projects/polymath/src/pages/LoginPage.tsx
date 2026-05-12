import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../contexts/AuthContext'

type Step = 'initial' | 'otp-sent' | 'success'

// Whitelist of paths we'll honour in `?next=` to avoid open-redirect bugs.
// Add to this list as more flows need a post-login bounce target.
const SAFE_NEXT_PATHS = new Set<string>(['/onboarding'])

function safeNextFrom(searchParams: URLSearchParams): string {
  const raw = searchParams.get('next')
  if (!raw) return '/'
  // Same-origin only, no protocol/host. Strip query/hash too.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  const path = raw.split(/[?#]/)[0]
  return SAFE_NEXT_PATHS.has(path) ? path : '/'
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNextFrom(searchParams)
  const { isAuthenticated, loading: authLoading } = useAuthContext()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('initial')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If the user is already signed in, don't let them sit on /login — that's
  // how you accidentally re-trigger OAuth and end up with a stale state. Bounce
  // them to their intended destination (or home) as soon as auth resolves.
  useEffect(() => {
    if (!authLoading && isAuthenticated && step !== 'success') {
      navigate(next, { replace: true })
    }
  }, [authLoading, isAuthenticated, next, navigate, step])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Bounce back to wherever we were trying to go (whitelisted), not
        // always /. Lets the onboarding gate hand the user back to the
        // chat after sign-in.
        redirectTo: `${window.location.origin}${next}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) {
      setError(error.message)
    } else {
      setStep('otp-sent')
    }
    setLoading(false)
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email',
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setStep('success')
      setTimeout(() => navigate(next), 1200)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 relative overflow-hidden"
      style={{ backgroundColor: 'var(--brand-bg)' }}
    >
      {/* Soft cyan wash — Dia leaning. One ambient layer, no orbs. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(var(--brand-primary-rgb), 0.10), transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        {/* Brand mark — quiet, not hero */}
        <div className="mb-10 text-center">
          <h1
            className="aperture-header text-xl"
            style={{
              color: 'rgb(var(--brand-primary-rgb))',
              opacity: 0.9,
              letterSpacing: '-0.02em',
            }}
          >
            aperture
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {step === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <CheckCircle className="h-10 w-10" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
              <p
                className="text-2xl"
                style={{
                  fontFamily: 'var(--brand-font-serif)',
                  fontWeight: 500,
                  color: 'var(--brand-text-primary)',
                  letterSpacing: '-0.018em',
                }}
              >
                Welcome in.
              </p>
            </motion.div>
          ) : step === 'otp-sent' ? (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2
                className="mb-3"
                style={{
                  fontFamily: 'var(--brand-font-serif)',
                  fontWeight: 500,
                  fontSize: '2rem',
                  letterSpacing: '-0.022em',
                  color: 'var(--brand-text-primary)',
                  lineHeight: 1.1,
                }}
              >
                Check your email.
              </h2>
              <p
                className="mb-8 text-[15px] leading-relaxed italic"
                style={{ fontFamily: 'var(--brand-font-serif)', color: 'var(--brand-text-secondary)' }}
              >
                We sent a code to <span style={{ color: 'rgb(var(--brand-primary-rgb))', fontStyle: 'normal' }}>{email}</span>.
              </p>
              <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-5 py-4 rounded-2xl text-center text-xl tracking-[0.4em] outline-none transition-all min-h-[56px]"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--brand-text-primary)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontFamily: 'var(--brand-font-body)',
                    fontWeight: 500,
                    caretColor: 'rgb(var(--brand-primary-rgb))',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(var(--brand-primary-rgb),0.4)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-400 text-center italic">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-[15px] font-medium transition-all disabled:opacity-40 active:scale-[0.99]"
                  style={{
                    background: 'rgb(var(--brand-primary-rgb))',
                    color: 'var(--brand-bg)',
                    boxShadow: '0 8px 24px -8px rgba(var(--brand-primary-rgb), 0.5)',
                  }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>Verify <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('initial'); setOtp(''); setError(null) }}
                  className="text-xs text-center opacity-55 hover:opacity-90 transition-opacity italic"
                  style={{ fontFamily: 'var(--brand-font-serif)', color: 'var(--brand-text-secondary)' }}
                >
                  use a different email
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="initial"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2
                className="mb-3"
                style={{
                  fontFamily: 'var(--brand-font-serif)',
                  fontWeight: 500,
                  fontSize: '2.25rem',
                  letterSpacing: '-0.022em',
                  color: 'var(--brand-text-primary)',
                  lineHeight: 1.05,
                }}
              >
                Welcome back.
              </h2>
              <p
                className="mb-9 text-[15px] leading-relaxed italic"
                style={{ fontFamily: 'var(--brand-font-serif)', color: 'var(--brand-text-secondary)' }}
              >
                Pick up where you left off.
              </p>

              {/* Email OTP — primary path */}
              <form onSubmit={handleEmailOTP} className="flex flex-col gap-3 mb-5">
                <div
                  className="flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <Mail className="h-4 w-4 flex-shrink-0 opacity-50" />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-[15px]"
                    style={{
                      color: 'var(--brand-text-primary)',
                      caretColor: 'rgb(var(--brand-primary-rgb))',
                    }}
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-400 italic">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-[15px] font-medium transition-all disabled:opacity-40 active:scale-[0.99]"
                  style={{
                    background: 'rgb(var(--brand-primary-rgb))',
                    color: 'var(--brand-bg)',
                    boxShadow: '0 8px 24px -8px rgba(var(--brand-primary-rgb), 0.5)',
                  }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>Send sign-in code <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span
                  className="text-[10px] uppercase tracking-[0.32em]"
                  style={{ color: 'var(--brand-text-muted)', opacity: 0.55 }}
                >
                  or
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Google — secondary, lower weight */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl text-[14px] font-medium transition-all hover:bg-white/[0.04] disabled:opacity-40"
                style={{
                  background: 'transparent',
                  color: 'var(--brand-text-secondary)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
