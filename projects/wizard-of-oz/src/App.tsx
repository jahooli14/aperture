import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useAuthStore } from './stores/useAuthStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { usePhotoStore } from './stores/usePhotoStore';
import { AuthForm } from './components/AuthForm';
import { UploadPhoto } from './components/UploadPhoto';
import { PhotoGallery } from './components/PhotoGallery';
import { Onboarding } from './components/Onboarding';
import { PasscodeLock } from './components/PasscodeLock';
import { PrivacySettings } from './components/PrivacySettings';
import { JoinCodePrompt } from './components/JoinCodePrompt';
import { PWAInstallGuide } from './components/PWAInstallGuide';
import { MilestoneBanner } from './components/MilestoneBanner';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { UpdateNotification } from './components/UpdateNotification';

// Lazy load heavy components
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const ComparisonView = lazy(() => import('./components/ComparisonView').then(m => ({ default: m.ComparisonView })));
const MilestonesView = lazy(() => import('./components/MilestonesView').then(m => ({ default: m.MilestonesView })));
const PlacesView = lazy(() => import('./components/PlacesView').then(m => ({ default: m.default })));

type ViewType = 'gallery' | 'calendar' | 'compare' | 'milestones' | 'places';

const PASSCODE_KEY = 'wizard-passcode';

