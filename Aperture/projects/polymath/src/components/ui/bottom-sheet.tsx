/**
 * BottomSheet Component
 * Mobile-optimized modal that slides up from bottom with drag-to-dismiss
 */

import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'
import { haptic } from '../../utils/haptics'

interface BottomSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

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

const BottomSheetPortal = ({ children }: { children: React.ReactNode }) => {
  const { open } = React.useContext(BottomSheetContext)

  if (!open) return null

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
      transition={{ duration: 0.2 }}
      className={cn(
        'fixed inset-0 z-50',
        'bg-black/60 backdrop-blur-sm',
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
  const { onOpenChange } = React.useContext(BottomSheetContext)
  const y = useMotionValue(0)
  const opacity = useTransform(y, [0, 300], [1, 0.5])

  const handleDragEnd = (_: any, info: PanInfo) => {
    // Dismiss if dragged down more than 100px or with fast velocity
    if (info.offset.y > 100 || info.velocity.y > 500) {
      haptic.light()
      onOpenChange(false)
    }
  }

  return (
    <BottomSheetPortal>
      <BottomSheetOverlay />
      <motion.div
        ref={ref}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        style={{ y, opacity, borderColor: 'rgba(59, 130, 246, 0.3)' }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50',
          'max-h-[90vh]',
          'rounded-t-3xl',
          'bg-white/95 backdrop-blur-xl',
          'shadow-2xl border-t-2',
          'overflow-hidden',
          'flex flex-col',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex items-center justify-center pt-3 pb-2 flex-shrink-0">
          <div
            className="w-12 h-1.5 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            }}
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
            'h-10 w-10',
            'flex items-center justify-center',
            'rounded-full',
            'backdrop-blur-xl bg-white/80 hover:bg-white/90 border-2 shadow-md hover:shadow-lg',
            'text-neutral-600 hover:text-neutral-900',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            'active:scale-95',
            'z-10',
            'touch-manipulation'
          )}
          style={{
            borderColor: 'rgba(59, 130, 246, 0.2)',
          }}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {children}
        </div>

        {/* Safe area spacing for iOS home indicator */}
        <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />
      </motion.div>
    </BottomSheetPortal>
  )
})
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
      'sticky bottom-0 bg-white/95 backdrop-blur-xl -mx-6 px-6 pb-4',
      className
    )}
    style={{
      borderColor: 'rgba(0, 0, 0, 0.1)',
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
      'text-2xl font-bold leading-tight tracking-tight',
      className
    )}
    style={{ color: 'var(--premium-text-primary)' }}
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
    className={cn('text-sm', className)}
    style={{ color: 'var(--premium-text-secondary)' }}
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
