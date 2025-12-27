import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { List, ListItem, CreateListInput, CreateListItemInput, ListType } from '../types'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'

interface ListStore {
    lists: List[]
    currentListItems: ListItem[]
    loading: boolean
    error: string | null
    offlineMode: boolean

    fetchLists: () => Promise<void>
    createList: (input: CreateListInput) => Promise<string> // Returns ID
    fetchListItems: (listId: string) => Promise<void>
    addListItem: (input: CreateListItemInput) => Promise<void>
    deleteListItem: (itemId: string, listId: string) => Promise<void>
    updateListItemStatus: (itemId: string, status: ListItem['status']) => Promise<void>
    deleteList: (listId: string) => Promise<void>
    reorderItems: (listId: string, itemIds: string[]) => Promise<void>
}

export const useListStore = create<ListStore>()(
  persist(
    (set, get) => ({
    lists: [],
    currentListItems: [],
    loading: false,
    error: null,
    offlineMode: false,

    fetchLists: async () => {
        const { isOnline } = useOfflineStore.getState()

        // Helper to load from Dexie
        const loadFromDexie = async () => {
            try {
                const { readingDb } = await import('../lib/db')
                const cachedLists = await readingDb.getCachedLists()
                if (cachedLists.length > 0) {
                    console.log(`[ListStore] Loaded ${cachedLists.length} lists from Dexie cache`)
                    set({ lists: cachedLists as any, offlineMode: true, loading: false })
                    return true
                }
            } catch (e) {
                console.warn('[ListStore] Failed to load from Dexie:', e)
            }
            return false
        }

        // If offline, use cached data
        if (!isOnline) {
            console.log('[ListStore] Offline mode - loading from Dexie')
            await loadFromDexie()
            return
        }

        set({ loading: true })
        try {
            const response = await fetch('/api/lists')
            if (!response.ok) throw new Error('Failed to fetch lists')
            const data = await response.json()
            set({ lists: data, loading: false, offlineMode: false })

            // Cache to Dexie for offline viewing
            try {
                const { readingDb } = await import('../lib/db')
                await readingDb.cacheLists(data)
                console.log(`[ListStore] Cached ${data.length} lists to Dexie`)
            } catch (cacheError) {
                console.warn('[ListStore] Failed to cache lists:', cacheError)
            }
        } catch (error: any) {
            console.error('[ListStore] Fetch failed, loading from cache:', error)
            const loaded = await loadFromDexie()
            if (!loaded) {
                set({ error: error.message, loading: false, offlineMode: true })
            }
        }
    },

    createList: async (input) => {
        const { isOnline } = useOfflineStore.getState()

        // Optimistic Update
        const tempId = uuidv4()
        const optimisticList: List = {
            id: tempId,
            user_id: 'current-user', // Placeholder, updated by backend
            title: input.title,
            type: input.type,
            description: input.description,
            icon: input.icon,
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            item_count: 0
        }

        set(state => ({ lists: [optimisticList, ...state.lists] }))

        // If offline, queue operation
        if (!isOnline) {
            await queueOperation('create_list', {
                id: tempId,
                ...input,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            await useOfflineStore.getState().updateQueueSize()
            console.log('[ListStore] Queued create_list for offline sync')
            return tempId
        }

        try {
            const response = await fetch('/api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input)
            })

            if (!response.ok) throw new Error('Failed to create list')

            const realList = await response.json()

            // Replace optimistic list with real one
            set(state => ({
                lists: state.lists.map(l => l.id === tempId ? { ...realList, item_count: 0 } : l)
            }))

            return realList.id
        } catch (error: any) {
            // If network error, queue for later
            if (!navigator.onLine) {
                await queueOperation('create_list', {
                    id: tempId,
                    ...input,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                await useOfflineStore.getState().updateQueueSize()
                console.log('[ListStore] Queued create_list after failed attempt')
                return tempId
            }
            // Revert on failure
            set(state => ({
                lists: state.lists.filter(l => l.id !== tempId),
                error: error.message
            }))
            return ''
        }
    },

    fetchListItems: async (listId) => {
        const { isOnline } = useOfflineStore.getState()

        // Helper to load from Dexie
        const loadFromDexie = async () => {
            try {
                const { readingDb } = await import('../lib/db')
                const cachedItems = await readingDb.getCachedListItems(listId)
                if (cachedItems.length > 0) {
                    console.log(`[ListStore] Loaded ${cachedItems.length} items from Dexie cache`)
                    set({ currentListItems: cachedItems as any })
                    return true
                }
            } catch (e) {
                console.warn('[ListStore] Failed to load items from Dexie:', e)
            }
            return false
        }

        // If offline, load from cache
        if (!isOnline) {
            await loadFromDexie()
            return
        }

        try {
            const response = await fetch(`/api/list-items?listId=${listId}`)
            if (!response.ok) throw new Error('Failed to fetch items')
            const data = await response.json()
            set({ currentListItems: data })

            // Cache to Dexie for offline viewing
            try {
                const { readingDb } = await import('../lib/db')
                await readingDb.cacheListItems(data)
                console.log(`[ListStore] Cached ${data.length} items to Dexie`)
            } catch (cacheError) {
                console.warn('[ListStore] Failed to cache items:', cacheError)
            }
        } catch (error: any) {
            console.error('[ListStore] Fetch failed, loading from cache:', error)
            await loadFromDexie()
            set({ error: error.message })
        }
    },

    addListItem: async (input) => {
        const { isOnline } = useOfflineStore.getState()

        // Optimistic Update
        const tempId = uuidv4()
        const optimisticItem: ListItem = {
            id: tempId,
            list_id: input.list_id,
            user_id: 'current-user',
            content: input.content,
            status: input.status || 'pending',
            enrichment_status: 'pending',
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        set(state => ({
            currentListItems: [optimisticItem, ...state.currentListItems],
            // Also update the list count in the main lists array
            lists: state.lists.map(l =>
                l.id === input.list_id
                    ? { ...l, item_count: (l.item_count || 0) + 1 }
                    : l
            )
        }))

        // Also cache to Dexie for offline viewing
        try {
            const { readingDb } = await import('../lib/db')
            await readingDb.cacheListItems([optimisticItem])
        } catch (e) {
            console.warn('[ListStore] Failed to cache optimistic item:', e)
        }

        // If offline, queue operation
        if (!isOnline) {
            await queueOperation('add_list_item', {
                id: tempId,
                list_id: input.list_id,
                content: input.content,
                status: input.status || 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            await useOfflineStore.getState().updateQueueSize()
            console.log('[ListStore] Queued add_list_item for offline sync')
            return
        }

        try {
            const response = await fetch(`/api/list-items?listId=${input.list_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: input.content })
            })

            if (!response.ok) throw new Error('Failed to add item')

            const realItem = await response.json()

            // Replace optimistic item with real one
            set(state => ({
                currentListItems: state.currentListItems.map(i => i.id === tempId ? realItem : i)
            }))
        } catch (error: any) {
            // If network error, queue for later
            if (!navigator.onLine) {
                await queueOperation('add_list_item', {
                    id: tempId,
                    list_id: input.list_id,
                    content: input.content,
                    status: input.status || 'pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                await useOfflineStore.getState().updateQueueSize()
                console.log('[ListStore] Queued add_list_item after failed attempt')
                return
            }
            // Revert
            set(state => ({
                currentListItems: state.currentListItems.filter(i => i.id !== tempId),
                error: error.message,
                // Revert count
                lists: state.lists.map(l =>
                    l.id === input.list_id
                        ? { ...l, item_count: (l.item_count || 1) - 1 }
                        : l
                )
            }))
        }
    },

    updateListItemStatus: async (itemId, status) => {
        const { isOnline } = useOfflineStore.getState()

        // Optimistic
        set(state => ({
            currentListItems: state.currentListItems.map(i =>
                i.id === itemId ? { ...i, status } : i
            )
        }))

        // If offline, queue operation
        if (!isOnline) {
            await queueOperation('update_list_item', { id: itemId, status })
            await useOfflineStore.getState().updateQueueSize()
            console.log('[ListStore] Queued update_list_item for offline sync')
            return
        }

        // TODO: Implement API call for update when online
        // For now the optimistic update handles the UI
    },

    deleteListItem: async (itemId, listId) => {
        const { isOnline } = useOfflineStore.getState()
        const previousItems = get().currentListItems
        const previousLists = get().lists

        // Optimistic Delete
        set(state => ({
            currentListItems: state.currentListItems.filter(i => i.id !== itemId),
            lists: state.lists.map(l =>
                l.id === listId
                    ? { ...l, item_count: Math.max(0, (l.item_count || 0) - 1) }
                    : l
            )
        }))

        // Also remove from Dexie cache
        try {
            const { readingDb } = await import('../lib/db')
            await readingDb.deleteListItemFromCache(itemId)
        } catch (e) {
            console.warn('[ListStore] Failed to delete item from cache:', e)
        }

        // If offline, queue operation
        if (!isOnline) {
            await queueOperation('delete_list_item', { id: itemId })
            await useOfflineStore.getState().updateQueueSize()
            console.log('[ListStore] Queued delete_list_item for offline sync')
            return
        }

        try {
            const response = await fetch(`/api/list-items?id=${itemId}`, {
                method: 'DELETE'
            })

            if (!response.ok) throw new Error('Failed to delete item')
        } catch (error: any) {
            // If network error, queue for later
            if (!navigator.onLine) {
                await queueOperation('delete_list_item', { id: itemId })
                await useOfflineStore.getState().updateQueueSize()
                console.log('[ListStore] Queued delete_list_item after failed attempt')
                return
            }
            // Revert
            set({
                currentListItems: previousItems,
                lists: previousLists,
                error: error.message
            })
        }
    },

    deleteList: async (listId) => {
        const { isOnline } = useOfflineStore.getState()
        const previousLists = get().lists
        set(state => ({
            lists: state.lists.filter(l => l.id !== listId)
        }))

        // If offline, queue operation
        if (!isOnline) {
            await queueOperation('delete_list', { id: listId })
            await useOfflineStore.getState().updateQueueSize()
            console.log('[ListStore] Queued delete_list for offline sync')
            return
        }

        try {
            const response = await fetch(`/api/lists?id=${listId}`, {
                method: 'DELETE'
            })
            if (!response.ok) throw new Error('Failed to delete list')
        } catch (error: any) {
            // If network error, queue for later
            if (!navigator.onLine) {
                await queueOperation('delete_list', { id: listId })
                await useOfflineStore.getState().updateQueueSize()
                console.log('[ListStore] Queued delete_list after failed attempt')
                return
            }
            set({ lists: previousLists, error: error.message })
        }
    },

    reorderItems: async (listId, itemIds) => {
        const { isOnline } = useOfflineStore.getState()

        // Optimistic
        const currentItems = get().currentListItems
        const newItems = [...currentItems].sort((a, b) => {
            const indexA = itemIds.indexOf(a.id)
            const indexB = itemIds.indexOf(b.id)
            return indexA - indexB
        })
        set({ currentListItems: newItems })

        // If offline, queue operation
        if (!isOnline) {
            await queueOperation('reorder_list_items', { listId, itemIds })
            await useOfflineStore.getState().updateQueueSize()
            console.log('[ListStore] Queued reorder_list_items for offline sync')
            return
        }

        try {
            const response = await fetch(`/api/list-items?resource=reorder&listId=${listId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds })
            })
            if (!response.ok) throw new Error('Failed to reorder items')
        } catch (error: any) {
            // If network error, queue for later
            if (!navigator.onLine) {
                await queueOperation('reorder_list_items', { listId, itemIds })
                await useOfflineStore.getState().updateQueueSize()
                console.log('[ListStore] Queued reorder_list_items after failed attempt')
                return
            }
            set({ currentListItems: currentItems, error: error.message })
        }
    }
    }),
    {
      name: 'rosette-lists-store',
      partialize: (state) => ({ lists: state.lists, currentListItems: state.currentListItems })
    }
  )
)
