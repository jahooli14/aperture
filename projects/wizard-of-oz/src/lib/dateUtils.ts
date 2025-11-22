/**
 * Date utility functions to handle "local" dates consistently across the app.
 * This avoids the common pitfall where "YYYY-MM-DD" strings are parsed as UTC
 * and then displayed in the user's local timezone, often resulting in the date
 * shifting back by one day.
 */

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
