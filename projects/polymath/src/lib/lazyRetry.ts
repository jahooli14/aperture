/**
 * Wraps a dynamic import with retry logic for Vite chunk loading failures.
 * After a new deployment, old chunk hashes no longer exist on the server.
 * This detects the failure and reloads the page once to pick up fresh chunks.
 */
export function lazyRetry<T>(
  importFn: () => Promise<T>,
): () => Promise<T> {
  return () =>
    importFn().catch((error: unknown) => {
      // Only auto-reload once per session to avoid infinite reload loops
      const key = 'chunk_reload'
      const hasReloaded = sessionStorage.getItem(key)

      if (!hasReloaded) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        // Return a never-resolving promise so React doesn't try to render
        return new Promise<T>(() => {})
      }

      // Already reloaded once — throw the original error so ErrorBoundary catches it
      throw error
    })
}
