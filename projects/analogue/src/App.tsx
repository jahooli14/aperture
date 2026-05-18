import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ManuscriptPage from './pages/ManuscriptPage'
import EditorPage from './pages/EditorPage'
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
        <Route path="/m" element={<ManuscriptPage />} />
        <Route path="/edit/:sceneId" element={<EditorPage />} />
      </Routes>
    </div>
  )
}
