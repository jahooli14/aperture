import { useCallback, useEffect, useRef, useState } from 'react'
import type { Article, ArticleGist } from '../types/reading'
import { readingDb } from '../lib/db'

/**
 * The three bullets at the top of an article.
 *
 * Fires once as the article opens. If the row already carries a cached
 * gist (from a previous open, or from the offline copy) it renders
 * instantly and no request goes out at all. Otherwise it asks the server
 * to build one — a single Gemini call, cached server-side, so this costs
 * nothing on the second read.
 *
 * Failure is quiet: no gist means no card, never an error banner over the
 * thing the user actually came to read.
 */
export function useArticleGist(article: Article | null) {
  const cached = article?.metadata?.gist ?? null
  const [gist, setGist] = useState<ArticleGist | null>(cached)
  const [loading, setLoading] = useState(false)
  // One attempt per article per mount. The reader polls refetch() while an
  // article is still being extracted, and we must not fire a Gemini call
  // on every one of those ticks.
  const attemptedRef = useRef<string | null>(null)

  useEffect(() => {
    setGist(article?.metadata?.gist ?? null)
  }, [article?.id, article?.metadata?.gist])

  const build = useCallback(async (articleId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reading?resource=gist&id=${articleId}`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      const next: ArticleGist | null = data?.gist ?? null
      setGist(next)
      if (next) {
        // Keep the offline copy in step, so a cached read shows the gist too.
        readingDb.articles.get(articleId)
          .then(row => {
            if (!row) return
            return readingDb.cacheArticle({
              ...row,
              metadata: { ...(row.metadata || {}), gist: next },
            } as Article)
          })
          .catch(() => {})
      }
    } catch {
      // Offline, or the model had nothing. Show the article, say nothing.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!article?.id) return
    if (attemptedRef.current === article.id) return
    // Nothing to summarise yet — extraction is still running.
    if (!article.content) return
    // Already have it, or the server already decided this one is too short.
    if (article.metadata?.gist) return
    if (article.metadata?.gist_skipped_at) return
    if (!navigator.onLine) return

    attemptedRef.current = article.id
    build(article.id)
  }, [article?.id, article?.content, article?.metadata?.gist, article?.metadata?.gist_skipped_at, build])

  return { gist, loading }
}
