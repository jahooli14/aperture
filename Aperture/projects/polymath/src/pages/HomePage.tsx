/**
 * Home Page
 * Landing page with overview and quick stats
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useProjectStore } from '../stores/useProjectStore'

export function HomePage() {
  const { suggestions, fetchSuggestions } = useSuggestionStore()
  const { projects, fetchProjects } = useProjectStore()

  useEffect(() => {
    fetchSuggestions()
    fetchProjects()
  }, [])

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
  const sparkSuggestions = suggestions.filter(s => s.status === 'spark')
  const activeProjects = projects.filter(p => p.status === 'active')

  return (
    <div className="home-page">
      <header className="hero">
        <h1>🎨 Polymath</h1>
        <p className="tagline">Your meta-creative synthesis engine</p>
        <p className="description">
          Generates novel project ideas by combining your capabilities with your interests
        </p>
      </header>

      <div className="stats-grid">
        <Link to="/suggestions" className="stat-card">
          <div className="stat-value">{pendingSuggestions.length}</div>
          <div className="stat-label">New Suggestions</div>
          <div className="stat-hint">Ready to rate →</div>
        </Link>

        <Link to="/suggestions?filter=spark" className="stat-card spark">
          <div className="stat-value">{sparkSuggestions.length}</div>
          <div className="stat-label">⚡ Sparks</div>
          <div className="stat-hint">Ideas you liked →</div>
        </Link>

        <Link to="/projects" className="stat-card">
          <div className="stat-value">{activeProjects.length}</div>
          <div className="stat-label">Active Projects</div>
          <div className="stat-hint">Currently working on →</div>
        </Link>

        <Link to="/projects?filter=all" className="stat-card">
          <div className="stat-value">{projects.length}</div>
          <div className="stat-label">Total Projects</div>
          <div className="stat-hint">All time →</div>
        </Link>
      </div>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>📝 Capture Interests</h3>
              <p>Voice notes reveal recurring themes and topics you care about</p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>🔍 Scan Capabilities</h3>
              <p>System scans your codebase to find technical skills you have</p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>🤖 AI Synthesis</h3>
              <p>Generates novel project ideas at the intersection</p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>⚡ Rate & Build</h3>
              <p>Spark ideas you like, build them, system learns</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <Link to="/suggestions" className="primary-button">
          View Suggestions →
        </Link>
        <Link to="/projects" className="secondary-button">
          View Projects
        </Link>
      </section>

      <style>{`
        .home-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .hero {
          text-align: center;
          padding: 3rem 0;
        }

        .hero h1 {
          margin: 0;
          font-size: 3rem;
          color: #1a1a1a;
        }

        .tagline {
          margin: 1rem 0 0.5rem 0;
          font-size: 1.5rem;
          color: #666;
        }

        .description {
          margin: 0;
          color: #888;
          max-width: 600px;
          margin: 0 auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin: 3rem 0;
        }

        .stat-card {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .stat-card.spark {
          background: linear-gradient(135deg, #fff9e6 0%, white 50%);
        }

        .stat-value {
          font-size: 3rem;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 1rem;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .stat-hint {
          font-size: 0.875rem;
          color: #2563eb;
        }

        .how-it-works {
          margin: 4rem 0;
        }

        .how-it-works h2 {
          text-align: center;
          font-size: 2rem;
          margin-bottom: 2rem;
          color: #1a1a1a;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
        }

        .step {
          display: flex;
          gap: 1rem;
        }

        .step-number {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          background: #2563eb;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .step-content h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.125rem;
          color: #1a1a1a;
        }

        .step-content p {
          margin: 0;
          color: #666;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .cta {
          text-align: center;
          margin: 4rem 0;
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .primary-button,
        .secondary-button {
          padding: 1rem 2rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s;
          display: inline-block;
        }

        .primary-button {
          background: #2563eb;
          color: white;
        }

        .primary-button:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .secondary-button {
          background: white;
          color: #2563eb;
          border: 2px solid #2563eb;
        }

        .secondary-button:hover {
          background: #eff6ff;
        }

        @media (max-width: 768px) {
          .hero h1 {
            font-size: 2rem;
          }

          .tagline {
            font-size: 1.25rem;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .steps {
            grid-template-columns: 1fr;
          }

          .cta {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
