/**
 * Search Page
 * Universal search across memories, projects, and articles
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Brain, Layers, BookOpen, Loader2, ArrowRight, Lightbulb } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { haptic } from '../utils/haptics'
import { SubtleBackground } from '../components/SubtleBackground'
import { EmptyState } from '../components/ui/empty-state'
import { PremiumCard } from '../components/ui/premium-card'

interface SearchResult {
  type: 'memory' | 'project' | 'article' | 'suggestion'
  id: string
  title: string
  body?: string
  description?: string
  url?: string
  score: number
  created_at: string
  entities?: any
  tags?: string[]
  status?: string
}

interface SearchResponse {
  query: string
  total: number
  results: SearchResult[]
  breakdown: {
    memories: number
    projects: number
    articles: number
    suggestions: number
  }
}

export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResponse | null>(null)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q !== query) {
      setQuery(q)
      performSearch(q)
    }
  }, [searchParams])

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      addToast({
        title: 'Invalid search',
        description: 'Please enter at least 2 characters',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/memories?q=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data: SearchResponse = await response.json()
      setResults(data)
      haptic.light()
    } catch (error) {
      console.error('Search error:', error)
      addToast({
        title: 'Search failed',
        description: 'Failed to search content. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTextSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setSearchParams({ q: query.trim() })
      performSearch(query.trim())
    }
  }


  const navigateToResult = (result: SearchResult) => {
    haptic.light()
    switch (result.type) {
      case 'memory':
        navigate('/memories')
        addToast({
          title: 'Thought found',
          description: result.title,
          variant: 'default'
        })
        break
      case 'project':
        navigate(`/projects/${result.id}`)
        break
      case 'article':
        navigate(`/reading/${result.id}`)
        break
      case 'suggestion':
        navigate('/suggestions')
        addToast({
          title: 'Suggestion found',
          description: result.title,
          variant: 'default'
        })
        break
    }
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'memory':
        return <Brain className="h-5 w-5" style={{ color: 'var(--premium-indigo)' }} />
      case 'project':
        return <Layers className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
      case 'article':
        return <BookOpen className="h-5 w-5" style={{ color: 'var(--premium-emerald)' }} />
      case 'suggestion':
        return <Lightbulb className="h-5 w-5" style={{ color: 'var(--premium-amber)' }} />
    }
  }

  const getResultBadgeColor = (type: string) => {
    switch (type) {
      case 'memory':
        return 'rgba(99, 102, 241, 0.15)'
      case 'project':
        return 'rgba(59, 130, 246, 0.15)'
      case 'article':
        return 'rgba(16, 185, 129, 0.15)'
      case 'suggestion':
        return 'rgba(251, 191, 36, 0.15)'
      default:
        return 'rgba(255, 255, 255, 0.05)'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      {/* Subtle Background Effect */}
      <SubtleBackground />

      {/* Fixed Header Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(15, 24, 41, 0.7)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="h-7 w-7" style={{ color: 'var(--premium-blue)', opacity: 0.7 }} />
            <h1 className="text-2xl sm:text-3xl" style={{
              fontWeight: 600,
              letterSpacing: 'var(--premium-tracking-tight)',
              color: 'var(--premium-text-secondary)',
              opacity: 0.7
            }}>
              Search
            </h1>
          </div>
        </div>
      </div>

      <div className="min-h-screen pb-24" style={{ paddingTop: '5.5rem' }}>
        {/* Header Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
              Search <span style={{ color: 'var(--premium-blue)' }}>everything</span>
            </h2>
            <p className="mt-2 text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
              Find memories, projects, articles, and suggestions instantly
            </p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Search Input */}
          <div className="p-6 rounded-xl backdrop-blur-xl mb-8" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <form onSubmit={handleTextSearch} className="flex gap-3">
              <div className="flex-1 relative">
                <Search
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5"
                  style={{ color: 'var(--premium-text-tertiary)' }}
                />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your knowledge..."
                  className="w-full h-12 pl-12 pr-4 rounded-xl border text-base"
                  style={{
                    background: 'var(--premium-bg-3)',
                    borderColor: 'rgba(59, 130, 246, 0.2)',
                    color: 'var(--premium-text-primary)'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="h-12 px-6 rounded-xl font-medium transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                  color: 'white'
                }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
              </button>
            </form>
          </div>

          {/* Results */}
          {loading && (
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--premium-bg-2)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div className="text-center py-20">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
                <p style={{ color: 'var(--premium-text-secondary)' }}>Searching...</p>
              </div>
            </div>
          )}

          {!loading && results && (
            <>
              {/* Results Summary */}
              <div className="p-6 rounded-xl backdrop-blur-xl mb-6" style={{
                background: 'var(--premium-bg-2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
              }}>
                <h2 className="text-xl font-semibold mb-2 premium-text-platinum">
                  {results.total} {results.total === 1 ? 'result' : 'results'} for "{results.query}"
                </h2>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                  <span>{results.breakdown.memories} memories</span>
                  <span>•</span>
                  <span>{results.breakdown.projects} projects</span>
                  <span>•</span>
                  <span>{results.breakdown.articles} articles</span>
                  {results.breakdown.suggestions > 0 && (
                    <>
                      <span>•</span>
                      <span>{results.breakdown.suggestions} suggestions</span>
                    </>
                  )}
                </div>
              </div>

              {/* Results List */}
              {results.results.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description="Try a different search term or use voice search"
                />
              ) : (
                <div className="space-y-3">
                  {results.results.map((result, index) => (
                    <motion.div
                      key={`${result.type}-${result.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => navigateToResult(result)}
                      className="p-5 rounded-xl backdrop-blur-xl cursor-pointer transition-all duration-300 group"
                      style={{
                        background: 'var(--premium-bg-2)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--premium-bg-3)'
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--premium-bg-2)'
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Type Badge */}
                        <div className="flex items-center gap-2 mb-2">
                          {getResultIcon(result.type)}
                          <span
                            className="text-xs font-medium px-2 py-1 rounded-full capitalize"
                            style={{ backgroundColor: getResultBadgeColor(result.type) }}
                          >
                            {result.type}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-semibold mb-1 line-clamp-1 premium-text-platinum">
                          {result.title}
                        </h3>

                        {/* Description */}
                        {(result.body || result.description) && (
                          <p className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--premium-text-secondary)' }}>
                            {result.body || result.description}
                          </p>
                        )}

                        {/* Tags */}
                        {result.tags && result.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {result.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: 'var(--premium-blue)'
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Arrow Icon */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                      </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !results && query && (
            <EmptyState
              icon={Search}
              title="Ready to search"
              description="Enter a search term or use voice search to get started"
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}
