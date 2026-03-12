/**
 * Ambient AI Linker
 *
 * Runs silently in the background. Whenever a new item is added to any store,
 * it fires the AI linker to find connections across the entire knowledge graph.
 *
 * The Gemini model is cheap enough to run on every new piece of content 
 * this is the "always on" linking that ties everything together.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useReadingStore } from '../stores/useReadingStore'
import { useTodoStore } from '../stores/useTodoStore'
import { useListStore } from '../stores/useListStore'

export interface DiscoveredLink {
  id: string
  type: string
  title: string
  reasoning: string
  connectionType: string
  autoLinked: boolean
  similarity: number
}

export interface Discovery {
  sourceId: string
  sourceType: string
  sourceTitle: string
  links: DiscoveredLink[]
  timestamp: number
}

// Module-level state shared across hook instances
let discoveries: Discovery[] = []
const listeners = new Set<(d: Discovery[]) => void>()
const processing = new Set<string>()

function notify() {
  listeners.forEach(fn => fn([...discoveries]))
}

function addDiscovery(d: Discovery) {
  discoveries = [d, ...discoveries].slice(0, 20) // Keep last 20
  notify()
}

async function runLinker(
  itemId: string,
  itemType: string,
  content: string,
  title: string
) {
  const key = `${itemType}:${itemId}`
  if (processing.has(key)) return
  processing.add(key)

  try {
    const res = await fetch('/api/connections?action=link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, itemType, content })
    })

    if (!res.ok) return

    const data = await res.json()

    if (data.connections && data.connections.length > 0) {
      addDiscovery({
        sourceId: itemId,
        sourceType: itemType,
        sourceTitle: title,
        links: data.connections,
        timestamp: Date.now()
      })
    }
  } catch {
    // Silent fail  ambient linking should never disrupt UX
  } finally {
    processing.delete(key)
  }
}

// Determines if an item is "fresh" (created within the last 60 seconds)
function isFresh(createdAt?: string | null): boolean {
  if (!createdAt) return false
  return Date.now() - new Date(createdAt).getTime() < 60_000
}

export function useAmbientLinker() {
  const [localDiscoveries, setLocalDiscoveries] = useState<Discovery[]>([...discoveries])
  const processed = useRef(new Set<string>())

  // Subscribe to discovery updates
  useEffect(() => {
    const listener = (d: Discovery[]) => setLocalDiscoveries(d)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  // Watch memories
  const memories = useMemoryStore(s => s.memories)
  useEffect(() => {
    const latest = memories[0]
    if (!latest) return
    const key = `thought:${latest.id}`
    if (processed.current.has(key)) return
    if (!isFresh(latest.created_at)) return
    processed.current.add(key)
    const content = [latest.title, latest.body].filter(Boolean).join('. ')
    runLinker(
      latest.id,
      'thought',
      content,
      latest.title || latest.body?.slice(0, 50) || 'Memory'
    )
  }, [memories])

  // Watch projects
  const allProjects = useProjectStore(s => s.allProjects)
  useEffect(() => {
    const sorted = [...allProjects].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    const latest = sorted[0]
    if (!latest) return
    const key = `project:${latest.id}`
    if (processed.current.has(key)) return
    if (!isFresh(latest.created_at)) return
    processed.current.add(key)
    const content = [latest.title, latest.description].filter(Boolean).join('. ')
    runLinker(latest.id, 'project', content, latest.title || 'Project')
  }, [allProjects])

  // Watch articles
  const articles = useReadingStore(s => s.articles)
  useEffect(() => {
    const sorted = [...articles].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    const latest = sorted[0]
    if (!latest) return
    const key = `article:${latest.id}`
    if (processed.current.has(key)) return
    if (!isFresh(latest.created_at)) return
    processed.current.add(key)
    const content = [latest.title, latest.excerpt].filter(Boolean).join('. ')
    runLinker(latest.id, 'article', content, latest.title || 'Article')
  }, [articles])

  // Watch todos
  const todos = useTodoStore(s => s.todos)
  useEffect(() => {
    const sorted = [...todos].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    const latest = sorted[0]
    if (!latest) return
    const key = `todo:${latest.id}`
    if (processed.current.has(key)) return
    if (!isFresh(latest.created_at)) return
    processed.current.add(key)
    runLinker(latest.id, 'todo', latest.text, latest.text)
  }, [todos])

  // Watch list items (items in the currently open list)
  const currentListItems = useListStore(s => s.currentListItems)
  useEffect(() => {
    const sorted = [...currentListItems].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    const latest = sorted[0]
    if (!latest) return
    const key = `list_item:${latest.id}`
    if (processed.current.has(key)) return
    if (!isFresh(latest.created_at)) return
    processed.current.add(key)
    const content = [latest.content, latest.metadata?.description].filter(Boolean).join('. ')
    runLinker(latest.id, 'list_item', content, latest.content || 'List item')
  }, [currentListItems])

  const clearDiscoveries = useCallback(() => {
    discoveries = []
    notify()
  }, [])

  const dismissDiscovery = useCallback((timestamp: number) => {
    discoveries = discoveries.filter(d => d.timestamp !== timestamp)
    notify()
  }, [])

  return { discoveries: localDiscoveries, clearDiscoveries, dismissDiscovery }
}
