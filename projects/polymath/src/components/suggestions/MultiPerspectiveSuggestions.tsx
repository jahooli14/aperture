import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { useMultiPerspectiveAI, type PerspectiveSuggestion } from '../../hooks/useMultiPerspectiveAI'
import { MarkdownRenderer } from '../ui/MarkdownRenderer'
import type { Project } from '../../types'
import { Database } from 'lucide-react'

interface MultiPerspectiveSuggestionsProps {
  project: Project
  relatedMemories?: string[]
  onAddTodo?: (text: string) => void
}

const ACCENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  red:     { bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)',    text: 'rgb(252,165,165)',  dot: 'rgb(239,68,68)' },
  blue:    { bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.25)',   text: 'rgb(147,197,253)',  dot: 'rgb(59,130,246)' },
  orange:  { bg: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.25)',   text: 'rgb(253,186,116)',  dot: 'rgb(249,115,22)' },
  pink:    { bg: 'rgba(236,72,153,0.08)',   border: 'rgba(236,72,153,0.25)',   text: 'rgb(249,168,212)',  dot: 'rgb(236,72,153)' },
  emerald: { bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.25)',   text: 'rgb(110,231,183)',  dot: 'rgb(16,185,129)' },
}

function SkeletonPerspective({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="p-4 rounded-xl border"
      style={{
        background: 'var(--glass-surface)',
        borderColor: 'var(--glass-surface)'
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-xl bg-[rgba(255,255,255,0.1)] animate-pulse" />
        <div className="h-3.5 w-32 rounded-xl bg-[rgba(255,255,255,0.1)] animate-pulse" />
        <div className="ml-auto h-3 w-10 rounded-xl bg-[var(--glass-surface)] animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded-xl bg-white/8 animate-pulse" />
        <div className="h-3 w-4/5 rounded-xl bg-white/8 animate-pulse" />
        <div className="h-3 w-3/5 rounded-xl bg-white/8 animate-pulse" />
      </div>
    </motion.div>
  )
}

function PerspectiveCard({
  perspective,
  index,
  onAddTodo
}: {
  perspective: PerspectiveSuggestion
  index: number
  onAddTodo?: (text: string) => void
}) {
  const [added, setAdded] = useState(false)
  const colors = ACCENT_COLORS[perspective.accentColor] || ACCENT_COLORS.blue

  const handleAdd = () => {
    if (onAddTodo) {
      onAddTodo(perspective.suggestion)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: 'easeOut' }}
      className="p-4 rounded-xl border transition-all duration-200"
      style={{
        background: colors.bg,
        borderColor: colors.border
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Persona header */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: colors.text }}>
              {perspective.persona}
            </span>
            {perspective.confidence === 'high' && (
              <span
                className="ml-auto px-1.5 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1"
                style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
              >
                High
              </span>
            )}
          </div>

          <MarkdownRenderer
            content={perspective.suggestion}
            className="text-sm aperture-body"
            style={{ color: "var(--brand-primary)" }}
          />
        </div>
      </div>

      {/* Add to todos button */}
      {onAddTodo && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleAdd}
            disabled={added}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:opacity-90"
            style={{
              background: added ? colors.bg : 'var(--glass-surface)',
              border: `1px solid ${added ? colors.border : 'var(--glass-surface-hover)'}`,
              color: added ? colors.text : 'var(--brand-text-secondary)'
            }}
          >
            {added ? (
              "Added"
            ) : (
              "Add to todos"
            )}
          </button>
        </div>
      )}
    </motion.div>
  )
}

