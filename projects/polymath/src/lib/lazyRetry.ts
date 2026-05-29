/**
 * Wraps a dynamic import with retry logic for chunk loading failures.
 *
 * Two distinct failure modes, handled differently:
 *
 * 1. Transient network failures (the festival case): a congested or flaky
 *    connection drops the request for a chunk. The chunk still exists on the
 *    server — the fetch just failed. We retry the import a few times with
 *    backoff. Re-calling import() re-attempts the fetch (browsers don't cache
 *    *failed* module loads), so most of these recover invisibly without the
 *    user ever seeing an error.
 *
 * 2. Stale chunk hashes after a deploy: old hashed filenames 404 forever. No
 *    amount of retrying helps, so once retries are exhausted we reload the page
 *    once (guarded by sessionStorage) to pick up the fresh index.html + hashes.
 *
 * When the user is fully offline we skip both — retrying and reloading are both
 * guaranteed to fail and a reload offline produces a blank page. We throw
 * instead so the nearest ErrorBoundary can render an offline-aware fallback.
 */

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function lazyRetry<T>(
  importFn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 350,
): () => Promise<T> {
  return async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const mod = await importFn()
        // A clean load means we're on fresh chunks — release the one-reload
        // guard so a future deploy-mismatch can recover the same way.
        sessionStorage.removeItem('chunk_reload')
        return mod
      } catch (error) {
        // Offline: don't burn retries or reload — surface to the ErrorBoundary.
        if (isOffline()) throw error

        // Still have retries left: wait with exponential backoff, then re-fetch.
        if (attempt < retries) {
          await delay(baseDelayMs * 2 ** attempt)
          continue
        }

        // Retries exhausted while online — most likely stale chunk hashes from a
        // deploy. Reload once to get fresh hashes; otherwise give up to the
        // ErrorBoundary.
        const key = 'chunk_reload'
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          window.location.reload()
          return new Promise<T>(() => {})
        }

        throw error
      }
    }
  }
}
