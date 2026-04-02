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
    addToast({
      title,
      description,
      variant: 'default',
      duration,
      action: {
        label: 'Undo',
        onClick: () => { onUndo() },
      },
    })
  }

  return { showUndoToast }
}
