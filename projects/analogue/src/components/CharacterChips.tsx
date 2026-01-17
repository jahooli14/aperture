import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, X } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { SceneNode } from '../types/manuscript'

interface CharacterChipsProps {
  scene: SceneNode
  allScenes: SceneNode[]
}

// Pre-defined character colors for consistency
const characterColors = [
  'bg-section-departure/30 text-section-departure border-section-departure/50',
  'bg-section-escape/30 text-section-escape border-section-escape/50',
  'bg-section-rupture/30 text-section-rupture border-section-rupture/50',
  'bg-section-alignment/30 text-section-alignment border-section-alignment/50',
  'bg-section-reveal/30 text-section-reveal border-section-reveal/50',
  'bg-purple-500/30 text-purple-400 border-purple-500/50',
  'bg-pink-500/30 text-pink-400 border-pink-500/50',
  'bg-cyan-500/30 text-cyan-400 border-cyan-500/50',
]

export default function CharacterChips({ scene, allScenes }: CharacterChipsProps) {
  const { updateScene } = useManuscriptStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newCharacter, setNewCharacter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Get all unique characters from the manuscript for suggestions
  const allCharacters = Array.from(
    new Set(allScenes.flatMap(s => s.charactersPresent || []))
  ).sort()

  // Characters not yet in this scene
  const suggestedCharacters = allCharacters.filter(
    c => !(scene.charactersPresent || []).includes(c)
  )

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const getColorForCharacter = (name: string) => {
    // Consistent color based on character name hash
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return characterColors[hash % characterColors.length]
  }

  const addCharacter = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    const current = scene.charactersPresent || []
    if (current.includes(trimmed)) return

    updateScene(scene.id, { charactersPresent: [...current, trimmed] })
    setNewCharacter('')
    setIsAdding(false)
  }

  const removeCharacter = (name: string) => {
    const current = scene.charactersPresent || []
    updateScene(scene.id, { charactersPresent: current.filter(c => c !== name) })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addCharacter(newCharacter)
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setNewCharacter('')
    }
  }

  const characters = scene.charactersPresent || []

  return (
    <div
      className="px-4 py-2 border-b border-ink-800 bg-ink-900/30"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Users className="w-3 h-3 text-ink-500" />
        <span className="text-[10px] text-ink-500 uppercase tracking-wider">Characters</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* Existing character chips */}
        {characters.map(name => (
          <motion.span
            key={name}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${getColorForCharacter(name)}`}
          >
            <span className="font-medium">{name}</span>
            <button
              onClick={() => removeCharacter(name)}
              className="hover:opacity-70"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </motion.span>
        ))}

        {/* Add character UI */}
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
                value={newCharacter}
                onChange={(e) => setNewCharacter(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newCharacter.trim()) {
                    setIsAdding(false)
                  }
                }}
                placeholder="Name"
                className="w-20 bg-ink-800 border border-ink-700 rounded px-2 py-0.5 text-[10px] text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-ink-600"
                list="character-suggestions"
              />
              <datalist id="character-suggestions">
                {suggestedCharacters.map(c => (
                  <option key={c} value={c} />
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
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] border border-dashed border-ink-700 text-ink-500 hover:border-ink-600 hover:text-ink-400"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Add</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Quick add suggestions (if adding and there are suggestions) */}
        {isAdding && suggestedCharacters.length > 0 && newCharacter === '' && (
          <div className="flex items-center gap-1 ml-1">
            {suggestedCharacters.slice(0, 3).map(name => (
              <button
                key={name}
                onClick={() => addCharacter(name)}
                className="px-1.5 py-0.5 rounded text-[9px] bg-ink-800 text-ink-400 hover:bg-ink-700"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
