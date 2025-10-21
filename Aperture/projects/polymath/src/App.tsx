import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { MemoriesPage } from './pages/MemoriesPage'
import { SuggestionsPage } from './pages/SuggestionsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ToastProvider } from './components/ui/toast'
import { cn } from './lib/utils'
import { Sparkles } from 'lucide-react'
import './App.css'

function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-white/40 border-b border-white/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link
            to="/"
            className="flex items-center gap-3 text-2xl font-bold group"
          >
            <div className="relative">
              <Sparkles className="h-8 w-8 text-purple-600 group-hover:text-pink-600 transition-all duration-300 group-hover:rotate-12" />
              <div className="absolute inset-0 bg-purple-600/20 blur-xl group-hover:bg-pink-600/20 transition-all duration-300" />
            </div>
            <span className="gradient-text text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600">
              Polymath
            </span>
          </Link>

          <div className="flex gap-8">
            {[
              { path: '/memories', label: 'Memories' },
              { path: '/suggestions', label: 'Suggestions' },
              { path: '/projects', label: 'Projects' }
            ].map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  "relative font-semibold transition-all duration-300 group",
                  isActive(path)
                    ? "text-purple-600"
                    : "text-gray-600 hover:text-purple-600"
                )}
              >
                {label}
                <span
                  className={cn(
                    "absolute -bottom-6 left-0 h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 transition-all duration-300 rounded-full",
                    isActive(path) ? "w-full" : "w-0 group-hover:w-full"
                  )}
                />
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
