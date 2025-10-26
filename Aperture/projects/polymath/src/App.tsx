import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { HomePage } from './pages/HomePage'
import { MemoriesPage } from './pages/MemoriesPage'
import { ReadingPage } from './pages/ReadingPage'
import { ReaderPage } from './pages/ReaderPage'
import { SuggestionsPage } from './pages/SuggestionsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { DailyQueuePage } from './pages/DailyQueuePage'
import { OnboardingPage } from './pages/OnboardingPage'
import { TimelinePage } from './pages/TimelinePage'
import { InsightsPage } from './pages/InsightsPage'
import { ToastProvider } from './components/ui/toast'
import { OfflineIndicator } from './components/OfflineIndicator'
import { cn } from './lib/utils'
import { Sparkles, Menu, X } from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from './lib/platform'
import { supabase } from './lib/supabase'
import './App.css'

function Navigation() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const navLinks = [
    { path: '/today', label: 'Today' },
    { path: '/memories', label: 'Memories' },
    { path: '/reading', label: 'Reading' },
    { path: '/projects', label: 'Projects' },
    { path: '/timeline', label: 'Timeline' },
    { path: '/insights', label: 'Insights' }
  ]

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-neutral-200" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="flex items-center gap-2.5 group transition-smooth"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Sparkles className="h-5 w-5 text-orange-600" />
            <span className="text-xl font-semibold tracking-tight text-neutral-900">
              Polymath
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-1">
            {navLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  "relative px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-smooth whitespace-nowrap",
                  isActive(path)
                    ? "text-orange-600 bg-orange-50"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200">
            <div className="flex flex-col gap-2">
              {navLinks.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-3 rounded-lg text-base font-medium transition-smooth",
                    isActive(path)
                      ? "text-orange-600 bg-orange-50"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default function App() {
  // Configure status bar for native platforms
  useEffect(() => {
    if (!isNative()) return

    // Set status bar style to light content with transparent background
    StatusBar.setStyle({ style: Style.Light }).catch(console.error)
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

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/today" element={<DailyQueuePage />} />
              <Route path="/memories" element={<MemoriesPage />} />
              <Route path="/reading" element={<ReadingPage />} />
              <Route path="/reading/:id" element={<ReaderPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/insights" element={<InsightsPage />} />
            </Routes>
          </main>

          <footer className="backdrop-blur-2xl bg-white/40 border-t border-white/20 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium gradient-text">
                  Personal knowledge graph + meta-creative synthesis
                </p>
                <p className="text-xs text-gray-500">
                  Capture memories, generate projects, explore creativity
                </p>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </ToastProvider>
  )
}
