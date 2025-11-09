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
          title: 'Memory found',
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
      className="min-h-screen py-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Search className="h-12 w-12" style={{ color: 'var(--premium-blue)' }} />
          </div>
          <h1 className="text-4xl font-bold mb-3 premium-text-platinum">
            Search Everything
          </h1>
          <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
            Find memories, projects, articles, and suggestions instantly
          </p>
        </div>

        {/* Search Input */}
        <div className="space-y-4">
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
                className="w-full h-12 pl-12 pr-4 rounded-xl border premium-glass text-base"
                style={{
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
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading && (
          <div className="text-center py-20">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
            <p style={{ color: 'var(--premium-text-secondary)' }}>Searching...</p>
          </div>
        )}

        {!loading && results && (
          <>
            {/* Results Summary */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
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
              <div className="premium-card p-20 text-center">
                <Search className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                  No results found
                </h3>
                <p style={{ color: 'var(--premium-text-secondary)' }}>
                  Try a different search term or use voice search
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.results.map((result, index) => (
                  <motion.div
                    key={`${result.type}-${result.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigateToResult(result)}
                    className="premium-card p-5 cursor-pointer hover:border-blue-500/50 transition-all group"
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
                        <h3 className="text-lg font-semibold mb-1 line-clamp-1" style={{ color: 'var(--premium-text-primary)' }}>
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
          <div className="premium-card p-20 text-center">
            <Search className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--premium-text-tertiary)' }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
              Ready to search
            </h3>
            <p style={{ color: 'var(--premium-text-secondary)' }}>
              Enter a search term or use voice search to get started
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
