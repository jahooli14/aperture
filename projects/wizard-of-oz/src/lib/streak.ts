/**
 * Daily-capture streak: how many consecutive days, ending today (or yesterday
 * if today hasn't been captured yet so an unfinished day doesn't break it),
 * have at least one photo.
 */
import { parseLocalDate, toLocalDateString, getTodayLocalDateString } from './dateUtils';

function previousDay(dateString: string): string {
  const d = parseLocalDate(dateString);
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
}

/**
 * @param dates - photo dates as YYYY-MM-DD strings (order/duplicates don't matter)
 * @param today - local today as YYYY-MM-DD (injectable for testing)
 * @returns the current consecutive-day streak (0 if it's already broken)
 */
export function currentStreak(
  dates: string[],
  today: string = getTodayLocalDateString()
): number {
  const days = new Set(dates);

  let cursor: string;
  if (days.has(today)) {
    cursor = today;
  } else {
    const yesterday = previousDay(today);
    if (!days.has(yesterday)) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}
