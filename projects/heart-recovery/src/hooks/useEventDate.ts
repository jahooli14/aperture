import { useCallback, useState } from 'react';
import { loadEventDate, saveEventDate, clearEventDate } from '../lib/storage';

export function useEventDate() {
  const [eventDate, setEventDateState] = useState<string | null>(() => loadEventDate());

  const setEventDate = useCallback((dateStr: string) => {
    saveEventDate(dateStr);
    setEventDateState(dateStr);
  }, []);

  const reset = useCallback(() => {
    clearEventDate();
    setEventDateState(null);
  }, []);

  return { eventDate, setEventDate, reset };
}
