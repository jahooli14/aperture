import { useCallback, useState } from 'react';
import { loadEventDate, saveEventDate, clearEventDate } from '../lib/storage';

// His actual heart attack date — hardcoded so he never has to enter it
// himself. "Change date" still works underneath if it ever needs fixing.
const DEFAULT_EVENT_DATE = '2026-06-08';

export function useEventDate() {
  const [eventDate, setEventDateState] = useState<string | null>(
    () => loadEventDate() ?? DEFAULT_EVENT_DATE,
  );

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
