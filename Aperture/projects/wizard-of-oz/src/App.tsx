import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/useAuthStore';
import { AuthForm } from './components/AuthForm';
import { UploadPhoto } from './components/UploadPhoto';
import { PhotoGallery } from './components/PhotoGallery';
import { CalendarView } from './components/CalendarView';

type ViewType = 'gallery' | 'calendar';

function App() {
  const { user, loading, initialize, signOut } = useAuthStore();
  const [view, setView] = useState<ViewType>('gallery');

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wizard of Oz</h1>
              <p className="text-sm text-gray-600">Your baby's growth journey</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* View Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView('gallery')}
              className={`
                px-6 py-2 rounded-md text-sm font-medium transition-colors
                ${view === 'gallery'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              📸 Gallery
            </button>
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={`
                px-6 py-2 rounded-md text-sm font-medium transition-colors
                ${view === 'calendar'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              📅 Calendar
            </button>
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
            {/* Upload Section - always visible */}
            <UploadPhoto />

            {/* View-specific content */}
            {view === 'gallery' ? <PhotoGallery /> : <CalendarView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-600">
          <p>Capturing precious moments, one day at a time ✨</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
