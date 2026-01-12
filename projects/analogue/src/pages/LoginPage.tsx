import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Feather, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'

type AuthMode = 'signin' | 'signup' | 'magic'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink, isLoading, isConfigured } = useAuthStore()

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (mode === 'magic') {
      const result = await signInWithMagicLink(email)
      if (result.error) {
        setError(result.error)
      } else {
        setMessage('Check your email for a login link!')
      }
      return
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (mode === 'signin') {
      const result = await signInWithEmail(email, password)
      if (result.error) {
        setError(result.error)
      } else {
        navigate('/')
      }
    } else {
      const result = await signUpWithEmail(email, password)
      if (result.error) {
        if (result.error.includes('confirmation')) {
          setMessage(result.error)
        } else {
          setError(result.error)
        }
      } else {
        navigate('/')
      }
    }
  }

  if (!isConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Feather className="w-10 h-10 text-ink-400 mb-4" />
        <h1 className="text-lg font-medium text-ink-100 mb-2">Offline Mode</h1>
        <p className="text-sm text-ink-500 text-center mb-6">
          Cloud sync is not configured. Your data will only be stored locally on this device.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-section-departure rounded-lg text-white text-sm"
        >
          Continue Offline
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-6 pt-safe pb-safe">
      <button
        onClick={() => navigate('/')}
        className="self-start p-2 -ml-2 text-ink-400"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col items-center justify-center max-w-xs mx-auto w-full"
      >
        <Feather className="w-10 h-10 text-ink-400 mb-3" />
        <h1 className="text-xl font-bold text-ink-100 mb-1">Analogue</h1>
        <p className="text-ink-500 text-xs mb-8">Sync across devices</p>

        {/* Mode tabs */}
        <div className="flex w-full border-b border-ink-800 mb-6">
          <button
            onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
            className={`flex-1 py-2 text-sm border-b-2 transition-colors ${
              mode === 'signin'
                ? 'border-section-departure text-ink-100'
                : 'border-transparent text-ink-500'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
            className={`flex-1 py-2 text-sm border-b-2 transition-colors ${
              mode === 'signup'
                ? 'border-section-departure text-ink-100'
                : 'border-transparent text-ink-500'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs text-ink-500 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3 py-3 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 placeholder:text-ink-600"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password (not for magic link) */}
          {mode !== 'magic' && (
            <div>
              <label className="block text-xs text-ink-500 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-3 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 placeholder:text-ink-600"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Success message */}
          {message && (
            <p className="text-sm text-status-green">{message}</p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-section-departure rounded-lg text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'magic' ? (
              'Send Magic Link'
            ) : mode === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Magic link option */}
        {mode !== 'magic' && (
          <button
            onClick={() => { setMode('magic'); setError(null); setMessage(null) }}
            className="mt-4 text-xs text-ink-500 hover:text-ink-300"
          >
            Or sign in with a magic link (no password)
          </button>
        )}

        {mode === 'magic' && (
          <button
            onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
            className="mt-4 text-xs text-ink-500 hover:text-ink-300"
          >
            Back to password sign in
          </button>
        )}

        {/* Skip for now */}
        <button
          onClick={() => navigate('/')}
          className="mt-8 text-xs text-ink-600 hover:text-ink-400"
        >
          Continue without account (offline only)
        </button>
      </motion.div>
    </div>
  )
}
