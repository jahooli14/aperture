/**
 * Suggestions Page
 * Shows AI-generated project suggestions with rating actions
 */

import { useEffect } from 'react'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { SuggestionCard } from '../components/suggestions/SuggestionCard'

export function SuggestionsPage() {
  const {
    suggestions,
    loading,
    error,
    filter,
    sortBy,
    fetchSuggestions,
    rateSuggestion,
    buildSuggestion,
    setFilter,
    setSortBy
  } = useSuggestionStore()

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const handleRate = async (id: string, rating: number) => {
    await rateSuggestion(id, rating)
  }

  const handleBuild = async (id: string) => {
    if (confirm('Build this project? This will create a new project and boost related capabilities.')) {
      await buildSuggestion(id)
    }
  }

  const handleViewDetail = (id: string) => {
    // TODO: Open modal or navigate to detail page
    console.log('View detail:', id)
  }

  return (
    <div className="suggestions-page">
      <header className="page-header">
        <h1>Project Suggestions</h1>
        <p className="subtitle">AI-generated ideas combining your capabilities and interests</p>
      </header>

      <div className="controls">
        <div className="filters">
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            New
          </button>
          <button
            className={filter === 'spark' ? 'active' : ''}
            onClick={() => setFilter('spark')}
          >
            ⚡ Sparks
          </button>
          <button
            className={filter === 'saved' ? 'active' : ''}
            onClick={() => setFilter('saved')}
          >
            💾 Saved
          </button>
          <button
            className={filter === 'built' ? 'active' : ''}
            onClick={() => setFilter('built')}
          >
            ✅ Built
          </button>
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>

        <div className="sort">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="points">Points</option>
            <option value="recent">Recent</option>
            <option value="rating">Rating</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <p>Loading suggestions...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="empty-state">
          <h3>No suggestions yet</h3>
          <p>Run the synthesis script to generate project ideas:</p>
          <code>npx tsx scripts/polymath/synthesis.ts</code>
          <p>Or seed test data:</p>
          <code>npx tsx scripts/polymath/seed-test-data.ts</code>
        </div>
      ) : (
        <div className="suggestions-grid">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onRate={handleRate}
              onBuild={handleBuild}
              onViewDetail={handleViewDetail}
            />
          ))}
        </div>
      )}

      <style>{`
        .suggestions-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0;
          font-size: 2rem;
          color: #1a1a1a;
        }

        .subtitle {
          margin: 0.5rem 0 0 0;
          color: #666;
        }

        .controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .filters {
          display: flex;
          gap: 0.5rem;
        }

        .filters button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filters button:hover {
          background: #f5f5f5;
        }

        .filters button.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .sort {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sort select {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
        }

        .error-banner {
          padding: 1rem;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 6px;
          color: #c00;
          margin-bottom: 1rem;
        }

        .loading {
          text-align: center;
          padding: 4rem;
          color: #666;
        }

        .empty-state {
          text-align: center;
          padding: 4rem;
          color: #666;
        }

        .empty-state h3 {
          margin: 0 0 1rem 0;
          color: #333;
        }

        .empty-state code {
          display: block;
          margin: 0.5rem auto;
          padding: 0.5rem 1rem;
          background: #f5f5f5;
          border-radius: 4px;
          font-family: monospace;
          max-width: 400px;
        }

        .suggestions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 1.5rem;
        }

        @media (max-width: 768px) {
          .suggestions-grid {
            grid-template-columns: 1fr;
          }

          .controls {
            flex-direction: column;
            align-items: stretch;
          }

          .filters {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  )
}
