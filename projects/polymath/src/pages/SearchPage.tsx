import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Brain, Layers, BookOpen, Loader2, ArrowRight, Lightbulb, Mic } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { haptic } from '../utils/haptics'
import { SubtleBackground } from '../components/SubtleBackground'
import { EmptyState } from '../components/ui/empty-state'
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
    .filter(a => (a.title ?? '').toLowerCase().includes(lowerCaseQuery) || (a.content && a.content.toLowerCase().includes(lowerCaseQuery)) || (a.excerpt && a.excerpt.toLowerCase().includes(lowerCaseQuery)))
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
    results: allResults as SearchResult[],
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
  const [searchFocused, setSearchFocused] = useState(false)
  const [showVoiceSearch, setShowVoiceSearch] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  // Monotonic search id — only the most recent query's results may land, so a
  // slow earlier search can't overwrite a faster later one.
  const searchReqRef = useRef(0)

  // Handle ?similar=<id> parameter for "find similar" searches
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const similarId = params.get('similar')
    if (similarId) {
      const myReq = ++searchReqRef.current
      setLoading(true)
      fetch(`/api/memories?similar=${encodeURIComponent(similarId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.results && searchReqRef.current === myReq) {
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
        .finally(() => { if (searchReqRef.current === myReq) setLoading(false) })
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

    const myReq = ++searchReqRef.current
    setLoading(true)
    // Ignore this result if a newer search has since started.
    const isStale = () => searchReqRef.current !== myReq
    try {
      const { isOnline } = useOfflineStore.getState()

      if (!isOnline) {
        console.log('[SearchPage] Offline mode - performing local search.')
        const offlineResults = await searchOffline(searchQuery)
        if (isStale()) return
        setResults(offlineResults)
        haptic.light()
      } else {
        try {
          const response = await fetch(`/api/memories?q=${encodeURIComponent(searchQuery)}&semantic=true`)
          if (!response.ok) {
            throw new Error('Online search failed')
          }

          const data: SearchResponse = await response.json()
          if (isStale()) return
          setResults(data)
          haptic.light()
        } catch (onlineError) {
          console.error('[SearchPage] Online search failed, falling back to offline:', onlineError)
          if (isStale()) return
          addToast({
            title: 'Online search failed',
            description: 'Falling back to offline results.',
            variant: 'default'
          })
          const offlineResults = await searchOffline(searchQuery)
          if (isStale()) return
          setResults(offlineResults)
          haptic.light()
        }
      }
    } catch (error) {
      console.error('Search error:', error)
      addToast({
        title: 'Search failed',
        description: 'Try again in a moment.',
        variant: 'destructive'
      })
    } finally {
      if (!isStale()) setLoading(false)
    }
  }

  const handleTextSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setSearchParams({ q: query.trim() })
      performSearch(query.trim())
    }
  }

  // Debounced live search  fires 600ms after the user stops typing
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
        // The /suggestions route was removed; show the match without navigating.
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
        return <Brain className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
      case 'project':
        return <Layers className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
      case 'article':
        return <BookOpen className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
      case 'suggestion':
        return <Lightbulb className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
    }
  }

  const getResultBadgeColor = (type: string) => {
    switch (type) {
      case 'memory':
        return 'rgba(var(--brand-primary-rgb), 0.15)'
      case 'project':
        return 'rgba(var(--brand-primary-rgb), 0.15)'
      case 'article':
        return 'rgba(var(--brand-primary-rgb), 0.15)'
      case 'suggestion':
        return 'rgba(var(--brand-primary-rgb), 0.15)'
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

        {/* Dia-leaning search — single big soft input, page is mostly air */}
        <div className="min-h-screen pb-24">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">

            <header className="page-masthead">
              <div className="page-masthead-text">
                <h1 className="page-hero-sm text-center mb-2">What are you looking for?</h1>
                <p className="meta-serif text-center mb-10">
                  Memories, projects, articles — anything you've kept.
                </p>
              </div>
            </header>

            <form onSubmit={handleTextSearch} className="flex gap-2 mb-6">
              <div className="flex-1 relative">
                <Search
                  className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 opacity-60"
                  style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                />
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={(e) => { setSearchFocused(true); handleInputFocus(e) }}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search…"
                  className="soft-input soft-input-lg pl-14 pr-5 h-14"
                />
              </div>
              {/* Voice search button — quiet round affordance */}
              <button
                type="button"
                onClick={() => setShowVoiceSearch(v => !v)}
                className="h-14 w-14 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: showVoiceSearch ? 'rgba(var(--brand-primary-rgb),0.14)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${showVoiceSearch ? 'rgba(var(--brand-primary-rgb),0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: showVoiceSearch ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)',
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

          {/* Results */}
          {loading && (
            <div className="p-6 rounded-lg" style={{
              background: 'var(--brand-glass-bg)',
              border: '1px solid var(--glass-surface-hover)',
              boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
            }}>
              <div className="text-center py-20">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: "var(--brand-primary)" }} />
                <p style={{ color: "var(--brand-text-secondary)" }}>Searching...</p>
              </div>
            </div>
          )}

          {!loading && results && (
            <>
              {/* Results Summary */}
              <div className="p-6 rounded-lg mb-6" style={{
                background: 'var(--brand-glass-bg)',
                border: '1px solid var(--glass-surface-hover)',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
              }}>
                <h2 className="section-title mb-2">
                  {results.total} {results.total === 1 ? 'result' : 'results'} for &ldquo;{results.query}&rdquo;
                </h2>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm" style={{ color: "var(--brand-text-muted)" }}>
                  <span>{results.breakdown.memories} memories</span>
                  <span></span>
                  <span>{results.breakdown.projects} projects</span>
                  <span></span>
                  <span>{results.breakdown.articles} articles</span>
                  {results.breakdown.suggestions > 0 && (
                    <>
                      <span></span>
                      <span>{results.breakdown.suggestions} suggestions</span>
                    </>
                  )}
                </div>
              </div>

              {/* Results List */}
              {results.results.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No matches"
                  description="Try a different word, or tap the mic."
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
                      className="p-4 sm:p-5 rounded-lg cursor-pointer"
                      style={{
                        background: 'var(--brand-glass-bg)',
                        border: '1px solid var(--glass-surface-hover)',
                        boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Type Badge */}
                          <div className="flex items-center gap-2 mb-2">
                            {getResultIcon(result.type)}
                            <span
                              className="text-xs font-semibold px-2 py-1 rounded-lg capitalize text-[var(--brand-text-primary)]"
                              style={{ backgroundColor: getResultBadgeColor(result.type) }}
                            >
                              {result.type}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-base sm:text-lg font-semibold mb-1.5 line-clamp-2 text-[var(--brand-text-primary)]">
                            {result.title}
                          </h3>

                          {/* Description */}
                          {(result.body || result.description) && (
                            <p className="text-sm line-clamp-2 mb-2 text-[var(--brand-text-secondary)]">
                              {result.body || result.description}
                            </p>
                          )}

                          {/* Tags */}
                          {result.tags && result.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {result.tags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs font-medium px-2 py-0.5 rounded-lg"
                                  style={{
                                    backgroundColor: 'rgba(var(--brand-primary-rgb), 0.15)',
                                    color: 'var(--brand-primary)',
                                    border: '1px solid rgba(var(--brand-primary-rgb),0.25)'
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Arrow always visible on touch */}
                        <div className="flex-shrink-0 opacity-50 mt-1">
                          <ArrowRight className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
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
              title="Search your stuff"
              description="Type a query or tap the mic."
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}
