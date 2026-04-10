import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { List, ListItem, ListSettings, CreateListInput, CreateListItemInput, ListType } from '../types'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'

interface ListStore {
    lists: List[]
    // Per-list cache of items. Acts as a Google-Keep-style always-ready cache
    // so switching to a previously-visited list shows its items instantly and
    // page reloads rehydrate from localStorage without a loading flash.
    itemsByListId: Record<string, ListItem[]>
    currentListItems: ListItem[]
    currentListId: string | null
    loading: boolean
    error: string | null
    offlineMode: boolean

    fetchLists: () => Promise<void>
    createList: (input: CreateListInput) => Promise<string> // Returns ID
    fetchListItems: (listId: string) => Promise<void>
    addListItem: (input: CreateListItemInput) => Promise<void>
    deleteListItem: (itemId: string, listId: string) => Promise<void>
    updateListItemStatus: (itemId: string, status: ListItem['status']) => Promise<void>
    updateListItemMetadata: (itemId: string, metadata: any) => Promise<void>
    updateList: (listId: string, updates: { title?: string; description?: string }) => Promise<void>
    updateListSettings: (listId: string, settings: ListSettings) => Promise<void>
    deleteList: (listId: string) => Promise<void>
    reorderItems: (listId: string, itemIds: string[]) => Promise<void>
    reorderLists: (listIds: string[]) => Promise<void>
}

