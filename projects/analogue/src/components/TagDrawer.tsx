import { X, Tag as TagIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TagDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTag: string | null
  onTagSelect: (tag: string) => void
  availableTags: string[]
}

export function TagDrawer({ isOpen, onClose, activeTag, onTagSelect, availableTags }: TagDrawerProps) {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-gray-700" />
                <h2 className="font-semibold text-gray-800">Tag Words</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-blue-50 border-b border-blue-100">
              <p className="text-sm text-blue-800">
                {activeTag ? (
                  <>
                    <span className="font-semibold">"{activeTag}"</span> is active. Select text in the editor to tag it.
                  </>
                ) : (
                  'Select a tag below, then highlight text in the editor to apply it.'
                )}
              </p>
            </div>

            {/* Tag List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {availableTags.map((tag) => {
                  const isActive = tag === activeTag
                  return (
                    <button
                      key={tag}
                      onClick={() => onTagSelect(isActive ? '' : tag)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                        isActive
                          ? `${getTagColor(tag)} ring-2 ring-offset-2 ring-blue-400 scale-105`
                          : `${getTagColor(tag)} opacity-70 hover:opacity-100 hover:scale-102`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{tag}</span>
                        {isActive && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 bg-blue-600 rounded-full"
                          />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            {activeTag && (
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => onTagSelect('')}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                >
                  Deactivate Tag
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
