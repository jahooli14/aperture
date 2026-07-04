/**
 * Date utility functions to handle "local" dates consistently across the app.
 * This avoids the common pitfall where "YYYY-MM-DD" strings are parsed as UTC
 * and then displayed in the user's local timezone, often resulting in the date
 * shifting back by one day.
 *
 * Copied (subset) from projects/wizard-of-oz/src/lib/dateUtils.ts — this repo
 * has no shared package mechanism across projects/*, so reusable date logic
 * gets copied rather than imported.
 */

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayLocalDateString(): string {
  return toLocalDateString(new Date());
}

export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateString);
}

export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString) return 'Unknown date';

  try {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}
