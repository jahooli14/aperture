/**
 * Projects Page
 * Shows active/dormant/completed projects
 */

import { useEffect } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/projects/ProjectCard'

export function ProjectsPage() {
  const {
    projects,
    loading,
    error,
    filter,
    fetchProjects,
    setFilter
  } = useProjectStore()

  useEffect(() => {
    fetchProjects()
  }, [])

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'active': return '🚀'
      case 'dormant': return '💤'
      case 'completed': return '✅'
      case 'archived': return '📦'
      default: return ''
    }
  }

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'personal': return '👤'
      case 'technical': return '⚙️'
      case 'meta': return '🧠'
      default: return ''
    }
  }

  return (
    <div className="projects-page">
      <header className="page-header">
        <h1>My Projects</h1>
        <p className="subtitle">Track your creative work and strengthen capabilities</p>
      </header>

      <div className="controls">
        <div className="filters">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            🚀 Active
          </button>
          <button
            className={filter === 'dormant' ? 'active' : ''}
            onClick={() => setFilter('dormant')}
          >
            💤 Dormant
          </button>
          <button
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            ✅ Completed
          </button>
        </div>

        <div className="stats">
          <span className="stat">
            <strong>{projects.length}</strong> project{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <p>Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects yet</h3>
          <p>Build a project from a suggestion to get started!</p>
          <p>Or add one manually via the API</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
      )}

      <style>{`
        .projects-page {
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

        .stats {
          color: #666;
        }

        .stat {
          padding: 0.5rem 1rem;
          background: #f5f5f5;
          border-radius: 6px;
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

        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        @media (max-width: 768px) {
          .projects-grid {
            grid-template-columns: 1fr;
          }

          .controls {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}
