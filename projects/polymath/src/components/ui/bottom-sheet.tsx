/**
 * BottomSheet Component
 * Mobile-optimized modal that slides up from bottom with drag-to-dismiss
 */

import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { AnimatePresence, motion, useMotionValue, useTransform, useDragControls, PanInfo } from 'framer-motion'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'

interface BottomSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

/**
 * True once the sheet has finished sliding in (and always true outside a
 * sheet). Focusing a field mid-slide raises the keyboard while the sheet is
 * still travelling, and the two fight; wait for this before focusing.
 */
const SheetSettledContext = React.createContext(true)
export const useSheetSettled = () => React.useContext(SheetSettledContext)

const BottomSheetContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {},
})

const BottomSheet = ({ open, onOpenChange, children }: BottomSheetProps) => {
  const [isOpen, setIsOpen] = React.useState(open ?? false)

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open)
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  return (
    <BottomSheetContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </BottomSheetContext.Provider>
  )
}

// Always render the portal so the children can play their exit animation via
// AnimatePresence; visibility is gated inside BottomSheetContent.
const BottomSheetPortal = ({ children }: { children: React.ReactNode }) => {
  return ReactDOM.createPortal(
    <>{children}</>,
    document.body
  )
}

const BottomSheetOverlay = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  const { onOpenChange } = React.useContext(BottomSheetContext)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'fixed inset-0 z-[10000]',
        // Solid dim, no backdrop blur: a full-screen blur re-rendered under
        // the page on every frame of the fade is the single most expensive
        // thing a phone can be asked to do while a sheet opens.
        'bg-black/75',
        className
      )}
      onClick={() => {
        haptic.light()
        onOpenChange(false)
      }}
    />
  )
})
BottomSheetOverlay.displayName = 'BottomSheetOverlay'

const BottomSheetContent = React.forwardRef<
  HTMLDivElement,
  { className?: string; children: React.ReactNode }
>(({ className, children }, ref) => {
  const { open, onOpenChange } = React.useContext(BottomSheetContext)

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  // Everything that costs something (motion values, the keyboard listener)
  // lives in SheetPanel, which only exists while the sheet is open. Most
  // sheets are mounted all the time and closed; they used to each keep a
  // visualViewport listener alive and re-render on every keyboard change.
  return (
    <BottomSheetPortal>
      <AnimatePresence>
        {open && (
          <React.Fragment key="bottom-sheet">
            <BottomSheetOverlay />
            <SheetPanel ref={ref} className={className} onOpenChange={onOpenChange}>
              {children}
            </SheetPanel>
          </React.Fragment>
        )}
      </AnimatePresence>
    </BottomSheetPortal>
  )
})

const SheetPanel = React.forwardRef<
  HTMLDivElement,
  { className?: string; children: React.ReactNode; onOpenChange: (open: boolean) => void }
>(({ className, children, onOpenChange }, ref) => {
  const y = useMotionValue(0)
  const opacity = useTransform(y, [0, 300], [1, 0.8], { clamp: true })
  const keyboardInset = useKeyboardInset()
  // Drag starts from the handle only. With drag on the whole panel, every
  // downward swipe on the content fought the scroll inside it.
  const dragControls = useDragControls()
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [settled, setSettled] = React.useState(false)
  const setRefs = (node: HTMLDivElement | null) => {
    panelRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
  }
  // Fields marked data-autofocus take focus when the slide is done, not at
  // mount, so the keyboard doesn't rise under a moving sheet.
  const handleAnimationComplete = () => {
    setSettled(true)
    const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
    if (target && !panelRef.current?.contains(document.activeElement)) target.focus()
  }

  const handleDragEnd = (_: any, info: PanInfo) => {
    // Dismiss if dragged down more than 80px or with fast velocity
    if (info.offset.y > 80 || info.velocity.y > 400) {
      haptic.light()
      onOpenChange(false)
    }
  }

  return (
      <motion.div
        role="dialog"
        aria-modal="true"
        ref={setRefs}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{
          type: 'spring',
          damping: 38,
          stiffness: 560,
          mass: 0.4,
        }}
        onAnimationComplete={handleAnimationComplete}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{
          y,
          opacity,
          bottom: keyboardInset,
          maxHeight: keyboardInset > 0 ? `calc(100vh - ${keyboardInset + 16}px)` : undefined,
          transition: 'bottom 0.2s ease-out',
          // Solid panel. A blurred, translucent one cost a repaint on every
          // frame of the slide and visibly popped when it "settled".
          background: 'rgb(15, 22, 36)',
          borderTop: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 -28px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[10001]',
          'max-h-[88vh]',
          'rounded-t-3xl',
          'overflow-hidden',
          'flex flex-col',
          'will-change-transform',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle — the only part that drags the sheet */}
        <div
          className="flex items-center justify-center pt-4 pb-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div
            className="w-12 h-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
          />
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            haptic.light()
            onOpenChange(false)
          }}
          className={cn(
            'absolute right-4 top-4',
            'h-11 w-11',
            'flex items-center justify-center',
            'rounded-full border-2',
            'focus:outline-none focus:ring-2 focus:ring-brand-primary',
            'z-10',
            'touch-manipulation active:scale-95 transition-transform'
          )}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'var(--brand-text-primary)'
          }}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-6 sm:pb-8">
          <SheetSettledContext.Provider value={settled}>{children}</SheetSettledContext.Provider>
        </div>

        {/* Safe area spacing for iOS home indicator */}
        <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />
      </motion.div>
  )
})
SheetPanel.displayName = 'SheetPanel'
BottomSheetContent.displayName = 'BottomSheetContent'

const BottomSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 pt-2 pb-4',
      className
    )}
    {...props}
  />
)
BottomSheetHeader.displayName = 'BottomSheetHeader'

const BottomSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col gap-3 pt-6 mt-6 border-t',
      'sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4',
      className
    )}
    style={{
      backgroundColor: 'rgb(15, 22, 36)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
    }}
    {...props}
  />
)
BottomSheetFooter.displayName = 'BottomSheetFooter'

const BottomSheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      'text-xl sm:text-2xl font-bold leading-tight tracking-tight',
      className
    )}
    style={{ color: 'var(--brand-text-primary)' }}
    {...props}
  />
))
BottomSheetTitle.displayName = 'BottomSheetTitle'

const BottomSheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm leading-relaxed', className)}
    style={{ color: 'var(--brand-text-secondary)' }}
    {...props}
  />
))
BottomSheetDescription.displayName = 'BottomSheetDescription'

export {
  BottomSheet,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
}
