import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { ToastProvider } from './components/ui/toast'
import { OfflineIndicator } from './components/OfflineIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'
import { cn } from './lib/utils'
import { Sparkles, Home, Brain, BookOpen, Rocket, Calendar, TrendingUp, Loader2 } from 'lucide-react'
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
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })))

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
    </div>
  )
}

function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  const navLinks = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/memories', label: 'Thoughts', icon: Brain },
    { path: '/projects', label: 'Projects', icon: Rocket },
    { path: '/reading', label: 'Reading', icon: BookOpen },
    { path: '/insights', label: 'Insights', icon: TrendingUp }
  ]

  return (
    <>
      {/* Top bar - Desktop only, shows branding */}
      <nav className="hidden md:block sticky top-0 z-50 glass-panel border-b border-neutral-200">
        <div style={{ height: 'env(safe-area-inset-top)' }} className="bg-inherit" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2.5 group transition-smooth">
              <Sparkles className="h-5 w-5 text-orange-600" />
              <span className="text-xl font-semibold tracking-tight text-neutral-900">
                Polymath
              </span>
            </Link>

            <div className="flex gap-1">
              {navLinks.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    "relative px-4 py-2 rounded-lg text-sm font-medium transition-smooth whitespace-nowrap flex items-center gap-2",
                    isActive(path)
                      ? "text-orange-600 bg-orange-50"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom navigation - Mobile only (Android pattern) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200">
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className="grid grid-cols-5">
          {navLinks.map(({ path, label, icon: Icon }) => {
            const active = isActive(path)
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 py-3 px-2 transition-all duration-200 min-h-[68px]",
                  "active:scale-95 touch-manipulation select-none",
                  active ? "text-orange-600" : "text-neutral-600"
                )}
              >
                <Icon className={cn(
                  "h-6 w-6 transition-all flex-shrink-0",
                  active && "stroke-[2.5] scale-110"
                )} />
                <span className={cn(
                  "text-xs font-medium transition-all leading-none",
                  active ? "font-semibold" : ""
                )}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

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
          <Navigation />

          {/* Safe area spacer for mobile status bar */}
          <div className="md:hidden" style={{ height: 'env(safe-area-inset-top)' }} />

          <main className="flex-1 pb-20 md:pb-0">
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
                  <Route path="/insights" element={<InsightsPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>

          <footer className="hidden md:block backdrop-blur-2xl bg-white/40 border-t border-white/20 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium gradient-text">
                  Personal knowledge graph + meta-creative synthesis
                </p>
                <p className="text-xs text-gray-500">
                  Capture thoughts, generate projects, explore creativity
                </p>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </ToastProvider>
  )
}
