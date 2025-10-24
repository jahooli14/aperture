import { motion } from 'framer-motion';
import { Smartphone, ExternalLink } from 'lucide-react';

export function OpenInAppPrompt() {
  const appUrl = window.location.origin;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-cyan-50 to-blue-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 rounded-full mb-4">
              <Smartphone className="w-8 h-8 text-cyan-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Logged In!</h2>
            <p className="text-gray-600">
              Now open the Pupils app to continue
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-cyan-900 mb-2">📱 Next Steps:</p>
              <ol className="text-sm text-cyan-800 space-y-2 list-decimal list-inside">
                <li>Go to your home screen</li>
                <li>Find the <strong>Pupils</strong> app icon</li>
                <li>Tap to open the app</li>
                <li>You'll be logged in automatically!</li>
              </ol>
            </div>

            {isIOS && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  💡 <strong>iOS Tip:</strong> If you haven't installed the app yet, visit {appUrl} in Safari, tap the Share button, then "Add to Home Screen"
                </p>
              </div>
            )}

            {isAndroid && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  💡 <strong>Android Tip:</strong> If you haven't installed the app yet, visit {appUrl} in Chrome, tap the menu, then "Install app" or "Add to Home screen"
                </p>
              </div>
            )}

            <button
              onClick={() => window.close()}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Close this tab
            </button>

            <p className="text-xs text-gray-500 text-center">
              You can safely close this browser tab and use the app
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
