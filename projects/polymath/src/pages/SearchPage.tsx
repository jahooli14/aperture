import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Brain, Layers, BookOpen, Loader2, ArrowRight, Lightbulb, Mic } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { haptic } from '../utils/haptics'
import { SubtleBackground } from '../components/SubtleBackground'
import { EmptyState } from '../components/ui/empty-state'
import { PremiumCard } from '../components/ui/premium-card'
import { VoiceSearch } from '../components/VoiceSearch'
import { readingDb } from '../lib/db'
import { useOfflineStore } from '../stores/useOfflineStore'
import { handleInputFocus } from '../utils/keyboard'

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

// Helper function for offline search
async function searchOffline(searchQuery: string): Promise<SearchResponse> {
  const lowerCaseQuery = searchQuery.toLowerCase()
  const now = new Date().toISOString()

  let memories = await readingDb.memories.toArray()
  let projects = await readingDb.projects.toArray()
  let articles = await readingDb.articles.toArray()
  // No offline suggestions for now

  const filteredMemories = memories
    .filter(m => m.title.toLowerCase().includes(lowerCaseQuery) || m.body.toLowerCase().includes(lowerCaseQuery))
    .map(m => ({
      type: 'memory' as const,
      id: m.id,
      title: m.title,
      body: m.body,
      score: 1, // Placeholder
      created_at: m.created_at || now,
    }))

  const filteredProjects = projects
    .filter(p => p.title.toLowerCase().includes(lowerCaseQuery) || (p.description && p.description.toLowerCase().includes(lowerCaseQuery)))
    .map(p => ({
      type: 'project' as const,
      id: p.id,
      title: p.title,
      description: p.description || '',
      score: 1, // Placeholder
      created_at: p.created_at || now,
    }))

  const filteredArticles = articles
    .filter(a => a.title.toLowerCase().includes(lowerCaseQuery) || (a.content && a.content.toLowerCase().includes(lowerCaseQuery)) || (a.excerpt && a.excerpt.toLowerCase().includes(lowerCaseQuery)))
    .map(a => ({
      type: 'article' as const,
      id: a.id,
      title: a.title,
      body: a.content || a.excerpt || '',
      url: a.url,
      score: 1, // Placeholder
      created_at: a.created_at || now,
    }))

  const allResults = [...filteredMemories, ...filteredProjects, ...filteredArticles];

  // Sort by created_at descending (most recent first)
  allResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    query: searchQuery,
    total: allResults.length,
    results: allResults,
    breakdown: {
      memories: filteredMemories.length,
      projects: filteredProjects.length,
      articles: filteredArticles.length,
      suggestions: 0,
    },
  }
}

