import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { List, ListItem, CreateListInput, CreateListItemInput, ListType } from '../types'

interface ListStore {
    lists: List[]
    currentListItems: ListItem[]
    loading: boolean
    error: string | null

    fetchLists: () => Promise<void>
    createList: (input: CreateListInput) => Promise<string> // Returns ID
    fetchListItems: (listId: string) => Promise<void>
    addListItem: (input: CreateListItemInput) => Promise<void>
    updateListItemStatus: (itemId: string, status: ListItem['status']) => Promise<void>
}

export const useListStore = create<ListStore>((set, get) => ({
    lists: [],
    currentListItems: [],
    loading: false,
    error: null,

    fetchLists: async () => {
        set({ loading: true })
        try {
            const response = await fetch('/api/lists')
            if (!response.ok) throw new Error('Failed to fetch lists')
            const data = await response.json()
            set({ lists: data, loading: false })
        } catch (error: any) {
            set({ error: error.message, loading: false })
        }
    },

    createList: async (input) => {
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
            // Revert on failure
            set(state => ({
                lists: state.lists.filter(l => l.id !== tempId),
                error: error.message
            }))
            return ''
        }
    },

    fetchListItems: async (listId) => {
        // set({ loading: true }) // Don't block UI with loading state for switching lists if we can help it
        try {
            const response = await fetch(`/api/list-items?listId=${listId}`)
            if (!response.ok) throw new Error('Failed to fetch items')
            const data = await response.json()
            set({ currentListItems: data })
        } catch (error: any) {
            console.error(error)
            set({ error: error.message })
        }
    },

    addListItem: async (input) => {
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
        // Optimistic
        set(state => ({
            currentListItems: state.currentListItems.map(i =>
                i.id === itemId ? { ...i, status } : i
            )
        }))

        // TODO: Implement API call for update
        // For now this serves the UI demo
    }
}))
