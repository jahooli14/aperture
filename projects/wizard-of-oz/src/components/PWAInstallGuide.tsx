import { motion } from 'framer-motion';
import { Smartphone, Share, Plus } from 'lucide-react';

interface PWAInstallGuideProps {
  onDismiss: () => void;
}

export function PWAInstallGuide({ onDismiss }: PWAInstallGuideProps) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (!isIOS) {
    // Android PWA install is handled by browser automatically
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 rounded-full mb-4">
              <Smartphone className="w-8 h-8 text-cyan-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Install Pupils as an App</h2>
            <p className="text-gray-600">
              Get the full app experience on your home screen
            </p>
          </div>

          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-cyan-900 mb-3">📱 How to install:</p>
            <ol className="text-sm text-cyan-800 space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-cyan-200 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div className="flex-1">
                  <p className="font-medium">Tap the Share button</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Share className="w-4 h-4" />
                    <span className="text-xs">(at the bottom of Safari)</span>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-cyan-200 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div className="flex-1">
                  <p className="font-medium">Scroll and tap "Add to Home Screen"</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Plus className="w-4 h-4" />
                    <span className="text-xs">(may need to scroll down)</span>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-cyan-200 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div className="flex-1">
                  <p className="font-medium">Tap "Add" in the top right</p>
                  <span className="text-xs">Done! The Pupils icon will appear on your home screen</span>
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-800">
              💡 <strong>Important:</strong> Install from Safari while you're logged in. This ensures the app works properly!
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Got it!
          </button>
        </div>
      </motion.div>
    </div>
  );
}
