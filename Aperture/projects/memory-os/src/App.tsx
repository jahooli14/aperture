import { useEffect } from 'react'
import { useMemoryStore } from './stores/useMemoryStore'
import { MemoryCard } from './components/MemoryCard'
import './App.css'

export default function App() {
  const { memories, loading, error, fetchMemories } = useMemoryStore()

  useEffect(() => {
    fetchMemories()
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧠 MemoryOS</h1>
        <p>Your personal knowledge graph</p>
      </header>

      <main className="app-main">
        {loading && <div className="loading">Loading memories...</div>}

        {error && <div className="error">Error: {error}</div>}

        {!loading && memories.length === 0 && (
          <div className="empty-state">
            <p>No memories yet.</p>
            <p>Record a voice note in Audiopen to get started.</p>
          </div>
        )}

        <div className="memory-grid">
          {memories.map(memory => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      </main>
    </div>
  )
}