function App() {
  const { user, loading, initialize, signOut } = useAuthStore();
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const { fetchPhotos } = usePhotoStore();
  const [view, setView] = useState<ViewType>('calendar');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showJoinCodePrompt, setShowJoinCodePrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPWAGuide, setShowPWAGuide] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const loadingRef = useRef(loading);
  const unlockedThisSession = useRef(false); // Track if user unlocked passcode this session
  const tabScrollRef = useRef<HTMLDivElement>(null); // Ref to scroll active tab into view
  const { toast, showToast, hideToast } = useToast();

  // Keep ref in sync with loading state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Scroll active tab into view when view changes
  useEffect(() => {
    if (tabScrollRef.current) {
      const activeButton = tabScrollRef.current.querySelector('[data-active="true"]');
      if (activeButton) {
        activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [view]);

  // Check for passcode on mount - but only lock if not already unlocked this session
  useEffect(() => {
    if (user) {
      const savedPasscode = localStorage.getItem(PASSCODE_KEY);
      if (savedPasscode) {
        setPasscode(savedPasscode);
        // Only lock if user hasn't unlocked in this session
        if (!unlockedThisSession.current) {
          setIsLocked(true);
        }
      } else {
        // No passcode set, ensure not locked
        setIsLocked(false);
        setPasscode(null);
      }
    } else {
      // User logged out, reset lock state
      setIsLocked(false);
      setPasscode(null);
      unlockedThisSession.current = false;
    }
  }, [user]);

  // Fetch settings when user is authenticated
  useEffect(() => {
    if (user) {
      console.log('[App] User authenticated, fetching settings...', user.id);
      fetchSettings();
    }
  }, [user, fetchSettings]);

  // Check if user has completed onboarding & join code prompt & fetch photos
  useEffect(() => {
    console.log('[App] Settings effect - user:', !!user, 'settings:', !!settings);
    if (user && settings) {
      console.log('[App] User and settings loaded, settings:', {
        join_code_prompted: settings.join_code_prompted,
        onboarding_completed: settings.onboarding_completed
      });
      if (!settings.join_code_prompted) {
        setShowJoinCodePrompt(true);
      } else if (!settings.onboarding_completed) {
        setShowOnboarding(true);
      }

      // Fetch photos once on login
      console.log('[App] Fetching photos...');
      fetchPhotos();
    }
  }, [user, settings, fetchPhotos]);

  const handleJoinCodeComplete = async () => {
    // Always dismiss the prompt first so user isn't stuck
    setShowJoinCodePrompt(false);

    // Show onboarding if they haven't completed it
    if (settings && !settings.onboarding_completed) {
      setShowOnboarding(true);
    }

    // Try to save the setting (but don't block dismissal on failure)
    try {
      await updateSettings({ join_code_prompted: true });
    } catch (error) {
      console.error('Failed to update join code prompt:', error);
      // Don't show error toast - user can proceed, they may just see the prompt again next time
    }
  };

  const handleOnboardingComplete = async () => {
    // Always dismiss the onboarding first so user isn't stuck
    setShowOnboarding(false);

    // Try to save the setting (but don't block dismissal on failure)
    try {
      await updateSettings({ onboarding_completed: true });
    } catch (error) {
      console.error('Failed to update onboarding:', error);
      // Don't show error toast - user can proceed, they may just see onboarding again next time
    }
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
    console.log('[App] Initializing auth - Version 2.0 with loading fix');
    initialize();
  }, [initialize]);

  // Separate effect for safety timeout - only runs once on mount
  useEffect(() => {
    // Safety timeout - if loading takes more than 8 seconds, show recovery option
    const safetyTimer = setTimeout(() => {
      if (loadingRef.current) {
        setLoadingTooLong(true);
      }
    }, 8000);

    // Nuclear option - if still loading after 30 seconds, force clear app cache (preserve auth) and reload
    const nuclearTimer = setTimeout(() => {
      if (loadingRef.current) {
        console.error('[App] Force reloading after 30 seconds of loading');
        try {
          // Clear app-specific localStorage but PRESERVE auth session
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !key.startsWith('sb-') && !key.includes('supabase') && !key.includes('auth')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          sessionStorage.clear();
        } catch (e) {
          console.error('[App] Failed to clear storage:', e);
        }
        window.location.reload();
      }
    }, 30000);

    return () => {
      clearTimeout(safetyTimer);
      clearTimeout(nuclearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  if (loading) {
    const handleClearCache = () => {
      try {
        // Clear app-specific localStorage but PRESERVE auth session
        // This prevents users from being logged out when clearing cache
        const authKeys: string[] = [];
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            // Preserve Supabase auth keys
            if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
              authKeys.push(key);
            } else {
              keysToRemove.push(key);
            }
          }
        }

        // Only remove non-auth keys
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('[App] Cleared cache, preserved auth keys:', authKeys);

        // Clear sessionStorage (doesn't contain auth)
        sessionStorage.clear();

        // Reload the page
        window.location.reload();
      } catch (error) {
        console.error('Failed to clear cache:', error);
        alert('Failed to clear cache. Please try clearing your browser data manually.');
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 mb-4">Loading...</p>

          {loadingTooLong && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                Loading is taking longer than usual. This might be due to a network issue or cached data.
              </p>
              <button
                onClick={handleClearCache}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors"
              >
                Clear Cache & Reload
              </button>
            </div>
          )}
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
        onUnlock={() => {
          setIsLocked(false);
          unlockedThisSession.current = true; // Mark as unlocked for this session
        }}
      />
    );
  }

  // Show join code prompt for new users
  if (showJoinCodePrompt) {
    return <JoinCodePrompt onComplete={handleJoinCodeComplete} />;
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3">
              <img src="/pupils-logo.svg" alt="Pupils" className="h-8 w-8 md:h-10 md:w-10" />
              <h1 className="text-2xl font-bold text-gray-900">Pupils</h1>
            </div>
            <div className="flex items-center gap-1 md:gap-3">
              <motion.button
                type="button"
                onClick={() => setShowSettings(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </motion.button>
              <button
                type="button"
                onClick={signOut}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors min-h-[44px] px-3 touch-manipulation rounded-lg hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Milestone Banner - hide on milestones and places views */}
        {view !== 'milestones' && view !== 'places' && <MilestoneBanner />}

        {/* View Toggle */}
        <div className="flex justify-center mb-6 md:mb-8">
          <div ref={tabScrollRef} className="overflow-x-auto">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm gap-1">
              <motion.button
              type="button"
              onClick={() => setView('gallery')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              data-active={view === 'gallery'}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation whitespace-nowrap flex items-center justify-center
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
              onClick={() => setView('places')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              data-active={view === 'places'}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation whitespace-nowrap flex items-center justify-center
                ${view === 'places'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              📍 Places
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setView('milestones')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              data-active={view === 'milestones'}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation whitespace-nowrap flex items-center justify-center
                ${view === 'milestones'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              🌱 Milestones
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setView('calendar')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              data-active={view === 'calendar'}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation whitespace-nowrap flex items-center justify-center
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
              data-active={view === 'compare'}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] touch-manipulation whitespace-nowrap flex items-center justify-center
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
              {view === 'calendar' && <CalendarView onUploadClick={() => setView('gallery')} />}
              {view === 'compare' && <ComparisonView />}
              {view === 'milestones' && <MilestonesView />}
              {view === 'places' && <PlacesView />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Install PWA Banner for iOS Safari users */}
      {(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true;
        const dismissed = localStorage.getItem('pwa-install-banner-dismissed');

        if (isIOS && !isPWA && !dismissed) {
          return (
            <div className="fixed bottom-0 left-0 right-0 bg-cyan-600 text-white p-4 shadow-lg z-40">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold">📱 Install Pupils as an app</p>
                  <p className="text-xs opacity-90">Get the full app experience on your home screen</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('pwa-install-banner-dismissed', 'true');
                      window.location.reload();
                    }}
                    className="text-xs text-white/80 hover:text-white px-2"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => setShowPWAGuide(true)}
                    className="bg-white text-cyan-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cyan-50"
                  >
                    Show me how
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-600">
          <p>Capturing precious moments, one day at a time ✨</p>
        </div>
      </footer>

      {/* Privacy Settings Modal */}
      {showSettings && (
        <PrivacySettings onClose={() => setShowSettings(false)} />
      )}

      {/* PWA Install Guide */}
      {showPWAGuide && (
        <PWAInstallGuide onDismiss={() => setShowPWAGuide(false)} />
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

      {/* PWA Update Notification */}
      <UpdateNotification />
    </div>
  );
}

export default App;
