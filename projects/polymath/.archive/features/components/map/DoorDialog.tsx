/**
 * DoorDialog Component
 * Modal dialog for displaying door suggestion details
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Sparkles, Lightbulb, ArrowRight, X } from 'lucide-react'
import type { Door } from '../../utils/mapTypes'

interface DoorDialogProps {
  door: Door | null
  open: boolean
  onClose: () => void
  onAccept: () => void
  onDismiss: () => void
}

export function DoorDialog({ door, open, onClose, onAccept, onDismiss }: DoorDialogProps) {
  if (!door) return null

  const { type, suggestionData } = door

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            className="premium-card p-6 max-w-lg w-full mx-4 relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-opacity-80 transition-all"
              style={{ background: 'var(--premium-bg-3)' }}
            >
              <X className="h-4 w-4" style={{ color: 'var(--premium-text-secondary)' }} />
            </button>

            {/* Icon and title based on type */}
            <div className="mb-4 flex items-center gap-3">
              {type === 'new_connection' && (
                <>
                  <div className="p-3 rounded-full" style={{ background: 'var(--premium-bg-3)' }}>
                    <Link2 className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold premium-text-platinum">New connection</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                      Bridge two cities
                    </p>
                  </div>
                </>
              )}

              {type === 'new_topic' && (
                <>
                  <div className="p-3 rounded-full" style={{ background: 'var(--premium-bg-3)' }}>
                    <Sparkles className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold premium-text-platinum">New territory</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                      Found a new settlement
                    </p>
                  </div>
                </>
              )}

              {type === 'project_idea' && (
                <>
                  <div className="p-3 rounded-full" style={{ background: 'var(--premium-bg-3)' }}>
                    <Lightbulb className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold premium-text-platinum">Project opportunity</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                      Cross-domain innovation
                    </p>
                  </div>
                </>
              )}

              {type === 'bridge' && (
                <>
                  <div className="p-3 rounded-full" style={{ background: 'var(--premium-bg-3)' }}>
                    <Link2 className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold premium-text-platinum">Bridge opportunity</h3>
                    <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                      Connect distant domains
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Reason */}
            <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--premium-bg-3)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                {suggestionData.reason}
              </p>
            </div>

            {/* Details based on type */}
            {type === 'new_connection' && (
              <div className="mb-6">
                <p className="text-sm mb-2" style={{ color: 'var(--premium-text-tertiary)' }}>
                  This would connect:
                </p>
                <div className="flex items-center gap-3 justify-center">
                  <span
                    className="px-3 py-1 rounded-lg font-medium"
                    style={{ background: 'var(--premium-bg-3)', color: 'var(--premium-blue)' }}
                  >
                    {suggestionData.cityAName}
                  </span>
                  <ArrowRight className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                  <span
                    className="px-3 py-1 rounded-lg font-medium"
                    style={{ background: 'var(--premium-bg-3)', color: 'var(--premium-blue)' }}
                  >
                    {suggestionData.cityBName}
                  </span>
                </div>
                <p className="text-xs mt-2 text-center" style={{ color: 'var(--premium-text-tertiary)' }}>
                  {suggestionData.sharedItems?.length || 0} shared items
                </p>
              </div>
            )}

            {type === 'new_topic' && (
              <div className="mb-6">
                <p className="text-sm mb-2" style={{ color: 'var(--premium-text-tertiary)' }}>
                  Found {suggestionData.itemCount} items:
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {suggestionData.items?.slice(0, 5).map((item: any) => (
                    <div
                      key={item.id}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: 'var(--premium-bg-3)', color: 'var(--premium-text-secondary)' }}
                    >
                      {item.title}
                    </div>
                  ))}
                  {suggestionData.items?.length > 5 && (
                    <div
                      className="text-xs px-2 py-1 rounded text-center"
                      style={{ color: 'var(--premium-text-tertiary)' }}
                    >
                      +{suggestionData.items.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {type === 'project_idea' && (
              <div className="mb-6">
                <div
                  className="p-3 rounded-lg text-center"
                  style={{ background: 'var(--premium-bg-3)', borderLeft: '3px solid var(--premium-gold)' }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                    {suggestionData.suggestion}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onAccept}
                className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, var(--premium-gold), #d97706)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)'
                }}
              >
                Open This Door
              </button>
              <button
                onClick={onDismiss}
                className="px-4 py-3 rounded-lg font-medium transition-all hover:bg-opacity-80"
                style={{
                  background: 'var(--premium-bg-3)',
                  color: 'var(--premium-text-secondary)'
                }}
              >
                Not Now
              </button>
            </div>

            {/* Glowing border animation */}
            <motion.div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                border: '2px solid transparent',
                background: 'linear-gradient(var(--premium-bg-2), var(--premium-bg-2)) padding-box, linear-gradient(135deg, var(--premium-gold), var(--premium-blue)) border-box'
              }}
              animate={{
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
