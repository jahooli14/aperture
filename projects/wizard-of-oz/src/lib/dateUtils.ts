/**
 * Date utility functions to handle "local" dates consistently across the app.
 * This avoids the common pitfall where "YYYY-MM-DD" strings are parsed as UTC
 * and then displayed in the user's local timezone, often resulting in the date
 * shifting back by one day.
 */

/**
 * Formats a Date as a YYYY-MM-DD string using its LOCAL calendar fields.
 * Unlike `date.toISOString().split('T')[0]`, this does not shift the day in
 * timezones offset from UTC, so it matches the dates the user actually sees.
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Today's date as a YYYY-MM-DD string in the user's local timezone.
 */
export function getTodayLocalDateString(): string {
  return toLocalDateString(new Date());
}

/**
 * Parses a YYYY-MM-DD string into a Date object representing that date in the local timezone.
 * This ensures that when formatted, it stays on the same calendar day.
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Handle YYYY-MM-DD format specifically
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    // Note: month is 0-indexed in Date constructor
    return new Date(year, month - 1, day);
  }
  
  // Fallback for other formats (though we should try to stick to YYYY-MM-DD)
  return new Date(dateString);
}

/**
 * Formats a YYYY-MM-DD string for display in the UI.
 * Example: "2025-10-24" -> "Oct 24, 2025" (or locale equivalent)
 */
export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    console.error('Error formatting date:', e);
    return dateString;
  }
}

/**
 * Formats a YYYY-MM-DD string for shorter display.
 * Example: "2025-10-24" -> "Oct 24"
 */
export function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return '';

  try {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Formats a date for display relative to today: "Today", "Yesterday",
 * "N days ago" for the last week, otherwise the short date ("Oct 24").
 * Future dates fall back to the short date.
 */
export function formatRelativeDate(
  dateString: string | null | undefined,
  today: string = getTodayLocalDateString()
): string {
  if (!dateString) return '';

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffDays = Math.round(
    (parseLocalDate(today).getTime() - parseLocalDate(dateString).getTime()) / MS_PER_DAY
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return formatShortDate(dateString);
}
