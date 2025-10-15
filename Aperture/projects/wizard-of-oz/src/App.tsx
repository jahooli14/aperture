import { useEffect, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useAuthStore } from './stores/useAuthStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { AuthForm } from './components/AuthForm';
import { UploadPhoto } from './components/UploadPhoto';
import { PhotoGallery } from './components/PhotoGallery';
import { Onboarding } from './components/Onboarding';
import { PasscodeLock } from './components/PasscodeLock';
import { PrivacySettings } from './components/PrivacySettings';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

// Lazy load heavy components
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const ComparisonView = lazy(() => import('./components/ComparisonView').then(m => ({ default: m.ComparisonView })));

type ViewType = 'gallery' | 'calendar' | 'compare';

const ONBOARDING_KEY = 'wizard-of-oz-onboarding-completed';
const PASSCODE_KEY = 'wizard-passcode';

function App() {
  const { user, loading, initialize, signOut } = useAuthStore();
  const { fetchSettings } = useSettingsStore();
  const [view, setView] = useState<ViewType>('gallery');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [passcode, setPasscode] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

  // Check for passcode on mount
  useEffect(() => {
    if (user) {
      const savedPasscode = localStorage.getItem(PASSCODE_KEY);
      if (savedPasscode) {
        setPasscode(savedPasscode);
        setIsLocked(true);
      }
    }
  }, [user]);

  // Check if user has completed onboarding & fetch settings
  useEffect(() => {
    if (user) {
      const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY);
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true);
      }

      // Fetch user settings
      fetchSettings();
    }
  }, [user, fetchSettings]);

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  // Check if online
  useEffect(() => {
    const handleOnline = () => showToast('Back online!', 'success');
    const handleOffline = () => showToast('You are offline. Some features may not work.', 'error');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AuthForm />
      </div>
    );
  }

  // Show passcode lock
  if (isLocked && passcode) {
    return (
      <PasscodeLock
        expectedPasscode={passcode}
        onUnlock={() => setIsLocked(false)}
      />
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Wizard of Oz</h1>
              <p className="text-xs md:text-sm text-gray-600 hidden sm:block">Your baby's growth journey</p>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={() => setShowSettings(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Privacy settings"
              >
                <Settings className="w-5 h-5" />
              </motion.button>
              <button
                type="button"
                onClick={signOut}
                className="text-sm text-gray-600 active:text-gray-900 md:hover:text-gray-900 transition-colors min-h-[44px] px-3 touch-manipulation"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* View Toggle */}
        <div className="flex justify-center mb-6 md:mb-8">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 w-full max-w-lg md:w-auto shadow-sm">
            <motion.button
              type="button"
              onClick={() => setView('gallery')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={`
                flex-1 md:flex-none px-3 md:px-5 py-3 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation
                ${view === 'gallery'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              📸 Gallery
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setView('calendar')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={`
                flex-1 md:flex-none px-3 md:px-5 py-3 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation
                ${view === 'calendar'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              📅 Calendar
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setView('compare')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={`
                flex-1 md:flex-none px-3 md:px-5 py-3 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation
                ${view === 'compare'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              ↔️ Compare
            </motion.button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Upload Section - only visible on gallery view */}
            {view === 'gallery' && <UploadPhoto showToast={showToast} />}

            {/* View-specific content with loading fallback */}
            <Suspense fallback={
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            }>
              {view === 'gallery' && <PhotoGallery showToast={showToast} />}
              {view === 'calendar' && <CalendarView />}
              {view === 'compare' && <ComparisonView />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-600">
          <p>Capturing precious moments, one day at a time ✨</p>
        </div>
      </footer>

      {/* Privacy Settings Modal */}
      {showSettings && (
        <PrivacySettings onClose={() => setShowSettings(false)} />
      )}

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        actionLabel={toast.actionLabel}
        onAction={toast.onAction}
      />
    </div>
  );
}

export default App;
