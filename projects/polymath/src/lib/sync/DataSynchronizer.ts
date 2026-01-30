import { useProjectStore } from '../../stores/useProjectStore'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useReadingStore } from '../../stores/useReadingStore'
import { useListStore } from '../../stores/useListStore'
import { useOfflineStore } from '../../stores/useOfflineStore'
import { offlineContentManager } from '../offline/OfflineContentManager'
import { readingDb } from '../db'
import { SYNC_INTERVAL } from '../cacheConfig'

class DataSynchronizer {
  private static instance: DataSynchronizer
  private isSyncing: boolean = false
  private syncInterval: NodeJS.Timeout | null = null
  private broadcastChannel: BroadcastChannel

  private constructor() {
    this.broadcastChannel = new BroadcastChannel('rosette_sync_channel')
    
    // Listen for sync events from other tabs/workers
    this.broadcastChannel.onmessage = (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        console.log('[DataSynchronizer] Received sync complete signal from another tab')
        // We could trigger a soft refresh of stores here if needed, 
        // but for now we rely on the fact that data is in IndexedDB
      }
    }
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
      console.log('[DataSynchronizer] Sync already in progress, skipping')
      return
    }

    const { isOnline } = useOfflineStore.getState()
    if (!isOnline) {
      console.log('[DataSynchronizer] Offline, skipping sync')
      return
    }

    this.isSyncing = true
    useOfflineStore.getState().setPulling(true)
    console.log('[DataSynchronizer] Starting comprehensive sync...')

    try {
      // Run fetches in parallel for speed
      // Reading list sync might take longer due to content downloads
      await Promise.allSettled([
        this.syncProjects(),
        this.syncMemories(),
        this.syncReadingList(),
        this.syncLists(),
        this.syncConnections(),
        this.syncDashboard()
      ])

      console.log('[DataSynchronizer] Sync completed successfully')
      this.broadcastChannel.postMessage({ type: 'SYNC_COMPLETE', timestamp: Date.now() })
      
    } catch (error) {
      console.error('[DataSynchronizer] Sync failed:', error)
    } finally {
      this.isSyncing = false
      useOfflineStore.getState().setPulling(false)
    }
  }

  private async syncProjects() {
    console.log('[DataSynchronizer] Syncing projects...')
    // Force retry=0, triggering API call if online
    await useProjectStore.getState().fetchProjects(0)
  }

  private async syncMemories() {
    console.log('[DataSynchronizer] Syncing memories...')
    // Force=true to bypass cache check and hit API
    await useMemoryStore.getState().fetchMemories(true)
  }

  private async syncReadingList() {
    console.log('[DataSynchronizer] Syncing reading list...')
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

      console.log(`[DataSynchronizer] Found ${uncachedArticles.length} articles to cache offline`)

      // 3. Download content for uncached articles (Sequential to be nice to network/CPU)
      for (const article of uncachedArticles) {
        await offlineContentManager.downloadArticle(article)
      }

    } catch (error) {
      console.error('[DataSynchronizer] Reading list sync failed:', error)
    }
  }
  
  private async syncLists() {
    console.log('[DataSynchronizer] Syncing lists...')
    try {
      // 1. Fetch all lists
      await useListStore.getState().fetchLists()

      const lists = useListStore.getState().lists

      // 2. Fetch items for each list (ensures all items are cached)
      for (const list of lists) {
        await useListStore.getState().fetchListItems(list.id)
      }

      console.log(`[DataSynchronizer] Synced ${lists.length} lists with items`)
    } catch (error) {
      console.error('[DataSynchronizer] Lists sync failed:', error)
    }
  }

  private async syncConnections() {
    console.log('[DataSynchronizer] Syncing connections...')
    try {
      // Double-check online status before making network request
      if (!navigator.onLine) {
        console.log('[DataSynchronizer] Skipping connections sync - offline')
        return
      }

      const response = await fetch('/api/connections?action=list-all')
      if (response.ok) {
        const { connections } = await response.json()
        if (connections && Array.isArray(connections)) {
          await readingDb.cacheConnections(connections)
          console.log(`[DataSynchronizer] Cached ${connections.length} connections`)
        }
      }
    } catch (error) {
      console.error('[DataSynchronizer] Connection sync failed:', error)
      // Silently fail - this is a background sync operation
    }
  }
  
  private async syncDashboard() {
    console.log('[DataSynchronizer] Syncing dashboard data...')
    try {
      // Double-check online status before making network requests
      if (!navigator.onLine) {
        console.log('[DataSynchronizer] Skipping dashboard sync - offline')
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
        }).catch(err => console.warn('[DataSynchronizer] Inspiration fetch failed:', err)),

        // Evolution (Insights)
        fetch('/api/analytics?resource=evolution').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            await readingDb.cacheDashboard('evolution', data)
          }
        }).catch(err => console.warn('[DataSynchronizer] Evolution fetch failed:', err)),

        // Patterns (Timeline)
        fetch('/api/analytics?resource=patterns').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            await readingDb.cacheDashboard('patterns', data)
          }
        }).catch(err => console.warn('[DataSynchronizer] Patterns fetch failed:', err)),

        // Bedtime prompts
        fetch('/api/projects?resource=bedtime').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            await readingDb.cacheDashboard('bedtime', data)
          }
        }).catch(err => console.warn('[DataSynchronizer] Bedtime fetch failed:', err)),

        // COST OPTIMIZATION: Removed Power Hour from auto-sync
        // Power Hour is expensive (~18K tokens/call) and already has:
        // - 20-hour cache
        // - Daily cron pre-generation
        // - On-demand refresh when user opens the page
        // Syncing it every 5 minutes was costing £13-15/month!

        // RSS Feeds
        fetch('/api/reading?resource=rss').then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data.feeds)) {
              await readingDb.cacheDashboard('rss-feeds', data.feeds)
            }
          }
        }).catch(err => console.warn('[DataSynchronizer] RSS fetch failed:', err))
      ])

      console.log('[DataSynchronizer] Dashboard data cached (inspiration, evolution, patterns, bedtime, rss)')
    } catch (error) {
      console.error('[DataSynchronizer] Dashboard sync failed:', error)
      // Silently fail - this is a background sync operation
    }
  }

  /**
   * Starts an interval to sync data periodically (default: 5 mins)
   */
  public startPeriodicSync(intervalMs: number = SYNC_INTERVAL) {
    if (this.syncInterval) return

    console.log(`[DataSynchronizer] Starting periodic sync every ${intervalMs}ms`)
    this.syncInterval = setInterval(() => {
      // Only auto-sync if window is visible to save resources
      if (document.visibilityState === 'visible') {
        this.sync()
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