export function SearchPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [searchMode, setSearchMode] = useState<'text' | 'semantic'>('semantic')
  const [searchFocused, setSearchFocused] = useState(false)
  const [showVoiceSearch, setShowVoiceSearch] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Handle ?similar=<id> parameter for "find similar" searches
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const similarId = params.get('similar')
    if (similarId) {
      setSearchMode('semantic')
      setLoading(true)
      fetch(`/api/memories?similar=${encodeURIComponent(similarId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.results) {
            setResults({
              query: `Similar to: ${data.source_title || 'memory'}`,
              total: data.total || data.results.length,
              results: data.results,
              breakdown: data.breakdown || {
                memories: data.results.filter((r: SearchResult) => r.type === 'memory').length,
                projects: data.results.filter((r: SearchResult) => r.type === 'project').length,
                articles: data.results.filter((r: SearchResult) => r.type === 'article').length,
                suggestions: 0
              }
            })
            setQuery(`Similar to: ${data.source_title || 'memory'}`)
          }
        })
        .catch(err => {
          console.error('[SearchPage] Similar search failed:', err)
          addToast({
            title: 'Similar search failed',
            description: 'Could not find similar items.',
            variant: 'destructive'
          })
        })
        .finally(() => setLoading(false))
    }
  }, [location.search])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    // Skip if this is a similar search
    if (params.get('similar')) return

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
      const { isOnline } = useOfflineStore.getState()

      if (!isOnline) {
        console.log('[SearchPage] Offline mode - performing local search.')
        const offlineResults = await searchOffline(searchQuery)
        setResults(offlineResults)
        haptic.light()
      } else {
        try {
          const semanticParam = searchMode === 'semantic' ? '&semantic=true' : ''
          const response = await fetch(`/api/memories?q=${encodeURIComponent(searchQuery)}${semanticParam}`)
          if (!response.ok) {
            throw new Error('Online search failed')
          }

          const data: SearchResponse = await response.json()
          setResults(data)
          haptic.light()
        } catch (onlineError) {
          console.error('[SearchPage] Online search failed, falling back to offline:', onlineError)
          addToast({
            title: 'Online search failed',
            description: 'Falling back to offline results.',
            variant: 'default'
          })
          const offlineResults = await searchOffline(searchQuery)
          setResults(offlineResults)
          haptic.light()
        }
      }
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

  // Debounced live search — fires 600ms after the user stops typing
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        setSearchParams({ q: val.trim() })
        performSearch(val.trim())
      }, 600)
    } else if (!val.trim()) {
      setResults(null)
    }
  }

  const handleVoiceSearch = (voiceQuery: string) => {
    setQuery(voiceQuery)
    setShowVoiceSearch(false)
    setSearchParams({ q: voiceQuery })
    performSearch(voiceQuery)
  }


  const navigateToResult = (result: SearchResult) => {
    haptic.light()
    switch (result.type) {
      case 'memory':
        navigate(`/memories?id=${result.id}`)
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
        return <Layers className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
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
        return 'var(--glass-surface)'
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
        className="fixed top-0 left-0 right-0 z-40 border-b-2 border-[var(--glass-surface-hover)]"
        style={{
          backgroundColor: '#0a0f1a'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="h-7 w-7" style={{ color: 'var(--brand-primary)', opacity: 0.7 }} />
            <h1 className="text-2xl sm:text-3xl" style={{
              fontWeight: 600,
              letterSpacing: 'var(--premium-tracking-tight)',
              color: 'var(--brand-text-secondary)',
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
          <div className="p-6 rounded-lg" style={{
            background: 'var(--brand-glass-bg)',
            border: '2px solid var(--glass-surface-hover)',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
          }}>
            <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
              Search <span style={{ color: 'var(--brand-primary)' }}>everything</span>
            </h2>
            <p className="mt-2 text-lg" style={{ color: 'var(--brand-text-secondary)' }}>
              Find memories, projects, articles, and suggestions instantly
            </p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Search Input */}
          <div className="p-4 rounded-lg mb-6" style={{
            background: 'var(--brand-glass-bg)',
            border: '2px solid var(--glass-surface-hover)',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
          }}>
            <form onSubmit={handleTextSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <Search
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5"
                  style={{ color: 'var(--brand-text-muted)' }}
                />
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={(e) => { setSearchFocused(true); handleInputFocus(e) }}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search your knowledge..."
                  className="w-full h-12 pl-12 pr-4 rounded-lg border-2 text-base focus:outline-none transition-all duration-200"
                  style={{
                    background: 'var(--glass-surface)',
                    borderColor: searchFocused ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.2)',
                    color: 'var(--brand-text-primary)',
                  }}
                />
              </div>
              {/* Voice search button */}
              <button
                type="button"
                onClick={() => setShowVoiceSearch(v => !v)}
                className="h-12 w-12 flex-shrink-0 rounded-lg flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: showVoiceSearch ? 'rgba(59,130,246,0.2)' : 'var(--glass-surface)',
                  border: `1px solid ${showVoiceSearch ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.2)'}`,
                  color: showVoiceSearch ? 'var(--brand-primary)' : 'var(--brand-text-muted)',
                }}
                aria-label="Voice search"
              >
                <Mic className="h-5 w-5" />
              </button>
            </form>

            {/* Voice search panel */}
            <AnimatePresence>
              {showVoiceSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mt-3"
                >
                  <VoiceSearch
                    onSearch={handleVoiceSearch}
                    onClose={() => setShowVoiceSearch(false)}
                    autoStart={true}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mode toggles — larger touch targets */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => { setSearchMode('text'); if (query.trim().length >= 2) performSearch(query.trim()) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  searchMode === 'text' ? 'bg-[rgba(255,255,255,0.1)] text-[var(--brand-text-primary)]' : 'text-[var(--brand-text-muted)]'
                }`}
              >
                Exact
              </button>
              <button
                onClick={() => { setSearchMode('semantic'); if (query.trim().length >= 2) performSearch(query.trim()) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  searchMode === 'semantic' ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--brand-text-muted)]'
                }`}
              >
                Semantic
              </button>
            </div>
          </div>

          {/* Results */}
          {loading && (
            <div className="p-6 rounded-lg" style={{
              background: 'var(--brand-glass-bg)',
              border: '2px solid var(--glass-surface-hover)',
              boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
            }}>
              <div className="text-center py-20">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
                <p style={{ color: 'var(--brand-text-secondary)' }}>Searching...</p>
              </div>
            </div>
          )}

          {!loading && results && (
            <>
              {/* Results Summary */}
              <div className="p-6 rounded-lg mb-6" style={{
                background: 'var(--brand-glass-bg)',
                border: '2px solid var(--glass-surface-hover)',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
              }}>
                <h2 className="text-xl font-semibold mb-2 premium-text-platinum">
                  {results.total} {results.total === 1 ? 'result' : 'results'} for "{results.query}"
                </h2>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--brand-text-muted)' }}>
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
                      whileTap={{ scale: 0.98, backgroundColor: 'var(--glass-surface)' }}
                      onClick={() => navigateToResult(result)}
                      className="p-5 rounded-lg cursor-pointer"
                      style={{
                        background: 'var(--brand-glass-bg)',
                        border: '2px solid var(--glass-surface-hover)',
                        boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Type Badge */}
                          <div className="flex items-center gap-2 mb-2">
                            {getResultIcon(result.type)}
                            <span
                              className="text-xs font-medium px-2 py-1 rounded-lg capitalize"
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
                            <p className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--brand-text-secondary)' }}>
                              {result.body || result.description}
                            </p>
                          )}

                          {/* Tags */}
                          {result.tags && result.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.tags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded-lg"
                                  style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    color: 'var(--brand-primary)'
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Arrow always visible on touch */}
                        <div className="flex-shrink-0 opacity-30">
                          <ArrowRight className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
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
