import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Feather, Mail, Loader2, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'

type Step = 'email' | 'code'

export default function LoginPage() {
  const navigate = useNavigate()
  const { sendOtp, verifyOtp, isLoading, isConfigured } = useAuthStore()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email')
      return
    }

    setIsSending(true)
    const result = await sendOtp(email)
    setIsSending(false)

    if (result.error) {
      setError(result.error)
    } else {
      setStep('code')
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!code.trim() || code.length < 6) {
      setError('Enter the 6-digit code')
      return
    }

    const result = await verifyOtp(email, code)

    if (result.error) {
      setError(result.error)
    } else {
      navigate('/')
    }
  }

  if (!isConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Feather className="w-10 h-10 text-ink-400 mb-4" />
        <h1 className="text-lg font-medium text-ink-100 mb-2">Offline Mode</h1>
        <p className="text-sm text-ink-500 text-center mb-6">
          Cloud sync is not configured.
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
        onClick={() => step === 'code' ? setStep('email') : navigate('/')}
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
        <p className="text-ink-500 text-xs mb-8">
          {step === 'email' ? 'Sign in to sync' : 'Enter the code from your email'}
        </p>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="w-full space-y-4">
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
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3 bg-section-departure rounded-lg text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Send Code'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="w-full space-y-4">
            <div>
              <label className="block text-xs text-ink-500 mb-1">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-3 py-3 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 text-center text-2xl tracking-widest placeholder:text-ink-600"
                autoFocus
              />
              <p className="text-xs text-ink-500 mt-2 text-center">
                Sent to {email}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || code.length < 6}
              className="w-full py-3 bg-section-departure rounded-lg text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Verify'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(null) }}
              className="w-full text-xs text-ink-500"
            >
              Use a different email
            </button>
          </form>
        )}

        <button
          onClick={() => navigate('/')}
          className="mt-8 text-xs text-ink-600 hover:text-ink-400"
        >
          Continue without account
        </button>
      </motion.div>
    </div>
  )
}
