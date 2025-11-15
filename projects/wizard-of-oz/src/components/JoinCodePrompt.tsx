import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { usePhotoStore } from '../stores/usePhotoStore';

interface JoinCodePromptProps {
  onComplete: () => void;
}

export function JoinCodePrompt({ onComplete }: JoinCodePromptProps) {
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const { joinWithCode } = useSettingsStore();
  const { fetchPhotos } = usePhotoStore();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setError('');

    try {
      await joinWithCode(joinCode.trim());
      // Refresh photos to show shared photos
      await fetchPhotos();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join with code');
      setJoining(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <Users className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Join a Shared Album?</h2>
            <p className="text-gray-600">
              If your partner shared an invite code, enter it below to access shared photos
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700 mb-2">
                6-Digit Invite Code
              </label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-wider font-mono"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={joining || joinCode.length !== 6}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {joining ? 'Joining...' : (
                <>
                  Join Album
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-gray-600 hover:text-gray-900 py-2 text-sm font-medium transition-colors"
            >
              Skip for now
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              You can also generate your own invite code in Privacy Settings to share with your partner
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
