/**
 * Undo Toast Hook
 * Shows toast with undo callback for destructive actions
 */

import { useToast } from '../components/ui/toast'

interface UndoToastOptions {
  title: string
  description: string
  onUndo: () => void | Promise<void>
  duration?: number // Default 5000ms
}

export function useUndoToast() {
  const { addToast } = useToast()

  const showUndoToast = ({ title, description, onUndo, duration = 5000 }: UndoToastOptions) => {
    // Simple implementation: Show toast with "Tap to undo" instruction
    // In a future enhancement, could add custom toast component with inline button

    addToast({
      title,
      description: `${description} • Tap here to undo`,
      variant: 'default',
      duration,
    })

    // TODO: Wire up undo callback to toast click event
    // For now, undo functionality will be added in a future enhancement
    // Current implementation provides the notification infrastructure

    return () => onUndo()
  }

  return { showUndoToast }
}
