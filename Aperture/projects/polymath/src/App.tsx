import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { MemoriesPage } from './pages/MemoriesPage'
import { SuggestionsPage } from './pages/SuggestionsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { DailyQueuePage } from './pages/DailyQueuePage'
import { ToastProvider } from './components/ui/toast'
import { cn } from './lib/utils'
import { Sparkles } from 'lucide-react'
import './App.css'

function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="flex items-center gap-2.5 group transition-smooth"
          >
            <Sparkles className="h-5 w-5 text-orange-600" />
            <span className="text-xl font-semibold tracking-tight text-neutral-900">
              Polymath
            </span>
          </Link>

          <div className="flex gap-1">
            {[
              { path: '/today', label: 'Today' },
              { path: '/memories', label: 'Memories' },
              { path: '/suggestions', label: 'Suggestions' },
              { path: '/projects', label: 'Projects' }
            ].map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  "relative px-4 py-2 rounded-lg text-sm font-medium transition-smooth",
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
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <div className="min-h-screen flex flex-col">
          <Navigation />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/today" element={<DailyQueuePage />} />
              <Route path="/memories" element={<MemoriesPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
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
