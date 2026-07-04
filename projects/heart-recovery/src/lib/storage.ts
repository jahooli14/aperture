const STORAGE_KEY = 'heart-recovery:event-date';
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function loadEventDate(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value || !DATE_SHAPE.test(value)) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveEventDate(dateStr: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, dateStr);
  } catch {
    // localStorage can throw in private browsing / blocked-storage contexts.
    // The app degrades to in-memory state for this session rather than crashing.
  }
}

export function clearEventDate(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // see saveEventDate
  }
}
