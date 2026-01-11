import { Routes, Route, Navigate } from 'react-router-dom'
import { useManuscriptStore } from './stores/useManuscriptStore'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import TableOfContents from './pages/TableOfContents'
import SensoryAuditPage from './pages/SensoryAuditPage'
import ReverberationPage from './pages/ReverberationPage'
import RevealAuditPage from './pages/RevealAuditPage'

export default function App() {
  const { manuscript } = useManuscriptStore()

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/toc"
          element={manuscript ? <TableOfContents /> : <Navigate to="/" replace />}
        />
        <Route
          path="/edit/:sceneId"
          element={manuscript ? <EditorPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/sensory"
          element={manuscript ? <SensoryAuditPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/reverberations"
          element={manuscript ? <ReverberationPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/reveal"
          element={manuscript ? <RevealAuditPage /> : <Navigate to="/" replace />}
        />
      </Routes>
    </div>
  )
}
