import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

export function UpdateNotification() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: any) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error: any) {
      console.error('SW registration error:', error);
    },
  });

  const handleUpdate = async () => {
    await updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
        >
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Update Available
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    A new version of Pupils is ready. Update now for the latest features and improvements.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      className="flex-1 bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700 active:bg-cyan-800 transition-colors min-h-[44px] touch-manipulation"
                    >
                      Update Now
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="px-3 text-gray-600 hover:text-gray-900 active:text-gray-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                      aria-label="Dismiss update notification"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
