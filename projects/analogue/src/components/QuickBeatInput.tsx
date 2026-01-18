import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Check, X } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { SceneNode } from '../types/manuscript'

interface QuickBeatInputProps {
  scene: SceneNode
}

export default function QuickBeatInput({ scene }: QuickBeatInputProps) {
  const { updateScene } = useManuscriptStore()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(scene.sceneBeat || '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Show prompt if no beat set
  const isEmpty = !scene.sceneBeat || scene.sceneBeat.trim() === ''

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  useEffect(() => {
    setValue(scene.sceneBeat || '')
  }, [scene.sceneBeat])

  const handleSave = () => {
    const trimmed = value.trim()
    updateScene(scene.id, { sceneBeat: trimmed || null })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setValue(scene.sceneBeat || '')
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div
      className="px-3 py-1.5 border-b border-ink-800 bg-ink-900/30"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What happens in this scene? (one sentence)"
              className="flex-1 bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-xs text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-ink-600"
              maxLength={150}
            />
            <button
              onClick={handleSave}
              className="p-1.5 rounded bg-status-green/20 text-status-green hover:bg-status-green/30"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded bg-ink-800 text-ink-400 hover:bg-ink-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsEditing(true)}
            className={`w-full flex items-center gap-2 text-left group ${
              isEmpty ? 'text-ink-500' : 'text-ink-300'
            }`}
          >
            <Pencil className={`w-3 h-3 flex-shrink-0 ${isEmpty ? 'text-ink-600' : 'text-ink-500'} group-hover:text-ink-400`} />
            <span className={`text-xs truncate ${isEmpty ? 'italic' : ''}`}>
              {isEmpty ? 'What happens in this scene?' : scene.sceneBeat}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
