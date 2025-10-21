import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { SuggestionsPage } from './pages/SuggestionsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import './App.css'

export default function App() {
  return (
    <Router>
      <div className="app">
        <nav className="app-nav">
          <Link to="/" className="nav-brand">
            🎨 Polymath
          </Link>
          <div className="nav-links">
            <Link to="/suggestions" className="nav-link">
              Suggestions
            </Link>
            <Link to="/projects" className="nav-link">
              Projects
            </Link>
          </div>
        </nav>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/suggestions" element={<SuggestionsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>Meta-creative synthesis engine • Generates novel project ideas</p>
        </footer>

        <style>{`
          .app {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background: #fafafa;
          }

          .app-nav {
            background: white;
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
          }

          .nav-brand {
            font-size: 1.5rem;
            font-weight: bold;
            text-decoration: none;
            color: #1a1a1a;
          }

          .nav-links {
            display: flex;
            gap: 2rem;
          }

          .nav-link {
            text-decoration: none;
            color: #666;
            font-weight: 500;
            transition: color 0.2s;
          }

          .nav-link:hover {
            color: #2563eb;
          }

          .app-main {
            flex: 1;
          }

          .app-footer {
            background: white;
            border-top: 1px solid #e5e7eb;
            padding: 2rem;
            text-align: center;
            color: #666;
            font-size: 0.875rem;
          }

          .app-footer p {
            margin: 0;
          }

          @media (max-width: 768px) {
            .app-nav {
              flex-direction: column;
              gap: 1rem;
            }

            .nav-links {
              width: 100%;
              justify-content: center;
            }
          }
        `}</style>
      </div>
    </Router>
  )
}
