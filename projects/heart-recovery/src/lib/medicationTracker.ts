import { getTodayLocalDateString } from './dateUtils';

const STORAGE_KEY = 'heart-recovery:medication-check';

export type Dose = 'morning' | 'evening';

interface MedicationCheckState {
  date: string;
  morning: boolean;
  evening: boolean;
}

function freshState(): MedicationCheckState {
  return { date: getTodayLocalDateString(), morning: false, evening: false };
}

function readState(): MedicationCheckState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MedicationCheckState>;
      if (parsed.date === getTodayLocalDateString()) {
        return { date: parsed.date, morning: !!parsed.morning, evening: !!parsed.evening };
      }
    }
  } catch {
    // malformed/blocked storage — fall through to a fresh, unchecked state
  }
  return freshState();
}

function writeState(state: MedicationCheckState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can throw in private browsing; state just won't persist
  }
}

// Only ever tracks *today's* two doses — this is a same-day reminder, not a
// history or adherence log, so it resets itself the moment the date rolls
// over rather than accumulating any record of past days.
export function getTodaysMedicationState(): { morning: boolean; evening: boolean } {
  const { morning, evening } = readState();
  return { morning, evening };
}

export function setDoseChecked(dose: Dose, checked: boolean): { morning: boolean; evening: boolean } {
  const current = readState();
  const next: MedicationCheckState = { ...current, [dose]: checked };
  writeState(next);
  return { morning: next.morning, evening: next.evening };
}
