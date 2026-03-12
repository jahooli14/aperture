import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

/**
 * Mobile-first bottom sheet component
 * Slides up from bottom with backdrop
 */
export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setIsVisible(true)
      // Prevent body scroll when open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open && !isVisible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        onTransitionEnd={() => {
          if (!open) setIsVisible(false)
        }}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] flex flex-col transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          background: 'rgba(15, 24, 41, 0.98)',
          borderTop: '2px solid rgba(255,255,255,0.15)',
          borderLeft: '2px solid rgba(255,255,255,0.1)',
          borderRight: '2px solid rgba(255,255,255,0.1)',
          borderRadius: '4px 4px 0 0',
          boxShadow: '0 -4px 0 rgba(0,0,0,0.6)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--glass-surface-hover)' }}
          >
            <h2 className="text-lg font-semibold" style={{ color: "var(--brand-primary)" }}>{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-brand-surface/80"
              style={{ color: "var(--brand-primary)" }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </>
  )
}
