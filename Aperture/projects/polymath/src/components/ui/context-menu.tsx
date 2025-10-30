/**
 * Context Menu Component
 * Displays a contextual action menu, typically triggered by long-press
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  isOpen: boolean
  onClose: () => void
  title?: string
}

export function ContextMenu({ items, isOpen, onClose, title }: ContextMenuProps) {
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
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          />

          {/* Menu */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 premium-card rounded-t-2xl p-6 space-y-4"
            style={{
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              {title && (
                <h3 className="text-lg font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                  {title}
                </h3>
              )}
              <button
                onClick={onClose}
                className="ml-auto p-2 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: 'var(--premium-text-secondary)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="space-y-2">
              {items.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    item.onClick()
                    onClose()
                  }}
                  disabled={item.disabled}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: item.variant === 'destructive' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: item.variant === 'destructive' ? '#ef4444' : 'var(--premium-text-primary)',
                  }}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
