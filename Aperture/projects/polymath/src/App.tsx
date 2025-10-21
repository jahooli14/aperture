import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { MemoriesPage } from './pages/MemoriesPage'
import { SuggestionsPage } from './pages/SuggestionsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ToastProvider } from './components/ui/toast'
import { cn } from './lib/utils'
import './App.css'

function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="text-xl font-bold text-foreground hover:text-primary transition-colors"
          >
            🎨 Polymath
          </Link>

          <div className="flex gap-6">
            <Link
              to="/memories"
              className={cn(
                "font-medium transition-colors",
                isActive('/memories')
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Memories
            </Link>
            <Link
              to="/suggestions"
              className={cn(
                "font-medium transition-colors",
                isActive('/suggestions')
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Suggestions
            </Link>
            <Link
              to="/projects"
              className={cn(
                "font-medium transition-colors",
                isActive('/projects')
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Projects
            </Link>
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
        <div className="min-h-screen flex flex-col bg-background">
          <Navigation />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/memories" element={<MemoriesPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
            </Routes>
          </main>

          <footer className="bg-background border-t py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-muted-foreground">
                Personal knowledge graph + meta-creative synthesis • Capture memories, generate projects
              </p>
            </div>
          </footer>
        </div>
      </Router>
    </ToastProvider>
  )
}
