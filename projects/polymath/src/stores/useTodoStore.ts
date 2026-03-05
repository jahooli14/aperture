/**
 * Todo Store - Zustand + Dexie offline-first
 *
 * Design: optimistic UI first, sync to server in background.
 * Every write is instant locally then persisted to Supabase.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useOfflineStore } from './useOfflineStore'

export interface TodoArea {
  id: string
  user_id: string
  name: string
  icon?: string
  color?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Todo {
  id: string
  user_id: string
  text: string
  notes?: string
  done: boolean
  deleted_at?: string
  scheduled_date?: string   // YYYY-MM-DD
  scheduled_time?: string   // HH:mm (24h)
  deadline_date?: string    // YYYY-MM-DD
  area_id?: string
  project_id?: string
  tags: string[]
  priority: number          // 0=none, 1=low, 2=med, 3=high
  estimated_minutes?: number
  source_memory_id?: string
  sort_order: number
  created_at: string
  updated_at: string
  completed_at?: string
}

export type TodoView = 'inbox' | 'today' | 'upcoming' | 'someday' | 'logbook'

interface TodoStore {
  todos: Todo[]
  areas: TodoArea[]
  loading: boolean
  areasLoading: boolean
  error: string | null
  activeView: TodoView

  setActiveView: (view: TodoView) => void

  fetchTodos: () => Promise<void>
  fetchAreas: () => Promise<void>

  addTodo: (input: Partial<Todo> & { text: string }) => Promise<Todo>
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  reorderTodos: (ids: string[]) => Promise<void>
}

function todayYMD(): string {
  return new Date().toISOString().split('T')[0]
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: [],
      areas: [],
      loading: false,
      areasLoading: false,
      error: null,
      activeView: 'inbox',

      setActiveView: (view) => set({ activeView: view }),

      // ─── Fetch ──────────────────────────────────────────────

      fetchTodos: async () => {
        const { isOnline } = useOfflineStore.getState()

        // Always try Dexie first (instant render)
        try {
          const { db } = await import('../lib/db')
          const cached = await db.getCachedTodos()
          if (cached.length > 0) {
            set({ todos: cached as unknown as Todo[] })
          }
        } catch (e) {
          console.warn('[TodoStore] Dexie read failed:', e)
        }

        if (!isOnline) return

        set({ loading: true })
        try {
          const res = await fetch('/api/todos')
          if (!res.ok) throw new Error('Failed to fetch todos')
          const data: Todo[] = await res.json()

          // Write to Dexie
          try {
            const { db } = await import('../lib/db')
            await db.cacheTodos(data as any[])
          } catch (e) {
            console.warn('[TodoStore] Dexie cache write failed:', e)
          }

          set({ todos: data, loading: false })
        } catch (err) {
          console.error('[TodoStore] Fetch failed:', err)
          set({ loading: false })
        }
      },

      fetchAreas: async () => {
        const { isOnline } = useOfflineStore.getState()

        // Dexie first
        try {
          const { db } = await import('../lib/db')
          const cached = await db.getCachedTodoAreas()
          if (cached.length > 0) {
            set({ areas: cached as unknown as TodoArea[] })
          }
        } catch (e) {
          console.warn('[TodoStore] Dexie areas read failed:', e)
        }

        if (!isOnline) return

        set({ areasLoading: true })
        try {
          const res = await fetch('/api/todos?areas=true')
          if (!res.ok) throw new Error('Failed to fetch areas')
          const data: TodoArea[] = await res.json()

          try {
            const { db } = await import('../lib/db')
            await db.cacheTodoAreas(data as any[])
          } catch (e) {
            console.warn('[TodoStore] Dexie areas cache write failed:', e)
          }

          set({ areas: data, areasLoading: false })
        } catch (err) {
          console.error('[TodoStore] Areas fetch failed:', err)
          set({ areasLoading: false })
        }
      },

      // ─── Add (optimistic) ────────────────────────────────────

      addTodo: async (input) => {
        const { isOnline } = useOfflineStore.getState()

        const optimistic: Todo = {
          id: crypto.randomUUID(),
          user_id: 'optimistic',
          text: input.text,
          notes: input.notes,
          done: false,
          scheduled_date: input.scheduled_date,
          scheduled_time: input.scheduled_time,
          deadline_date: input.deadline_date,
          area_id: input.area_id,
          project_id: input.project_id,
          tags: input.tags ?? [],
          priority: input.priority ?? 0,
          estimated_minutes: input.estimated_minutes,
          source_memory_id: input.source_memory_id,
          sort_order: input.sort_order ?? get().todos.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        // Optimistic insert
        set(s => ({ todos: [optimistic, ...s.todos] }))

        // Write to Dexie immediately
        try {
          const { db } = await import('../lib/db')
          await db.upsertTodo({ ...optimistic, cached_at: new Date().toISOString() } as any)
        } catch (e) {
          console.warn('[TodoStore] Dexie write failed:', e)
        }

        if (!isOnline) return optimistic

        try {
          const res = await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          })
          if (!res.ok) throw new Error('API error')
          const real: Todo = await res.json()

          // Replace optimistic with real
          set(s => ({
            todos: s.todos.map(t => t.id === optimistic.id ? real : t)
          }))

          try {
            const { db } = await import('../lib/db')
            await db.upsertTodo({ ...real, cached_at: new Date().toISOString() } as any)
            await db.deleteTodoFromCache(optimistic.id)
          } catch (e) { /* silent */ }

          return real
        } catch (err) {
          console.error('[TodoStore] Add failed:', err)
          // Keep optimistic item - will sync later
          return optimistic
        }
      },

      // ─── Update (optimistic) ─────────────────────────────────

      updateTodo: async (id, updates) => {
        const prev = get().todos.find(t => t.id === id)
        if (!prev) return

        // Optimistic update
        set(s => ({
          todos: s.todos.map(t => t.id === id ? { ...t, ...updates } : t)
        }))

        // Dexie write
        try {
          const { db } = await import('../lib/db')
          await db.upsertTodo({ ...prev, ...updates, cached_at: new Date().toISOString() } as any)
        } catch (e) { /* silent */ }

        const { isOnline } = useOfflineStore.getState()
        if (!isOnline) return

        try {
          const res = await fetch('/api/todos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...updates }),
          })
          if (!res.ok) throw new Error('API error')
          const real: Todo = await res.json()

          set(s => ({
            todos: s.todos.map(t => t.id === id ? real : t)
          }))
        } catch (err) {
          console.error('[TodoStore] Update failed:', err)
          // Revert optimistic
          set(s => ({
            todos: s.todos.map(t => t.id === id ? prev : t)
          }))
        }
      },

      // ─── Toggle complete (optimistic + undo-able via toast) ──

      toggleTodo: async (id) => {
        const todo = get().todos.find(t => t.id === id)
        if (!todo) return

        const nowDone = !todo.done
        await get().updateTodo(id, {
          done: nowDone,
          completed_at: nowDone ? new Date().toISOString() : undefined,
        })
      },

      // ─── Soft delete ──────────────────────────────────────────

      deleteTodo: async (id) => {
        const prev = get().todos.find(t => t.id === id)
        if (!prev) return

        // Optimistic remove
        set(s => ({ todos: s.todos.filter(t => t.id !== id) }))

        try {
          const { db } = await import('../lib/db')
          await db.deleteTodoFromCache(id)
        } catch (e) { /* silent */ }

        const { isOnline } = useOfflineStore.getState()
        if (!isOnline) return

        try {
          await fetch(`/api/todos?id=${id}`, { method: 'DELETE' })
        } catch (err) {
          console.error('[TodoStore] Delete failed:', err)
          // Restore optimistic
          set(s => ({ todos: [prev, ...s.todos] }))
        }
      },

      // ─── Reorder ──────────────────────────────────────────────

      reorderTodos: async (ids) => {
        set(s => ({
          todos: ids
            .map((id, i) => {
              const t = s.todos.find(x => x.id === id)
              return t ? { ...t, sort_order: i } : null
            })
            .filter(Boolean) as Todo[]
        }))
        // Fire-and-forget server updates
        const { isOnline } = useOfflineStore.getState()
        if (!isOnline) return
        await Promise.allSettled(
          ids.map((id, i) =>
            fetch('/api/todos', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, sort_order: i }),
            })
          )
        )
      },
    }),
    {
      name: 'polymath-todos',
      partialize: (s) => ({
        todos: s.todos,
        areas: s.areas,
        activeView: s.activeView,
      }),
    }
  )
)

