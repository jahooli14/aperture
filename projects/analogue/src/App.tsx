import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import TableOfContents from './pages/TableOfContents'
import SensoryAuditPage from './pages/SensoryAuditPage'
import ReverberationPage from './pages/ReverberationPage'
import RevealAuditPage from './pages/RevealAuditPage'
import LoginPage from './pages/LoginPage'
import { useAuthStore } from './stores/useAuthStore'

export default function App() {
  const initialize = useAuthStore(state => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/toc" element={<TableOfContents />} />
        <Route path="/edit/:sceneId" element={<EditorPage />} />
        <Route path="/sensory" element={<SensoryAuditPage />} />
        <Route path="/reverberations" element={<ReverberationPage />} />
        <Route path="/reveal" element={<RevealAuditPage />} />
      </Routes>
    </div>
  )
}
