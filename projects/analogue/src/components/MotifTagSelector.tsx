import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Hash, Plus, X } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { SceneNode } from '../types/manuscript'

interface MotifTagSelectorProps {
  scene: SceneNode
  allScenes: SceneNode[]
}

// Common motifs for this book's themes
const suggestedMotifs = [
  'glasses',
  'door',
  'drift',
  'postman',
  'villager',
  'identity',
  'recovery',
  'threshold',
  'mask',
  'anchor'
]

export default function MotifTagSelector({ scene, allScenes }: MotifTagSelectorProps) {
  const { updateScene } = useManuscriptStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newMotif, setNewMotif] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Get all unique motifs from the manuscript
  const allMotifs = Array.from(
    new Set([
      ...suggestedMotifs,
      ...allScenes.flatMap(s => s.motifTags || [])
    ])
  ).sort()

  // Motifs not yet in this scene
  const availableMotifs = allMotifs.filter(
    m => !(scene.motifTags || []).includes(m)
  )

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const addMotif = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return

    const current = scene.motifTags || []
    if (current.includes(trimmed)) return

    updateScene(scene.id, { motifTags: [...current, trimmed] })
    setNewMotif('')
    setIsAdding(false)
  }

  const removeMotif = (tag: string) => {
    const current = scene.motifTags || []
    updateScene(scene.id, { motifTags: current.filter(t => t !== tag) })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addMotif(newMotif)
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setNewMotif('')
    }
  }

  const motifs = scene.motifTags || []

  return (
    <div
      className="px-4 py-2 border-b border-ink-800 bg-ink-900/30"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Hash className="w-3 h-3 text-ink-500" />
        <span className="text-[10px] text-ink-500 uppercase tracking-wider">Motifs & Threads</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* Existing motif tags */}
        {motifs.map(tag => (
          <motion.span
            key={tag}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-ink-800 text-ink-300 border border-ink-700"
          >
            <span className="text-ink-500">#</span>
            <span>{tag}</span>
            <button
              onClick={() => removeMotif(tag)}
              className="hover:text-ink-100"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </motion.span>
        ))}

        {/* Add motif UI */}
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="input"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex items-center gap-1"
            >
              <input
                ref={inputRef}
                type="text"
                value={newMotif}
                onChange={(e) => setNewMotif(e.target.value.toLowerCase())}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newMotif.trim()) {
                    setIsAdding(false)
                  }
                }}
                placeholder="motif"
                className="w-20 bg-ink-800 border border-ink-700 rounded px-2 py-0.5 text-[10px] text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-ink-600"
                list="motif-suggestions"
              />
              <datalist id="motif-suggestions">
                {availableMotifs.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </motion.div>
          ) : (
            <motion.button
              key="add-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] border border-dashed border-ink-700 text-ink-500 hover:border-ink-600 hover:text-ink-400"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Tag</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Quick add suggestions */}
        {isAdding && availableMotifs.length > 0 && newMotif === '' && (
          <div className="flex items-center gap-1 ml-1 overflow-x-auto">
            {availableMotifs.slice(0, 4).map(tag => (
              <button
                key={tag}
                onClick={() => addMotif(tag)}
                className="px-1.5 py-0.5 rounded text-[9px] bg-ink-800 text-ink-400 hover:bg-ink-700 whitespace-nowrap"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
