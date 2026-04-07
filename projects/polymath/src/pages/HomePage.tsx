/**
 * Home Page — Polymath: Your Hour
 *
 * Structure (top to bottom):
 *   1. YourHourHeader — Brand + duration toggle + search
 *   2. Keep Going carousel — Focused projects with "Start session"
 *   3. Try Something New carousel — Ideas to shape
 *   4. Unshaped nudge bar — Projects needing shaping
 *   5. What You're Consuming — active list items (compact)
 *   6. Thought of the Day — resurfaced memory quote
 *   7. Bedtime floating icon — appears after 9:30pm
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore } from '../stores/useProjectStore'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useListStore } from '../stores/useListStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { useJourneyStore } from '../stores/useJourneyStore'
import { SubtleBackground } from '../components/SubtleBackground'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { ShapingModal } from '../components/projects/ShapingModal'
import { YourHourHeader } from '../components/home/YourHourHeader'
import { KeepGoingCarousel } from '../components/home/KeepGoingCarousel'
import { TrySomethingNewCarousel, type IdeaItem } from '../components/home/TrySomethingNewCarousel'
import { UnshapedNudgeBar } from '../components/home/UnshapedNudgeBar'
import { ThoughtOfTheDay } from '../components/home/ThoughtOfTheDay'
import { BedtimeFloatingIcon } from '../components/home/BedtimeFloatingIcon'
import { AlertCircle, ArrowRight, Film, Music, Monitor, Book, MapPin, Gamepad2, Calendar, FileText, Quote, Box } from 'lucide-react'

const LIST_TYPE_ICONS: Record<string, React.ElementType> = {
  film: Film, music: Music, tech: Monitor, book: Book, place: MapPin,
  game: Gamepad2, event: Calendar, quote: Quote, article: FileText,
  software: Monitor, generic: Box,
}

function NowConsumingWidget() {
  const lists = useListStore(s => s.lists)
  const fetchLists = useListStore(s => s.fetchLists)
  const [activeItems, setActiveItems] = useState<{ listId: string; listTitle: string; listType: string; itemId: string; itemContent: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (lists.length === 0) fetchLists()
  }, [lists.length, fetchLists])

  useEffect(() => {
    if (lists.length === 0) return
    const fetchActiveItems = async () => {
      const results: typeof activeItems = []
      for (const list of lists.slice(0, 10)) {
        try {
          const res = await fetch(`/api/lists?scope=items&listId=${list.id}&limit=10`)
          if (!res.ok) continue
          const items = await res.json()
          for (const item of items) {
            if (item.status === 'active') {
              results.push({ listId: list.id, listTitle: list.title, listType: list.type, itemId: item.id, itemContent: item.content })
            }
          }
        } catch {}
      }
      setActiveItems(results)
      setLoaded(true)
    }
    fetchActiveItems()
  }, [lists])

  if (!loaded || activeItems.length === 0) return null

  const shown = activeItems.slice(0, 4)

  return (
    <section className="pb-6">
      <h2 className="section-header">what you're <span>consuming</span></h2>
      <div className="flex flex-col gap-1 p-3 rounded-2xl" style={{ background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.08)' }}>
        {shown.map((item) => {
          const Icon = LIST_TYPE_ICONS[item.listType] || Box
          return (
            <Link
              key={item.itemId}
              to={`/lists/${item.listId}`}
              className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-[rgba(245,158,11,0.06)]"
            >
              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-[var(--brand-text-secondary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--brand-text-primary)] truncate">{item.itemContent}</p>
                <p className="text-[10px] text-[var(--brand-text-secondary)] opacity-50">{item.listTitle}</p>
              </div>
              <ArrowRight className="h-3 w-3 text-[var(--brand-text-secondary)] opacity-30 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function HomePage() {
  const fetchProjects = useProjectStore(s => s.fetchProjects)
  const projects = useProjectStore(s => s.projects)
  const fetchSuggestions = useSuggestionStore(s => s.fetchSuggestions)
  const fetchMemories = useMemoryStore(s => s.fetchMemories)
  const setContext = useContextEngineStore(s => s.setContext)
  const onboardingCompletedAt = useJourneyStore(s => s.onboardingCompletedAt)
  const startSession = useJourneyStore(s => s.startSession)

  const [error, setError] = useState<string | null>(null)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [seedConversation, setSeedConversation] = useState<{ title: string; description: string } | undefined>()
  const [shapingProjectId, setShapingProjectId] = useState<string | null>(null)

  const shapingProject = shapingProjectId
    ? useProjectStore.getState().allProjects.find(p => p.id === shapingProjectId) || null
    : null

  useEffect(() => {
    setContext('home', 'home', 'Home')
    if (onboardingCompletedAt) startSession()
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        if (projects.length === 0) {
          await fetchProjects()
        } else {
          fetchProjects()
        }
        fetchSuggestions()
        fetchMemories()
      } catch (err) {
        console.error('Failed to load data on mount:', err)
      }
    }
    loadData()
  }, [])

  const handleShapeIdea = (idea: IdeaItem) => {
    setSeedConversation({ title: idea.title, description: idea.description })
    setCreateProjectOpen(true)
  }

  const handleShapeProject = (projectId: string) => {
    setShapingProjectId(projectId)
  }

  if (error) {
    return (
      <div className="min-h-screen py-12 px-4 flex items-center justify-center" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="max-w-2xl w-full p-8 border-red-500/20 bg-brand-primary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-text-secondary">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold premium-text-platinum">Something went wrong</h2>
          </div>
          <p className="text-brand-text-secondary mb-8 font-mono text-sm p-4 bg-black/30 rounded-lg border border-red-500/10">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-lg bg-brand-primary text-[var(--brand-text-primary)] font-bold hover:bg-brand-primary transition-colors">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      <SubtleBackground />

      <div className="min-h-screen pb-24 pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <YourHourHeader />

          {/* Keep Going */}
          <div className="mb-8">
            <KeepGoingCarousel />
          </div>

          {/* Try Something New */}
          <div className="mb-8">
            <TrySomethingNewCarousel onShapeIdea={handleShapeIdea} />
          </div>

          {/* Unshaped nudge */}
          <div className="mb-8">
            <UnshapedNudgeBar onShapeProject={handleShapeProject} />
          </div>

          {/* What you're consuming */}
          <NowConsumingWidget />

          {/* Thought of the day */}
          <ThoughtOfTheDay />

        </div>
      </div>

      {/* Bedtime floating icon — appears after 9:30pm */}
      <BedtimeFloatingIcon />

      {/* Shaping modal for existing unshaped projects */}
      {shapingProject && (
        <ShapingModal
          project={shapingProject}
          isOpen={!!shapingProjectId}
          onClose={() => setShapingProjectId(null)}
        />
      )}

      {/* Create/Shape project dialog */}
      <CreateProjectDialog
        isOpen={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        hideTrigger
        seedConversation={seedConversation ? [
          { role: 'model' as const, content: `Let's shape this idea: "${seedConversation.title}". ${seedConversation.description}\n\nTell me more — what excites you about this?` }
        ] : undefined}
      />
    </motion.div>
  )
}
