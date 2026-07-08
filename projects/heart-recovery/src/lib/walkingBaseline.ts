const STORAGE_KEY = 'heart-recovery:comfortable-walk-minutes';

export function loadComfortableWalkMinutes(): number | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveComfortableWalkMinutes(minutes: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(minutes));
  } catch {
    // localStorage can throw in private browsing; the app just re-asks next time
  }
}

const DAILY_STEP_MINUTES = 5; // matches the +5 step size in the sourced stage table

export interface SuggestedWalk {
  minutes: number;
  atTarget: boolean;
}

/**
 * Always a modest step above what he's told us he's actually managing —
 * never a number implied by the calendar alone. If he's behind where a
 * calendar-based stage would assume, this still starts from his real
 * baseline, not the assumption.
 */
export function getSuggestedWalk(comfortableMinutes: number): SuggestedWalk {
  if (comfortableMinutes >= 30) {
    return { minutes: comfortableMinutes, atTarget: true };
  }
  return { minutes: comfortableMinutes + DAILY_STEP_MINUTES, atTarget: false };
}
