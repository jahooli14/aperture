import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [removingIds, setRemovingIds] = React.useState<Set<string>>(new Set())

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { ...toast, id }

    setToasts((prev) => [...prev, newToast])

    // Auto remove after duration (default 3s for quicker feedback)
    // Success messages with actionable info get slightly longer (4s)
    const defaultDuration = toast.variant === 'success' && toast.description ? 4000 : 3000
    const duration = toast.duration ?? defaultDuration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    // Mark as removing to trigger fade-out animation
    setRemovingIds((prev) => new Set(prev).add(id))

    // Actually remove after animation completes (500ms)
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 500)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removingIds={removingIds} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

function ToastContainer({ toasts, removingIds, removeToast }: { toasts: Toast[]; removingIds: Set<string>; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] flex flex-col items-center justify-center pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} isRemoving={removingIds.has(toast.id)} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, isRemoving, onClose }: { toast: Toast; isRemoving: boolean; onClose: () => void }) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    // Trigger fade in animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  const getVariantStyles = () => {
    switch (toast.variant) {
      case "destructive":
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }
      case "success":
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--premium-text-primary)',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }
      default:
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'var(--premium-text-primary)',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }
    }
  }

  return (
    <div
      className={cn(
        "group pointer-events-auto relative flex items-center justify-between space-x-4 rounded-2xl p-6 pr-8 mb-2 min-w-[280px] max-w-[420px]",
        "backdrop-blur-xl shadow-2xl transition-all duration-500 ease-out",
        isVisible && !isRemoving ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}
      style={getVariantStyles()}
    >
      <div className="grid gap-1">
        {toast.title && <div className="text-sm font-semibold">{toast.title}</div>}
        {toast.description && (
          <div className="text-sm opacity-90">{toast.description}</div>
        )}
      </div>
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
