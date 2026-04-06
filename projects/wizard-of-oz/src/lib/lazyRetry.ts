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
      const key = 'chunk_reload'
      const hasReloaded = sessionStorage.getItem(key)

      if (!hasReloaded) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        return new Promise<T>(() => {})
      }

      throw error
    })
}
