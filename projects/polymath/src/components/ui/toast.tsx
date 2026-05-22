import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
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
    const defaultDuration = toast.action ? 6000 : (toast.variant === 'success' && toast.description ? 4000 : 3000)
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
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-28 right-4 left-4 sm:left-auto z-[100] flex flex-col-reverse items-center sm:items-end gap-2 pointer-events-none"
    >
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
    const baseShadow =
      '0 20px 60px -16px rgba(0,0,0,0.55),' +
      '0 4px 12px rgba(0,0,0,0.25),' +
      'inset 0 1px 0 rgba(255,255,255,0.10)'

    switch (toast.variant) {
      case "destructive":
        return {
          background: 'linear-gradient(180deg, rgba(var(--color-error-rgb), 0.20) 0%, rgba(var(--color-error-rgb), 0.08) 100%), rgba(20, 27, 38, 0.65)',
          color: 'var(--brand-text-primary)',
          border: '1px solid rgba(var(--color-error-rgb), 0.40)',
          borderRadius: 'var(--brand-radius)',
          boxShadow: baseShadow + ', 0 0 28px rgba(var(--color-error-rgb), 0.18)',
        }
      case "success":
        return {
          background: 'linear-gradient(180deg, rgba(var(--brand-primary-rgb), 0.18) 0%, rgba(var(--brand-primary-rgb), 0.06) 100%), rgba(20, 27, 38, 0.65)',
          color: 'var(--brand-text-primary)',
          border: '1px solid rgba(var(--brand-primary-rgb), 0.40)',
          borderRadius: 'var(--brand-radius)',
          boxShadow: baseShadow + ', 0 0 28px rgba(var(--brand-primary-rgb), 0.18)',
        }
      default:
        return {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 35%), rgba(20, 27, 38, 0.72)',
          color: 'var(--brand-text-primary)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 'var(--brand-radius)',
          boxShadow: baseShadow,
        }
    }
  }

  return (
    <div
      className={cn(
        "group pointer-events-auto relative flex items-start justify-between gap-3 p-4 sm:p-5 pr-10 mb-2 min-w-0 w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[420px]",
        "backdrop-blur-xl shadow-2xl transition-all duration-500 ease-out",
        isVisible && !isRemoving ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}
      style={getVariantStyles()}
    >
      <div className="grid gap-1 min-w-0 flex-1">
        {toast.title && <div className="text-sm font-semibold leading-snug">{toast.title}</div>}
        {toast.description && (
          <div className="text-sm opacity-90 leading-snug">{toast.description}</div>
        )}
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); onClose() }}
            className="text-sm font-bold mt-1.5 text-left active:opacity-60 transition-opacity min-h-[28px]"
            style={{ color: 'var(--brand-primary)' }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={onClose}
        className="absolute right-1.5 top-1.5 h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
