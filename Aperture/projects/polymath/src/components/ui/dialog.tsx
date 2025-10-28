import * as React from "react"
import * as ReactDOM from "react-dom"
import { cn } from "../../lib/utils"
import { X } from "lucide-react"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
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
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {},
})

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  DialogTriggerProps
>(({ children, onClick, asChild, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    onOpenChange(true)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: handleClick,
    } as any)
  }

  return (
    <button
      ref={ref}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
})
DialogTrigger.displayName = "DialogTrigger"

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  const { open } = React.useContext(DialogContext)

  if (!open) return null

  return ReactDOM.createPortal(
    <>{children}</>,
    document.body
  )
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <div
      ref={ref}
      className={cn(
        // Modern backdrop with smooth fade
        "fixed inset-0 z-50",
        "bg-black/60 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "duration-300 ease-out",
        className
      )}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  )
})
DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={ref}
        className={cn(
          // Modern Android-optimized modal with rounded corners and smooth animations
          "fixed left-[50%] top-[50%] z-50",
          // Responsive width with proper mobile padding
          "w-[calc(100%-2rem)] sm:w-full max-w-lg",
          // Positioning and transforms
          "-translate-x-1/2 -translate-y-1/2",
          // Modern glassmorphism styling with elevation
          "backdrop-blur-xl bg-white/95 rounded-2xl shadow-2xl border-2",
          // Padding with safe area consideration
          "p-6 pb-8",
          // Smooth animations
          "duration-300 ease-out",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4",
          // Prevent content from going under notch/navigation
          "max-h-[calc(100vh-4rem)]",
          "overflow-auto",
          className
        )}
        style={{
          borderColor: 'rgba(59, 130, 246, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        <button
          onClick={() => onOpenChange(false)}
          className={cn(
            // Modern close button with better touch target and glassmorphism
            "absolute right-4 top-4",
            "h-10 w-10",
            "flex items-center justify-center",
            "rounded-full",
            "backdrop-blur-xl bg-white/80 hover:bg-white/90 border-2 shadow-md hover:shadow-lg",
            "text-neutral-600 hover:text-neutral-900",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "active:scale-95",
            "z-10"
          )}
          style={{
            borderColor: 'rgba(59, 130, 246, 0.2)'
          }}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </DialogPortal>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