export function MultiPerspectiveSuggestions({
  project,
  relatedMemories = [],
  onAddTodo
}: MultiPerspectiveSuggestionsProps) {
  const { loading, result, error, generate, clearCache } = useMultiPerspectiveAI()
  const [showAll, setShowAll] = useState(false)
  const [hasRequested, setHasRequested] = useState(false)

  const handleGenerate = async () => {
    setHasRequested(true)
    await generate({ project, relatedMemories })
  }

  const handleRefresh = async () => {
    clearCache(project.id)
    await generate({ project, relatedMemories })
  }

  const perspectives = result?.perspectives || []
  const visiblePerspectives = showAll ? perspectives : perspectives.slice(0, 3)
  const hiddenCount = perspectives.length - 3

  // Initial "trigger" state  user hasn't asked yet
  if (!hasRequested && !loading && !result) {
    return (
      <div
        className="rounded-3xl border overflow-hidden premium-glass shadow-2xl transition-all duration-500 hover:border-indigo-500/30"
        style={{
          background: 'radial-gradient(circle at 0% 0%, rgba(139,92,246,0.1), transparent), radial-gradient(circle at 100% 100%, rgba(59,130,246,0.1), transparent)',
          borderColor: 'var(--glass-border)'
        }}
      >
        <div className="p-8">
          <div className="mb-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2 block">Heuristic Engine</span>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] mb-1">
              The Council
            </h3>
            <p className="text-sm text-[var(--brand-text-muted)] leading-relaxed">
              Five different voices on what to do next.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            className="group relative w-full py-4 rounded-2xl overflow-hidden transition-all active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/40 to-blue-600/40 opacity-70 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 border border-white/10 rounded-2xl" />
            <span className="relative text-xs font-black uppercase tracking-[0.2em] text-white">Assemble the Council</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-3xl border overflow-hidden premium-glass shadow-2xl"
      style={{
        background: 'radial-gradient(circle at 100% 0%, rgba(139,92,246,0.08), transparent)',
        borderColor: 'var(--glass-border)'
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base"></span>
          <h3 className="font-bold text-sm aperture-header" style={{ color: "var(--brand-primary)" }}>
            What's Next?
          </h3>
          {result?.lakeContext && (
            <div className="flex items-center gap-1 opacity-50" title={`Knowledge lake: ${result.lakeContext.memoriesUsed} notes, ${result.lakeContext.articlesUsed} articles, ${result.lakeContext.projectsUsed} projects`}>
              <Database className="h-3 w-3 text-cyan-400" />
              <span className="text-[10px] text-cyan-400 font-medium">
                {result.lakeContext.memoriesUsed + result.lakeContext.articlesUsed + result.lakeContext.projectsUsed}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-[var(--glass-surface)]"
          style={{ color: 'var(--brand-text-muted)', border: '1px solid var(--glass-surface)' }}
          title="Regenerate all perspectives"
        >
          {loading ? 'Thinking...' : 'Refresh'}
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 space-y-3">
        {/* Loading skeletons */}
        {loading && (
          <>
            {[0, 1, 2, 3, 4].map(i => (
              <SkeletonPerspective key={i} delay={i * 0.08} />
            ))}
            <p className="text-center text-xs py-1" style={{ color: "var(--brand-primary)" }}>
              Your advisors are thinking...
            </p>
          </>
        )}

        {/* Error state */}
        {error && !loading && (
          <div
            className="p-4 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: "var(--brand-text-secondary)" }}
          >
            <p className="font-bold mb-1">Failed to generate suggestions</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        )}

        {/* Perspective cards */}
        {!loading && result && (
          <AnimatePresence>
            {visiblePerspectives.map((perspective, index) => (
              <PerspectiveCard
                key={perspective.persona}
                perspective={perspective}
                index={index}
                onAddTodo={onAddTodo}
              />
            ))}
          </AnimatePresence>
        )}

        {/* Show more / less toggle */}
        {!loading && result && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-[var(--glass-surface)]"
            style={{ color: 'var(--brand-text-muted)', border: '1px solid var(--glass-surface)' }}
          >
            {showAll ? (
              "Show less"
            ) : (
              `Show all ${perspectives.length} perspectives`
            )}
          </button>
        )}

        {/* Synthesized summary */}
        {!loading && result?.synthesized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-1 px-4 py-3 rounded-xl"
            style={{
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <MarkdownRenderer
              content={`**Council synthesis:** ${result.synthesized}`}
              className="text-xs italic"
              style={{ color: 'var(--brand-text-secondary)' }}
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}