export const useListStore = create<ListStore>()(
    persist(
        (set, get) => ({
            lists: [],
            itemsByListId: {},
            currentListItems: [],
            currentListId: null,
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

                    // Smart update: Skip if data hasn't changed to prevent flickering during background sync
                    const currentLists = get().lists
                    if (currentLists.length === data.length && data.length > 0) {
                        // Quick check: compare IDs and updated_at
                        const hasChanged = data.some((newL: any, idx: number) => {
                            const oldL = currentLists[idx]
                            return !oldL ||
                                   newL.id !== oldL.id ||
                                   newL.updated_at !== oldL.updated_at ||
                                   newL.title !== oldL.title ||
                                   newL.item_count !== oldL.item_count
                        })

                        if (!hasChanged) {
                            console.log('[ListStore] Skipping state update - data unchanged')
                            set({ loading: false, offlineMode: false })
                            // Still cache the data even if unchanged
                            try {
                                const { readingDb } = await import('../lib/db')
                                await readingDb.cacheLists(data)
                            } catch (cacheError) {
                                console.warn('[ListStore] Failed to cache lists:', cacheError)
                            }
                            return
                        }
                    }

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

                    if (!response.ok) {
                        const body = await response.json().catch(() => ({}))
                        throw new Error(body.error || 'Failed to create list')
                    }

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

                // Track current fetch to prevent race conditions
                const currentFetchId = listId
                const state = get()

                // --- Step 1: Serve instantly from the in-memory cache map ---
                // This is what makes list switching and page reloads feel like
                // Google Keep: if we've ever seen this list, its items are
                // already persisted in localStorage and show with zero flash.
                const cachedInMap = state.itemsByListId[listId]
                if (cachedInMap && cachedInMap.length > 0) {
                    set({
                        currentListId: currentFetchId,
                        currentListItems: cachedInMap,
                        loading: false,
                    })
                } else if (state.currentListId !== currentFetchId) {
                    // First time visiting this list in this session and no
                    // persisted cache -- update id but keep items empty while
                    // we try Dexie / network. We intentionally do NOT blank
                    // out currentListItems if the id hasn't changed.
                    set({
                        currentListId: currentFetchId,
                        currentListItems: [],
                        loading: true,
                    })
                } else {
                    // Same list, no persisted cache -- silent refresh
                    set({ loading: true })
                }

                // Helper to load from Dexie (secondary cache layer)
                const loadFromDexie = async () => {
                    try {
                        const { readingDb } = await import('../lib/db')
                        const cachedItems = await readingDb.getCachedListItems(listId)
                        if (cachedItems.length > 0) {
                            console.log(`[ListStore] Loaded ${cachedItems.length} items from Dexie cache`)
                            // Only update if this is still the current list
                            const s = get()
                            if (s.currentListId === currentFetchId) {
                                set({
                                    currentListItems: cachedItems as any,
                                    itemsByListId: { ...s.itemsByListId, [listId]: cachedItems as any },
                                    loading: false,
                                })
                            } else {
                                // Still populate the map for instant future switch
                                set({
                                    itemsByListId: { ...s.itemsByListId, [listId]: cachedItems as any },
                                })
                            }
                            return true
                        }
                    } catch (e) {
                        console.warn('[ListStore] Failed to load items from Dexie:', e)
                    }
                    return false
                }

                // If no in-memory cache yet, try Dexie before the network so
                // we never paint an empty grid when data exists locally.
                if (!cachedInMap || cachedInMap.length === 0) {
                    await loadFromDexie()
                }

                // If offline, we're done after the cache load.
                if (!isOnline) {
                    // Ensure loading spinner clears even if Dexie was empty
                    const s = get()
                    if (s.currentListId === currentFetchId && s.loading) {
                        set({ loading: false })
                    }
                    return
                }

                try {
                    const response = await fetch(`/api/lists?scope=items&listId=${listId}`)
                    if (!response.ok) throw new Error('Failed to fetch items')
                    const data = await response.json()

                    const s = get()
                    // Smart update: Skip if data hasn't changed to prevent
                    // flickering during background refresh.
                    const previous = s.itemsByListId[listId] ?? []
                    let unchanged = false
                    if (previous.length === data.length && data.length > 0) {
                        unchanged = !data.some((newItem: any, idx: number) => {
                            const oldItem = previous[idx]
                            return !oldItem ||
                                   newItem.id !== oldItem.id ||
                                   newItem.status !== oldItem.status ||
                                   newItem.enrichment_status !== oldItem.enrichment_status ||
                                   newItem.updated_at !== oldItem.updated_at
                        })
                    }

                    if (unchanged) {
                        console.log('[ListStore] Skipping items state update - data unchanged')
                        if (s.currentListId === currentFetchId && s.loading) {
                            set({ loading: false })
                        }
                    } else {
                        // Always keep the cache map fresh, even if the user
                        // has navigated to a different list in the meantime.
                        const nextMap = { ...s.itemsByListId, [listId]: data }
                        if (s.currentListId === currentFetchId) {
                            set({
                                currentListItems: data,
                                itemsByListId: nextMap,
                                loading: false,
                            })
                        } else {
                            console.log(`[ListStore] Caching background fetch for list ${listId}`)
                            set({ itemsByListId: nextMap })
                        }
                    }

                    // Mirror to Dexie for offline viewing
                    try {
                        const { readingDb } = await import('../lib/db')
                        await readingDb.cacheListItems(data)
                    } catch (cacheError) {
                        console.warn('[ListStore] Failed to cache items:', cacheError)
                    }
                } catch (error: any) {
                    console.error('[ListStore] Fetch failed, loading from cache:', error)
                    const s = get()
                    // If we already had cached items showing, keep them -- do
                    // not surface an error banner that causes a visible flash.
                    const haveCachedItems = (s.itemsByListId[listId]?.length ?? 0) > 0
                    if (!haveCachedItems) {
                        const loaded = await loadFromDexie()
                        if (!loaded && get().currentListId === currentFetchId) {
                            set({ error: error.message, loading: false })
                        }
                    } else if (s.currentListId === currentFetchId && s.loading) {
                        set({ loading: false })
                    }
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

                set(state => {
                    const existing = state.itemsByListId[input.list_id] ?? state.currentListItems
                    const nextItems = [optimisticItem, ...existing]
                    const isCurrent = state.currentListId === input.list_id
                    return {
                        currentListItems: isCurrent ? nextItems : state.currentListItems,
                        itemsByListId: { ...state.itemsByListId, [input.list_id]: nextItems },
                        // Also update the list count in the main lists array
                        lists: state.lists.map(l =>
                            l.id === input.list_id
                                ? { ...l, item_count: (l.item_count || 0) + 1 }
                                : l
                        )
                    }
                })

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
                    const response = await fetch(`/api/lists?scope=items&listId=${input.list_id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: input.content })
                    })

                    if (!response.ok) throw new Error('Failed to add item')

                    const realItem = await response.json()

                    // Replace optimistic item with real one
                    set(state => {
                        const replace = (items: ListItem[]) =>
                            items.map(i => i.id === tempId ? realItem : i)
                        const listItems = state.itemsByListId[input.list_id]
                        return {
                            currentListItems: replace(state.currentListItems),
                            itemsByListId: listItems
                                ? { ...state.itemsByListId, [input.list_id]: replace(listItems) }
                                : state.itemsByListId,
                        }
                    })
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
                    set(state => {
                        const remove = (items: ListItem[]) => items.filter(i => i.id !== tempId)
                        const listItems = state.itemsByListId[input.list_id]
                        return {
                            currentListItems: remove(state.currentListItems),
                            itemsByListId: listItems
                                ? { ...state.itemsByListId, [input.list_id]: remove(listItems) }
                                : state.itemsByListId,
                            error: error.message,
                            // Revert count
                            lists: state.lists.map(l =>
                                l.id === input.list_id
                                    ? { ...l, item_count: Math.max(0, (l.item_count || 1) - 1) }
                                    : l
                            )
                        }
                    })
                }
            },

            updateListItemStatus: async (itemId, status) => {
                const { isOnline } = useOfflineStore.getState()

                // Optimistic
                set(state => {
                    const patch = (items: ListItem[]) =>
                        items.map(i => i.id === itemId ? { ...i, status } : i)
                    const nextMap: Record<string, ListItem[]> = { ...state.itemsByListId }
                    for (const listId of Object.keys(nextMap)) {
                        if (nextMap[listId].some(i => i.id === itemId)) {
                            nextMap[listId] = patch(nextMap[listId])
                        }
                    }
                    return {
                        currentListItems: patch(state.currentListItems),
                        itemsByListId: nextMap,
                    }
                })

                // If offline, queue operation
                if (!isOnline) {
                    await queueOperation('update_list_item', { id: itemId, status })
                    await useOfflineStore.getState().updateQueueSize()
                    console.log('[ListStore] Queued update_list_item for offline sync')
                    return
                }

                // Update via API when online
                try {
                    const response = await fetch(`/api/lists?scope=items&id=${itemId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status })
                    })

                    if (!response.ok) {
                        throw new Error('Failed to update item status')
                    }

                    const updatedItem = await response.json()

                    set(state => {
                        const replace = (items: ListItem[]) =>
                            items.map(i => i.id === itemId ? updatedItem : i)
                        const nextMap: Record<string, ListItem[]> = { ...state.itemsByListId }
                        for (const listId of Object.keys(nextMap)) {
                            if (nextMap[listId].some(i => i.id === itemId)) {
                                nextMap[listId] = replace(nextMap[listId])
                            }
                        }
                        return {
                            currentListItems: replace(state.currentListItems),
                            itemsByListId: nextMap,
                        }
                    })
                } catch (error) {
                    console.error('[ListStore] Failed to update status:', error)
                    throw error
                }
            },

            updateListItemMetadata: async (itemId, metadata) => {
                const { isOnline } = useOfflineStore.getState()

                // Optimistic update
                set(state => {
                    const patch = (items: ListItem[]) =>
                        items.map(i => i.id === itemId ? { ...i, metadata } : i)
                    const nextMap: Record<string, ListItem[]> = { ...state.itemsByListId }
                    for (const listId of Object.keys(nextMap)) {
                        if (nextMap[listId].some(i => i.id === itemId)) {
                            nextMap[listId] = patch(nextMap[listId])
                        }
                    }
                    return {
                        currentListItems: patch(state.currentListItems),
                        itemsByListId: nextMap,
                    }
                })

                // If offline, queue operation
                if (!isOnline) {
                    await queueOperation('update_list_item', { id: itemId, metadata })
                    await useOfflineStore.getState().updateQueueSize()
                    console.log('[ListStore] Queued metadata update for offline sync')
                    return
                }

                // Update via API when online
                try {
                    const response = await fetch(`/api/lists?scope=items&id=${itemId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ metadata })
                    })

                    if (!response.ok) {
                        throw new Error('Failed to update item metadata')
                    }

                    const updatedItem = await response.json()

                    // Update with server response
                    set(state => {
                        const replace = (items: ListItem[]) =>
                            items.map(i => i.id === itemId ? updatedItem : i)
                        const nextMap: Record<string, ListItem[]> = { ...state.itemsByListId }
                        for (const listId of Object.keys(nextMap)) {
                            if (nextMap[listId].some(i => i.id === itemId)) {
                                nextMap[listId] = replace(nextMap[listId])
                            }
                        }
                        return {
                            currentListItems: replace(state.currentListItems),
                            itemsByListId: nextMap,
                        }
                    })
                } catch (error) {
                    console.error('[ListStore] Failed to update metadata:', error)
                    throw error
                }
            },

            deleteListItem: async (itemId, listId) => {
                const { isOnline } = useOfflineStore.getState()
                const previousItems = get().currentListItems
                const previousLists = get().lists
                const previousMap = get().itemsByListId

                // Optimistic Delete
                set(state => {
                    const remove = (items: ListItem[]) => items.filter(i => i.id !== itemId)
                    const listItems = state.itemsByListId[listId]
                    return {
                        currentListItems: remove(state.currentListItems),
                        itemsByListId: listItems
                            ? { ...state.itemsByListId, [listId]: remove(listItems) }
                            : state.itemsByListId,
                        lists: state.lists.map(l =>
                            l.id === listId
                                ? { ...l, item_count: Math.max(0, (l.item_count || 0) - 1) }
                                : l
                        )
                    }
                })

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
                    const response = await fetch(`/api/lists?scope=items&id=${itemId}`, {
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
                        itemsByListId: previousMap,
                        lists: previousLists,
                        error: error.message
                    })
                }
            },

            updateList: async (listId, updates) => {
                // Optimistic update
                set(state => ({
                    lists: state.lists.map(l =>
                        l.id === listId ? { ...l, ...updates } : l
                    )
                }))

                try {
                    const response = await fetch('/api/lists', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: listId, ...updates })
                    })
                    if (!response.ok) throw new Error('Failed to update list')
                    const updatedList = await response.json()
                    set(state => ({
                        lists: state.lists.map(l => l.id === listId ? { ...l, ...updatedList } : l)
                    }))
                } catch (error) {
                    console.error('[ListStore] Failed to update list:', error)
                    throw error
                }
            },

            updateListSettings: async (listId, settings) => {
                // Optimistic update
                set(state => ({
                    lists: state.lists.map(l =>
                        l.id === listId ? { ...l, settings: { ...l.settings, ...settings } } : l
                    )
                }))

                try {
                    const response = await fetch('/api/lists', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: listId, settings })
                    })
                    if (!response.ok) throw new Error('Failed to update list settings')
                    const updatedList = await response.json()
                    set(state => ({
                        lists: state.lists.map(l => l.id === listId ? { ...l, ...updatedList } : l)
                    }))
                } catch (error) {
                    console.error('[ListStore] Failed to update list settings:', error)
                    throw error
                }
            },

            deleteList: async (listId) => {
                const { isOnline } = useOfflineStore.getState()
                const previousLists = get().lists
                const previousMap = get().itemsByListId
                set(state => {
                    const nextMap = { ...state.itemsByListId }
                    delete nextMap[listId]
                    return {
                        lists: state.lists.filter(l => l.id !== listId),
                        itemsByListId: nextMap,
                        // Clear current view if it's the deleted list
                        ...(state.currentListId === listId
                            ? { currentListId: null, currentListItems: [] }
                            : {}),
                    }
                })

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
                    set({
                        lists: previousLists,
                        itemsByListId: previousMap,
                        error: error.message,
                    })
                }
            },

            reorderItems: async (listId, itemIds) => {
                const { isOnline } = useOfflineStore.getState()

                // Optimistic
                const currentItems = get().currentListItems
                const previousMap = get().itemsByListId
                const newItems = [...currentItems].sort((a, b) => {
                    const indexA = itemIds.indexOf(a.id)
                    const indexB = itemIds.indexOf(b.id)
                    return indexA - indexB
                })
                set(state => ({
                    currentListItems: newItems,
                    itemsByListId: { ...state.itemsByListId, [listId]: newItems },
                }))

                // If offline, queue operation
                if (!isOnline) {
                    await queueOperation('reorder_list_items', { listId, itemIds })
                    await useOfflineStore.getState().updateQueueSize()
                    console.log('[ListStore] Queued reorder_list_items for offline sync')
                    return
                }

                try {
                    const response = await fetch(`/api/lists?scope=items&resource=reorder&listId=${listId}`, {
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
                    set({
                        currentListItems: currentItems,
                        itemsByListId: previousMap,
                        error: error.message,
                    })
                }
            },

            reorderLists: async (listIds) => {
                const { isOnline } = useOfflineStore.getState()

                // Optimistic reorder - update both order AND sort_order property
                const currentLists = get().lists
                const newLists = [...currentLists]
                    .sort((a, b) => {
                        const indexA = listIds.indexOf(a.id)
                        const indexB = listIds.indexOf(b.id)
                        return indexA - indexB
                    })
                    .map((list, index) => ({
                        ...list,
                        sort_order: index
                    }))
                set({ lists: newLists })

                // If offline, queue operation
                if (!isOnline) {
                    await queueOperation('reorder_lists', { listIds })
                    await useOfflineStore.getState().updateQueueSize()
                    console.log('[ListStore] Queued reorder_lists for offline sync')
                    return
                }

                try {
                    const response = await fetch('/api/lists?resource=reorder', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ listIds })
                    })
                    if (!response.ok) throw new Error('Failed to reorder lists')
                } catch (error: any) {
                    // If network error, queue for later
                    if (!navigator.onLine) {
                        await queueOperation('reorder_lists', { listIds })
                        await useOfflineStore.getState().updateQueueSize()
                        console.log('[ListStore] Queued reorder_lists after failed attempt')
                        return
                    }
                    set({ lists: currentLists, error: error.message })
                }
            }
        }),
        {
            name: 'aperture-lists-store',
            // Persist both the lists and the per-list items cache so a full
            // page reload rehydrates instantly with zero loading flicker.
            // Dexie is still used as a secondary / offline cache layer.
            partialize: (state) => ({
                lists: state.lists,
                itemsByListId: state.itemsByListId,
            }),
        }
    )
)
