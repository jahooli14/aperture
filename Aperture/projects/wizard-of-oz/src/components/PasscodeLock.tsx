import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertCircle } from 'lucide-react';

interface PasscodeLockProps {
  onUnlock: () => void;
  expectedPasscode: string;
}

export function PasscodeLock({ onUnlock, expectedPasscode }: PasscodeLockProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === expectedPasscode) {
      onUnlock();
    } else {
      setError(true);
      setPasscode('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl"
      >
        {/* Lock Icon */}
        <motion.div
          animate={error ? { x: [0, -10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-6"
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
            error ? 'bg-red-100' : 'bg-primary-100'
          }`}>
            <Lock className={`w-10 h-10 ${error ? 'text-red-600' : 'text-primary-600'}`} />
          </div>
        </motion.div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Enter Passcode
        </h2>
        <p className="text-gray-600 text-center mb-6">
          Enter your passcode to unlock the app
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className={`w-full px-4 py-3 text-center text-2xl tracking-widest border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                error
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-primary-500 focus:ring-primary-200'
              }`}
              placeholder="••••"
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-red-600 text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Incorrect passcode</span>
            </motion.div>
          )}

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md"
          >
            Unlock
          </motion.button>
        </form>

        {/* Helper Text */}
        <p className="text-xs text-gray-500 text-center mt-6">
          Passcode is stored locally on your device
        </p>
      </motion.div>
    </div>
  );
}
