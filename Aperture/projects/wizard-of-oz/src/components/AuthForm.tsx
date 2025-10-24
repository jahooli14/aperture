import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/useAuthStore';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const signIn = useAuthStore((state) => state.signIn);

  // Check if user is in PWA mode
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-600 mb-4">
          We sent a magic link to <strong>{email}</strong>
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-left">
          <p className="text-blue-800 font-semibold mb-2">
            📱 Important for PWA users:
          </p>
          <ol className="text-blue-700 space-y-1 text-xs list-decimal list-inside">
            <li>Click the magic link in your email</li>
            <li>It will open in Safari (not the PWA)</li>
            <li>Complete login and join code entry in Safari</li>
            <li>Then you can close Safari and use the PWA</li>
          </ol>
          <p className="text-blue-600 text-xs mt-2 italic">
            Note: Safari and PWA don't share sessions on iOS. Use Safari for the initial setup.
          </p>
        </div>
      </motion.div>
    );
  }

  // Show warning if user is in PWA but not logged in (iOS only)
  if (isPWA && isIOS && !sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Pupils</h1>
          <p className="text-gray-600">Watch your baby grow, day by day</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-amber-900 mb-2">⚠️ PWA Login Issue</p>
            <p className="text-sm text-amber-800 mb-3">
              You're using the PWA app, but magic links won't work here on iOS.
            </p>
            <p className="text-xs text-amber-700">
              To fix this, you need to login in Safari first, then reinstall the app:
            </p>
            <ol className="text-xs text-amber-700 mt-2 space-y-1 list-decimal list-inside">
              <li>Delete this app from your home screen</li>
              <li>Open Safari and go to aperture-production.vercel.app</li>
              <li>Login with your email there</li>
              <li>Then tap "Add to Home Screen" while logged in</li>
            </ol>
          </div>

          <a
            href="https://aperture-production.vercel.app"
            className="block w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg transition-colors text-center"
          >
            Open in Safari Instead
          </a>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Pupils</h1>
        <p className="text-gray-600">Watch your baby grow, day by day</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send magic link'}
        </button>
      </form>
    </motion.div>
  );
}
