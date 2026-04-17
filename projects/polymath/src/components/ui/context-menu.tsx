/**
 * Context Menu — mobile-first action sheet.
 * Triggered by long-press on a card. Portaled to body so it escapes any
 * ancestor `transform` (e.g. Framer Motion `layout`) that would otherwise
 * trap a fixed-position sheet inside a grid column.
 */

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

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
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const destructive = items.filter(i => i.variant === 'destructive')
  const regular = items.filter(i => i.variant !== 'destructive')

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[25000] flex items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 420, mass: 0.6 }}
            className="relative w-full z-10 overflow-hidden"
            style={{
              background: 'linear-gradient(to top, #0d0d10, #111116)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '24px 24px 0 0',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
              maxHeight: '85vh',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            {title && (
              <div className="px-5 pt-3 pb-3">
                <p
                  className="text-[9px] font-black uppercase tracking-[0.2em] mb-1"
                  style={{ color: 'var(--brand-primary)', opacity: 0.6 }}
                >
                  Actions
                </p>
                <h3
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--brand-text-primary)' }}
                  title={title}
                >
                  {title}
                </h3>
              </div>
            )}

            {/* Actions */}
            <div className="px-3 pt-1 pb-2 space-y-1">
              {regular.map((item, i) => (
                <ActionRow key={i} item={item} onClose={onClose} />
              ))}
            </div>

            {/* Destructive actions — visually separated */}
            {destructive.length > 0 && (
              <>
                <div className="mx-5 my-2 h-px bg-white/5" />
                <div className="px-3 pb-2 space-y-1">
                  {destructive.map((item, i) => (
                    <ActionRow key={i} item={item} onClose={onClose} />
                  ))}
                </div>
              </>
            )}

            {/* Cancel */}
            <div className="px-3 pt-1 pb-3">
              <button
                onClick={onClose}
                className="w-full h-12 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--brand-text-muted)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}

function ActionRow({ item, onClose }: { item: ContextMenuItem; onClose: () => void }) {
  const isDestructive = item.variant === 'destructive'
  return (
    <button
      onClick={() => {
        if (item.disabled) return
        item.onClick()
        onClose()
      }}
      disabled={item.disabled}
      className="w-full flex items-center gap-3 h-12 px-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
      style={{
        background: isDestructive ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isDestructive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'}`,
        color: isDestructive ? 'rgb(248,113,113)' : 'var(--brand-text-primary)',
      }}
    >
      {item.icon && (
        <span
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: isDestructive ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
          }}
        >
          {item.icon}
        </span>
      )}
      <span className="text-sm font-medium truncate">{item.label}</span>
    </button>
  )
}
