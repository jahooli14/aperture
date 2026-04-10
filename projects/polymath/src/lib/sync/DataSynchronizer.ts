import { useProjectStore } from '../../stores/useProjectStore'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useReadingStore } from '../../stores/useReadingStore'
import { useListStore } from '../../stores/useListStore'
import { useOfflineStore } from '../../stores/useOfflineStore'
import { logger } from '../logger'
import { offlineContentManager } from '../offline/OfflineContentManager'
import { readingDb } from '../db'
import { SYNC_INTERVAL } from '../cacheConfig'

class DataSynchronizer {
  private static instance: DataSynchronizer
  private isSyncing: boolean = false
  private syncInterval: NodeJS.Timeout | null = null
  private broadcastChannel: BroadcastChannel
  private currentRoute: string = '/'
  private lastFullSync: number = 0

  private constructor() {
    this.broadcastChannel = new BroadcastChannel('rosette_sync_channel')

    // Listen for sync events from other tabs/workers
    this.broadcastChannel.onmessage = (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        logger.debug('[DataSynchronizer] Received sync complete signal from another tab')
      }
    }
  }

  /**
   * Update the current route so periodic sync only fetches relevant data
   */
  public setCurrentRoute(route: string) {
    this.currentRoute = route
  }

  public static getInstance(): DataSynchronizer {
    if (!DataSynchronizer.instance) {
      DataSynchronizer.instance = new DataSynchronizer()
    }
    return DataSynchronizer.instance
  }

  /**
   * Performs a full synchronization of critical data:
   * 1. Projects
   * 2. Memories
   * 3. Reading List (Articles + Content)
   * 4. Lists & List Items (films, books, etc.)
   * 5. Connections (Bridges)
   * 6. Dashboard Data (Insights/Inspiration)
   *
   * Fetches fresh data from API and updates Dexie cache via the stores.
   * All content is available offline immediately after sync.
   */
  public async sync() {
    if (this.isSyncing) {
      logger.debug('[DataSynchronizer] Sync already in progress, skipping')
      return
    }

    const { isOnline } = useOfflineStore.getState()
    if (!isOnline) {
      logger.debug('[DataSynchronizer] Offline, skipping sync')
      return
    }

    this.isSyncing = true
    useOfflineStore.getState().setPulling(true)
    logger.debug('[DataSynchronizer] Starting comprehensive sync...')

    try {
      // Stagger sync operations to avoid thundering herd
      const operations = [
        () => this.syncProjects(),
        () => this.syncMemories(),
        () => this.syncReadingList(),
        () => this.syncLists(),
        () => this.syncConnections(),
        () => this.syncDashboard()
      ]

      for (const op of operations) {
        try { await op() } catch (e) { logger.warn('[DataSynchronizer] Sync step failed:', e) }
        // Small delay between operations to spread network load
        await new Promise(r => setTimeout(r, 500))
      }

      this.lastFullSync = Date.now()
      logger.debug('[DataSynchronizer] Sync completed successfully')
      this.broadcastChannel.postMessage({ type: 'SYNC_COMPLETE', timestamp: Date.now() })
      
    } catch (error) {
      logger.error('[DataSynchronizer] Sync failed:', error)
    } finally {
      this.isSyncing = false
      useOfflineStore.getState().setPulling(false)
    }
  }

  private async syncProjects() {
    logger.debug('[DataSynchronizer] Syncing projects...')
    // Force retry=0, triggering API call if online
    await useProjectStore.getState().fetchProjects(0)
  }

  private async syncMemories() {
    logger.debug('[DataSynchronizer] Syncing memories...')
    // Force=true to bypass cache check and hit API
    await useMemoryStore.getState().fetchMemories(true)
  }

  private async syncReadingList() {
    logger.debug('[DataSynchronizer] Syncing reading list...')
    try {
      // 1. Fetch latest metadata/content from API
      await useReadingStore.getState().fetchArticles(undefined, true)
      
      const articles = useReadingStore.getState().articles
      const uncachedArticles = []

      // 2. Check which articles need full content caching
      for (const article of articles) {
        // Skip archived articles to save space, unless explicitly marked keep?
        // For now, sync everything active/unread/reading
        if (article.status === 'archived') continue

        const isCached = await offlineContentManager.isFullyCached(article.id)
        if (!isCached && article.processed) {
          uncachedArticles.push(article)
        }
      }

      logger.debug(`[DataSynchronizer] Found ${uncachedArticles.length} articles to cache offline`)

      // 3. Download content for uncached articles (Sequential to be nice to network/CPU)
      for (const article of uncachedArticles) {
        await offlineContentManager.downloadArticle(article)
      }

    } catch (error) {
      logger.error('[DataSynchronizer] Reading list sync failed:', error)
    }
  }
  
  private async syncLists() {
    logger.debug('[DataSynchronizer] Syncing lists...')
    try {
      // 1. Fetch all lists (updates store.lists  safe, doesn't affect items)
      await useListStore.getState().fetchLists()

      const lists = useListStore.getState().lists
      const activeListId = useListStore.getState().currentListId

      // 2. Warm every list's cache so the UI feels seamless (Google-Keep
      //    style). For non-active lists we populate itemsByListId in the
      //    store (persisted to localStorage) AND Dexie so the next time the
      //    user opens that list it renders instantly with zero flicker.
      //    For the active list we go through fetchListItems() which handles
      //    the smart-diff update on the currently visible items.
      for (const list of lists) {
        if (list.id === activeListId) {
          await useListStore.getState().fetchListItems(list.id)
        } else {
          try {
            const response = await fetch(`/api/list-items?listId=${list.id}`)
            if (response.ok) {
              const items = await response.json()
              await readingDb.cacheListItems(items)
              // Mirror to the in-memory + persisted map so switching to
              // this list later is instant.
              useListStore.setState(state => ({
                itemsByListId: { ...state.itemsByListId, [list.id]: items },
              }))
            }
          } catch (e) {
            // Silently fail  background cache, not critical
          }
        }
      }

      logger.debug(`[DataSynchronizer] Synced ${lists.length} lists with items`)
    } catch (error) {
      logger.error('[DataSynchronizer] Lists sync failed:', error)
    }
  }

  private async syncConnections() {
    logger.debug('[DataSynchronizer] Syncing connections...')
    try {
      // Double-check online status before making network request
      if (!navigator.onLine) {
        logger.debug('[DataSynchronizer] Skipping connections sync - offline')
        return
      }

      const response = await fetch('/api/connections?action=list-all')
      if (response.ok) {
        const { connections } = await response.json()
        if (connections && Array.isArray(connections)) {
          await readingDb.cacheConnections(connections)
          logger.debug(`[DataSynchronizer] Cached ${connections.length} connections`)
        }
      }
    } catch (error) {
      logger.error('[DataSynchronizer] Connection sync failed:', error)
      // Silently fail - this is a background sync operation
    }
  }
  
  private async syncDashboard() {
    logger.debug('[DataSynchronizer] Syncing dashboard data...')
    try {
      // Double-check online status before making network requests
      if (!navigator.onLine) {
        logger.debug('[DataSynchronizer] Skipping dashboard sync - offline')
        return
      }

      // Sync all dashboard resources in parallel
      // Wrap each fetch in try-catch to prevent one failure from blocking others
      await Promise.allSettled([
        // Inspiration
        fetch('/api/analytics?resource=inspiration').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            await readingDb.cacheDashboard('inspiration', data)
          }
        }).catch(err => logger.warn('[DataSynchronizer] Inspiration fetch failed:', err)),

        // Evolution (Insights)
        fetch('/api/memories?action=evolution').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            await readingDb.cacheDashboard('evolution', data)
          }
        }).catch(err => logger.warn('[DataSynchronizer] Evolution fetch failed:', err)),

        // Patterns (Timeline)
        fetch('/api/analytics?resource=patterns').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            await readingDb.cacheDashboard('patterns', data)
          }
        }).catch(err => logger.warn('[DataSynchronizer] Patterns fetch failed:', err)),

        // Bedtime prompts
        fetch('/api/projects?resource=bedtime').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            await readingDb.cacheDashboard('bedtime', data)
          }
        }).catch(err => logger.warn('[DataSynchronizer] Bedtime fetch failed:', err)),

        // COST OPTIMIZATION: Removed Power Hour from auto-sync
        // Power Hour is expensive (~18K tokens/call) and already has:
        // - 20-hour cache
        // - Daily cron pre-generation
        // - On-demand refresh when user opens the page
        // Syncing it every 5 minutes was costing 13-15/month!

        // RSS Feeds
        fetch('/api/reading?resource=rss').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data.feeds)) {
              await readingDb.cacheDashboard('rss-feeds', data.feeds)
            }
          }
        }).catch(err => logger.warn('[DataSynchronizer] RSS fetch failed:', err))
      ])

      logger.debug('[DataSynchronizer] Dashboard data cached (inspiration, evolution, patterns, bedtime, rss)')
    } catch (error) {
      logger.error('[DataSynchronizer] Dashboard sync failed:', error)
      // Silently fail - this is a background sync operation
    }
  }

  /**
   * Sync only the data relevant to the current route.
   * Falls back to full sync every 15 minutes.
   */
  public async syncForCurrentRoute() {
    const FULL_SYNC_INTERVAL = 15 * 60 * 1000 // 15 minutes
    const now = Date.now()

    // Full sync if it's been a while
    if (now - this.lastFullSync > FULL_SYNC_INTERVAL) {
      await this.sync()
      return
    }

    if (this.isSyncing) return

    const { isOnline } = useOfflineStore.getState()
    if (!isOnline) return

    this.isSyncing = true
    const route = this.currentRoute

    try {
      // Route-aware sync: only refresh data for the current page
      if (route === '/' || route === '') {
        await Promise.allSettled([this.syncProjects(), this.syncMemories(), this.syncDashboard()])
      } else if (route.startsWith('/reading')) {
        await this.syncReadingList()
      } else if (route.startsWith('/memories')) {
        await this.syncMemories()
      } else if (route.startsWith('/projects')) {
        await this.syncProjects()
      } else if (route.startsWith('/lists')) {
        await this.syncLists()
      } else {
        // For other routes, just sync projects + memories (light sync)
        await Promise.allSettled([this.syncProjects(), this.syncMemories()])
      }
    } catch (error) {
      logger.error('[DataSynchronizer] Route sync failed:', error)
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Starts an interval to sync data periodically (default: 5 mins)
   */
  public startPeriodicSync(intervalMs: number = SYNC_INTERVAL) {
    if (this.syncInterval) return

    logger.debug(`[DataSynchronizer] Starting periodic sync every ${intervalMs}ms`)
    this.syncInterval = setInterval(() => {
      // Only auto-sync if window is visible to save resources
      if (document.visibilityState === 'visible') {
        this.syncForCurrentRoute()
      }
    }, intervalMs)
  }

  public stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }
}

export const dataSynchronizer = DataSynchronizer.getInstance()
