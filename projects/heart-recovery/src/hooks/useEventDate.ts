import { useCallback, useState } from 'react';
import { loadEventDate, saveEventDate, clearEventDate } from '../lib/storage';

// His actual heart attack date — hardcoded so he never has to enter it
// himself. "Change date" still works underneath if it ever needs fixing.
const DEFAULT_EVENT_DATE = '2026-06-08';

// Any device that was used to test this app before the date was hardcoded
// may already have an old/test date sitting in localStorage, which would
// otherwise silently keep overriding the real one forever. This runs once
// per device to clear exactly that, then gets out of the way — a deliberate
// "Change date" edit after this point persists normally.
const MIGRATION_KEY = 'heart-recovery:event-date-migrated-v1';

function getInitialEventDate(): string {
  try {
    if (localStorage.getItem(MIGRATION_KEY) !== '1') {
      clearEventDate();
      localStorage.setItem(MIGRATION_KEY, '1');
      return DEFAULT_EVENT_DATE;
    }
  } catch {
    return DEFAULT_EVENT_DATE;
  }
  return loadEventDate() ?? DEFAULT_EVENT_DATE;
}

export function useEventDate() {
  const [eventDate, setEventDateState] = useState<string | null>(getInitialEventDate);

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
