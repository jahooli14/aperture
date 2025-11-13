/**
 * Processing Debug Panel
 * Shows detailed real-time processing state for articles
 * Visible on mobile for debugging stuck articles
 */

import { useState, useEffect } from 'react'
import { AlertCircle, RotateCw, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { articleProcessor } from '../../lib/articleProcessor'
import type { Article } from '../../types/reading'

interface ProcessingDebugPanelProps {
  articles: Article[]
  onRetry: (articleId: string, url: string) => void
}

export function ProcessingDebugPanel({ articles, onRetry }: ProcessingDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [logs, setLogs] = useState<Array<{ time: string; message: string; level: 'info' | 'error' | 'success' }>>([])

  // Find all unprocessed articles
  const unprocessedArticles = articles.filter(a => !a.processed)

  // Add log entry
  const addLog = (message: string, level: 'info' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    setLogs(prev => [...prev.slice(-20), { time, message, level }])
  }

  // Log unprocessed articles on mount
  useEffect(() => {
    if (unprocessedArticles.length > 0) {
      addLog(`Found ${unprocessedArticles.length} unprocessed article(s)`, 'info')
      unprocessedArticles.forEach(article => {
        const age = Date.now() - new Date(article.created_at).getTime()
        const ageMinutes = Math.floor(age / 60000)
        addLog(`Article ${article.id.slice(0, 8)}: ${ageMinutes}min old - "${article.excerpt?.slice(0, 50)}"`, 'info')
      })
    }
  }, [])

  // Monitor ArticleProcessor state
  useEffect(() => {
    const interval = setInterval(() => {
      const processing = articleProcessor.getAllProcessing()
      if (processing.length > 0) {
        processing.forEach(item => {
          const elapsed = Date.now() - item.startTime
          const seconds = Math.floor(elapsed / 1000)
          addLog(`${item.id.slice(0, 8)}: Attempt ${item.attempts}, ${seconds}s elapsed`, 'info')
        })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (unprocessedArticles.length === 0) {
    return null
  }

  const getArticleAge = (createdAt: string) => {
    const age = Date.now() - new Date(createdAt).getTime()
    const minutes = Math.floor(age / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  const isBeingProcessed = (articleId: string) => {
    return articleProcessor.isProcessing(articleId)
  }

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-4">
      <div
        className="max-w-4xl mx-auto premium-glass rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(15, 24, 41, 0.98)',
          borderColor: 'var(--premium-red)',
          borderWidth: '2px',
          borderStyle: 'solid',
          boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b cursor-pointer"
          style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" style={{ color: 'var(--premium-red)' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--premium-text-primary)' }}>
                Processing Debug ({unprocessedArticles.length} stuck)
              </p>
              <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                Tap to {isExpanded ? 'collapse' : 'expand'}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
          ) : (
            <ChevronUp className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
          )}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="max-h-96 overflow-y-auto">
            {/* Unprocessed Articles */}
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>
                STUCK ARTICLES
              </p>
              {unprocessedArticles.map(article => {
                const processing = isBeingProcessed(article.id)
                const processingState = articleProcessor.getStatus(article.id)

                return (
                  <div
                    key={article.id}
                    className="premium-glass rounded-lg p-3 space-y-2"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono" style={{ color: 'var(--premium-text-tertiary)' }}>
                          ID: {article.id.slice(0, 12)}...
                        </p>
                        <p className="text-sm font-medium truncate mt-1" style={{ color: 'var(--premium-text-primary)' }}>
                          {article.title || 'Untitled'}
                        </p>
                        <p className="text-xs truncate mt-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                          {new URL(article.url).hostname}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          addLog(`Manual retry triggered for ${article.id.slice(0, 8)}`, 'info')
                          onRetry(article.id, article.url)
                        }}
                        disabled={processing}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: processing ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: processing ? 'var(--premium-blue)' : 'var(--premium-red)',
                        }}
                      >
                        {processing ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </>
                        ) : (
                          <>
                            <RotateCw className="h-3 w-3" />
                            Retry
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--premium-text-tertiary)' }}>Age:</span>
                        <span style={{ color: 'var(--premium-text-secondary)' }}>
                          {getArticleAge(article.created_at)}
                        </span>
                      </div>

                      {processing && processingState && (
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--premium-text-tertiary)' }}>Attempts:</span>
                          <span style={{ color: 'var(--premium-blue)' }}>
                            {processingState.attempts} / 180
                          </span>
                        </div>
                      )}

                      <div className="text-xs p-2 rounded" style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        color: 'var(--premium-text-tertiary)'
                      }}>
                        Status: {article.excerpt || 'No status message'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Activity Log */}
            <div
              className="p-4 border-t space-y-2"
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>
                ACTIVITY LOG
              </p>
              <div
                className="space-y-1 text-xs font-mono max-h-40 overflow-y-auto"
                style={{ color: 'var(--premium-text-tertiary)' }}
              >
                {logs.length === 0 ? (
                  <p className="text-xs italic">No activity yet...</p>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className="flex gap-2"
                      style={{
                        color: log.level === 'error'
                          ? 'var(--premium-red)'
                          : log.level === 'success'
                          ? 'var(--premium-green)'
                          : 'var(--premium-text-tertiary)'
                      }}
                    >
                      <span className="opacity-60">[{log.time}]</span>
                      <span className="flex-1">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
