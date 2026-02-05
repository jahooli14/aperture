import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WordTag } from '../types/manuscript'

interface WordTagListProps {
  wordTags: WordTag[]
  onRemove: (tagId: string) => void
}

export function WordTagList({ wordTags, onRemove }: WordTagListProps) {
  const tagColors: Record<string, string> = {
    glasses: 'bg-blue-500/20 border-blue-500/40 text-blue-600',
    door: 'bg-purple-500/20 border-purple-500/40 text-purple-600',
    drift: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-600',
    postman: 'bg-green-500/20 border-green-500/40 text-green-600',
    villager: 'bg-orange-500/20 border-orange-500/40 text-orange-600',
    identity: 'bg-pink-500/20 border-pink-500/40 text-pink-600',
    recovery: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600',
    threshold: 'bg-red-500/20 border-red-500/40 text-red-600',
    mask: 'bg-violet-500/20 border-violet-500/40 text-violet-600',
    anchor: 'bg-amber-500/20 border-amber-500/40 text-amber-600',
  }

  const getTagColor = (tag: string) => {
    return tagColors[tag] || 'bg-gray-500/20 border-gray-500/40 text-gray-600'
  }

  if (wordTags.length === 0) {
    return null
  }

  return (
    <div className="p-3 bg-ink-900/50 border-t border-ink-800">
      <div className="text-xs text-ink-500 mb-2">Tagged Words in This Scene</div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {wordTags.map((wordTag) => (
            <motion.div
              key={wordTag.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className={`flex items-center gap-2 px-2 py-1 rounded-md border text-xs ${getTagColor(wordTag.tag)}`}
            >
              <span className="font-medium capitalize">{wordTag.tag}:</span>
              <span className="italic">"{wordTag.text}"</span>
              <button
                onClick={() => onRemove(wordTag.id)}
                className="ml-1 hover:bg-black/10 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