// ─── Selectors ──────────────────────────────────────────────

const YMD = () => new Date().toISOString().split('T')[0]

export function selectInbox(todos: Todo[]): Todo[] {
  return todos.filter(x =>
    !x.done &&
    !x.deleted_at &&
    !x.scheduled_date &&
    !x.deadline_date &&
    !x.tags.includes('someday')
  ).sort((a, b) => a.sort_order - b.sort_order)
}

export function selectToday(todos: Todo[]): Todo[] {
  const t = YMD()
  const isOverdue = (x: Todo) => !!(x.deadline_date && x.deadline_date < t)
  return todos.filter(x =>
    !x.done &&
    !x.deleted_at &&
    (x.scheduled_date === t || x.deadline_date === t || isOverdue(x))
  ).sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1
    if (!isOverdue(a) && isOverdue(b)) return 1
    return (b.priority - a.priority) || (a.sort_order - b.sort_order)
  })
}

export function selectUpcoming(todos: Todo[]): Todo[] {
  const t = YMD()
  return todos.filter(x =>
    !x.done &&
    !x.deleted_at &&
    (
      (x.scheduled_date && x.scheduled_date > t) ||
      (!x.scheduled_date && x.deadline_date && x.deadline_date > t)
    )
  ).sort((a, b) => {
    const da = a.scheduled_date ?? a.deadline_date!
    const db = b.scheduled_date ?? b.deadline_date!
    if (da < db) return -1
    if (da > db) return 1
    return b.priority - a.priority
  })
}

export function selectSomeday(todos: Todo[]): Todo[] {
  return todos.filter(x =>
    !x.done &&
    !x.deleted_at &&
    !x.scheduled_date &&
    !x.deadline_date &&
    x.tags.includes('someday')
  ).sort((a, b) => a.sort_order - b.sort_order)
}

export function selectLogbook(todos: Todo[]): Todo[] {
  return todos.filter(x => x.done && !x.deleted_at)
    .sort((a, b) => {
      const dateA = a.completed_at ?? a.updated_at
      const dateB = b.completed_at ?? b.updated_at
      return dateB.localeCompare(dateA)
    })
}
