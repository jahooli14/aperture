import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { ToastProvider } from './components/ui/toast'
import { OfflineIndicator } from './components/OfflineIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FloatingNav } from './components/FloatingNav'
import { PWAInstallBanner } from './components/PWAInstallBanner'
import { PWAUpdateNotification } from './components/PWAUpdateNotification'
import { Loader2 } from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from './lib/platform'
import { supabase } from './lib/supabase'
import { useTheme } from './hooks/useTheme'
import { setupAutoSync } from './lib/syncManager'
import { useOfflineStore } from './stores/useOfflineStore'
import './App.css'

// Lazy load pages for better bundle splitting (code splitting enabled for all routes)
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const MemoriesPage = lazy(() => import('./pages/MemoriesPage').then(m => ({ default: m.MemoriesPage })))
const ReadingPage = lazy(() => import('./pages/ReadingPage').then(m => ({ default: m.ReadingPage })))
const ReaderPage = lazy(() => import('./pages/ReaderPage').then(m => ({ default: m.ReaderPage })))
const SuggestionsPage = lazy(() => import('./pages/SuggestionsPage').then(m => ({ default: m.SuggestionsPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })))
const DailyQueuePage = lazy(() => import('./pages/DailyQueuePage').then(m => ({ default: m.DailyQueuePage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const TimelinePage = lazy(() => import('./pages/TimelinePage').then(m => ({ default: m.TimelinePage })))
const ScrollTimelinePage = lazy(() => import('./pages/ScrollTimelinePage').then(m => ({ default: m.ScrollTimelinePage })))
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })))
const ConstellationView = lazy(() => import('./pages/ConstellationView'))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const RSSFeedsPage = lazy(() => import('./pages/RSSFeedsPage').then(m => ({ default: m.RSSFeedsPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })))

// Loading fallback component with skeleton
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
      <div className="w-full max-w-7xl px-4">
        <div className="shimmer h-12 w-64 mx-auto rounded-lg mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="premium-card p-6 space-y-4">
              <div className="shimmer h-6 w-3/4 rounded"></div>
              <div className="shimmer h-4 w-full rounded"></div>
              <div className="shimmer h-4 w-5/6 rounded"></div>
              <div className="flex gap-2">
                <div className="shimmer h-6 w-16 rounded-full"></div>
                <div className="shimmer h-6 w-20 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Navigation component removed - replaced with FloatingNav

export default function App() {
  // Apply theme on mount and when preferences change
  useTheme()

  // Setup online/offline tracking and auto-sync
  useEffect(() => {
    const { setOnlineStatus, setSyncResult, updateQueueSize } = useOfflineStore.getState()

    // Initial online status
    setOnlineStatus(navigator.onLine)
    updateQueueSize()

    // Track online/offline status
    const handleOnline = () => {
      console.log('[App] Connection restored')
      setOnlineStatus(true)
    }

    const handleOffline = () => {
      console.log('[App] Connection lost')
      setOnlineStatus(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Setup auto-sync when connection is restored
    setupAutoSync((result) => {
      console.log('[App] Sync complete:', result)
      setSyncResult(result)
      updateQueueSize()
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Configure status bar for native platforms
  useEffect(() => {
    if (!isNative()) return

    // Set status bar style to dark content (dark icons on light background)
    StatusBar.setStyle({ style: Style.Dark }).catch(console.error)
    StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(console.error)
  }, [])

  // Setup deep linking for Supabase OAuth on native platforms
  useEffect(() => {
    if (!isNative()) return

    let listenerHandle: any

    // Handle deep links for OAuth callbacks
    const setupListener = async () => {
      listenerHandle = await CapacitorApp.addListener('appUrlOpen', async (event) => {
        try {
          const url = new URL(event.url)

          // Check if this is a Supabase auth callback
          if (url.pathname.includes('/auth/callback') || url.hash.includes('access_token')) {
            console.log('Handling auth callback:', url.toString())

            // Extract tokens from URL hash (Supabase uses hash-based auth)
            const hashParams = new URLSearchParams(url.hash.substring(1))
            const access_token = hashParams.get('access_token')
            const refresh_token = hashParams.get('refresh_token')

            if (access_token && refresh_token) {
              await supabase.auth.setSession({
                access_token,
                refresh_token
              })
              console.log('✓ Auth session set successfully')
            }
          }
        } catch (error) {
          console.error('Error handling deep link:', error)
        }
      })
    }

    setupListener()

    return () => {
      if (listenerHandle) {
        listenerHandle.remove()
      }
    }
  }, [])

  return (
    <ToastProvider>
      <Router>
        <div className="min-h-screen flex flex-col">
          <OfflineIndicator />
          <PWAUpdateNotification />
          <PWAInstallBanner />

          {/* Safe area spacer for mobile status bar */}
          <div className="md:hidden" style={{ height: 'env(safe-area-inset-top)' }} />

          <main className="flex-1">
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/today" element={<DailyQueuePage />} />
                  <Route path="/memories" element={<MemoriesPage />} />
                  <Route path="/reading" element={<ReadingPage />} />
                  <Route path="/reading/:id" element={<ReaderPage />} />
                  <Route path="/suggestions" element={<SuggestionsPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/timeline" element={<TimelinePage />} />
                  <Route path="/knowledge-timeline" element={<ScrollTimelinePage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/constellation" element={<ConstellationView />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/rss" element={<RSSFeedsPage />} />
                  <Route path="/search" element={<SearchPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>

          {/* Floating Navigation */}
          <FloatingNav />
        </div>
      </Router>
    </ToastProvider>
  )
}
// Force redeploy Wed 29 Oct 2025 13:24:27 GMT
