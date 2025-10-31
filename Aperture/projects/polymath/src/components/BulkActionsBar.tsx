import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Archive, Trash2, Tag, Folder } from 'lucide-react'

interface BulkActionsBarProps {
  selectedCount: number
  onCancel: () => void
  actions: Array<{
    label: string
    icon: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'destructive'
    loading?: boolean
  }>
}

export function BulkActionsBar({ selectedCount, onCancel, actions }: BulkActionsBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:max-w-md"
        >
          <div
            className="premium-glass-subtle rounded-2xl p-4 shadow-2xl"
            style={{
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(20, 27, 38, 0.95)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--premium-blue)',
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <Check className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: 'var(--premium-text-primary)' }}
                  >
                    {selectedCount} selected
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--premium-text-tertiary)' }}
                  >
                    Choose an action below
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-2 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: 'var(--premium-text-secondary)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={action.loading}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: action.variant === 'destructive'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(59, 130, 246, 0.15)',
                    color: action.variant === 'destructive'
                      ? '#ef4444'
                      : 'var(--premium-blue)',
                    border: `1px solid ${action.variant === 'destructive' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                  }}
                >
                  {action.loading ? (
                    <div
                      className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"
                    />
                  ) : (
                    action.icon
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
