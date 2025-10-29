import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { ToastProvider } from './components/ui/toast'
import { OfflineIndicator } from './components/OfflineIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FloatingNav } from './components/FloatingNav'
import { Loader2 } from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from './lib/platform'
import { supabase } from './lib/supabase'
import './App.css'

// Lazy load pages for better bundle splitting
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
const KnowledgeTimelinePage = lazy(() => import('./pages/KnowledgeTimelinePage').then(m => ({ default: m.KnowledgeTimelinePage })))
const ScrollTimelinePage = lazy(() => import('./pages/ScrollTimelinePage').then(m => ({ default: m.ScrollTimelinePage })))
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })))
const ConstellationView = lazy(() => import('./pages/ConstellationView'))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
    </div>
  )
}

// Navigation component removed - replaced with FloatingNav

export default function App() {
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
