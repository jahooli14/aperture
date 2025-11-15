import { useState, useCallback } from 'react';
import type { ToastType } from '../components/Toast';

export interface ToastState {
  message: string;
  type: ToastType;
  isVisible: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    actionLabel?: string,
    onAction?: () => void
  ) => {
    setToast({ message, type, isVisible: true, actionLabel, onAction });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
}
