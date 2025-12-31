/**
 * AI Enrichment Manager
 *
 * Handles debounced AI task suggestions for projects.
 * - Waits 1 minute after the last task change before triggering AI
 * - Tracks which projects have pending changes
 * - Prevents duplicate enrichment calls
 * - Only triggers for projects that actually need enrichment
 */

// Projects that have pending task changes awaiting AI enrichment
const pendingEnrichment = new Map<string, {
  timeout: ReturnType<typeof setTimeout>
  previousTaskCount: number
  changedAt: number
}>()

// Projects currently being enriched (prevent duplicate calls)
const enrichingProjects = new Set<string>()

// Debounce delay in milliseconds (1 minute as requested)
const ENRICHMENT_DELAY_MS = 60 * 1000

/**
 * Schedule AI enrichment for a project after task changes
 * Uses a 1-minute debounce to batch multiple edits
 */
// Schedule AI enrichment for a project after task changes or content updates
// Uses a 1-minute debounce to batch multiple edits
export function scheduleAIEnrichment(
  projectId: string,
  currentTaskCount: number,
  hasMeaningfulChange: boolean
): void {
  // Skip if project is currently being enriched
  if (enrichingProjects.has(projectId)) {
    console.log(`[AIEnrichment] Project ${projectId} is currently enriching, skipping`)
    return
  }

  // Clear existing timeout for this project
  const existing = pendingEnrichment.get(projectId)
  if (existing) {
    clearTimeout(existing.timeout)
  }

  // Only schedule if there's a meaningful change
  const needsEnrichment = hasMeaningfulChange ||
    currentTaskCount === 0 || // New project with no tasks
    (existing && currentTaskCount !== existing.previousTaskCount)

  if (!needsEnrichment && existing) {
    console.log(`[AIEnrichment] No meaningful change for ${projectId}, skipping`)
    return
  }

  console.log(`[AIEnrichment] Scheduling enrichment for ${projectId} in ${ENRICHMENT_DELAY_MS / 1000}s (Reason: ${hasMeaningfulChange ? 'Content Change' : 'Task Count'})`)

  // Schedule enrichment after delay
  const timeout = setTimeout(() => {
    triggerEnrichment(projectId)
  }, ENRICHMENT_DELAY_MS)

  pendingEnrichment.set(projectId, {
    timeout,
    previousTaskCount: currentTaskCount,
    changedAt: Date.now()
  })
}

/**
 * Trigger immediate AI enrichment for a project
 * Used after delay or for explicit refresh
 */
async function triggerEnrichment(projectId: string): Promise<void> {
  // Remove from pending
  pendingEnrichment.delete(projectId)

  // Skip if not online
  if (!navigator.onLine) {
    console.log(`[AIEnrichment] Offline, skipping enrichment for ${projectId}`)
    return
  }

  // Skip if already enriching
  if (enrichingProjects.has(projectId)) {
    console.log(`[AIEnrichment] Already enriching ${projectId}, skipping duplicate`)
    return
  }

  enrichingProjects.add(projectId)
  console.log(`[AIEnrichment] Starting enrichment for ${projectId}`)

  try {
    const response = await fetch(
      `/api/power-hour?projectId=${projectId}&refresh=true&enrich=true`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error(`[AIEnrichment] Failed for ${projectId}:`, response.status, text)
    } else {
      const data = await response.json()
      console.log(`[AIEnrichment] Success for ${projectId}:`, {
        tasksGenerated: data.tasks?.length || 0,
        cached: data.cached
      })

      // Refresh the project in the store to show new tasks
      // Dispatch a custom event that the store/components can listen to
      window.dispatchEvent(new CustomEvent('projectEnriched', {
        detail: { projectId }
      }))
    }
  } catch (error) {
    console.error(`[AIEnrichment] Error for ${projectId}:`, error)
  } finally {
    enrichingProjects.delete(projectId)
  }
}

/**
 * Cancel pending enrichment for a project
 * Used when navigating away or project is deleted
 */
export function cancelPendingEnrichment(projectId: string): void {
  const pending = pendingEnrichment.get(projectId)
  if (pending) {
    clearTimeout(pending.timeout)
    pendingEnrichment.delete(projectId)
    console.log(`[AIEnrichment] Cancelled pending enrichment for ${projectId}`)
  }
}

/**
 * Trigger immediate enrichment (bypass debounce)
 * Used for explicit user requests or after sync
 */
export function triggerImmediateEnrichment(projectId: string): void {
  // Cancel any pending
  cancelPendingEnrichment(projectId)

  // Trigger now
  triggerEnrichment(projectId)
}

/**
 * Check if a project has pending enrichment
 */
export function hasPendingEnrichment(projectId: string): boolean {
  return pendingEnrichment.has(projectId)
}

/**
 * Get all projects with pending enrichment
 */
export function getPendingEnrichmentProjects(): string[] {
  return Array.from(pendingEnrichment.keys())
}
