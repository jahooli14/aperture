/**
 * Age calculation utilities for displaying baby's age
 */

export interface BabyAge {
  years: number;
  months: number;
  weeks: number;
  days: number;
  totalDays: number;
}

/**
 * Calculate baby's age from birthdate to a specific photo date
 * @param birthDate - Baby's birth date (YYYY-MM-DD)
 * @param photoDate - Photo date (YYYY-MM-DD)
 * @returns Age breakdown in years, months, weeks, and days
 */
export function calculateAge(birthDate: string, photoDate: string): BabyAge {
  const birth = new Date(birthDate + 'T00:00:00');
  const photo = new Date(photoDate + 'T00:00:00');

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  // Calculate total days
  const totalDays = Math.floor((photo.getTime() - birth.getTime()) / MS_PER_DAY);

  // Anchor = the birthday advanced by `m` whole months, clamping the day to the
  // target month's length so "born on the 31st" lands on the last valid day
  // (e.g. Jan 31 + 1 month = Feb 28) instead of overflowing into the next month.
  const anchorFor = (m: number): Date => {
    const targetMonth = birth.getMonth() + m;
    const lastDayOfTarget = new Date(birth.getFullYear(), targetMonth + 1, 0).getDate();
    return new Date(
      birth.getFullYear(),
      targetMonth,
      Math.min(birth.getDate(), lastDayOfTarget)
    );
  };

  // Whole months elapsed, then back off one if we overshot the photo date.
  let totalMonths =
    (photo.getFullYear() - birth.getFullYear()) * 12 + (photo.getMonth() - birth.getMonth());
  if (anchorFor(totalMonths) > photo) {
    totalMonths--;
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  // Calendar days into the current month (pairs with years/months).
  const days = Math.floor((photo.getTime() - anchorFor(totalMonths).getTime()) / MS_PER_DAY);
  // Complete weeks since birth (pairs with the day-of-week remainder).
  const weeks = Math.floor(totalDays / 7);

  return {
    years,
    months,
    weeks,
    days,
    totalDays,
  };
}

/**
 * Format age for display - shows most relevant units
 * @param age - Age object from calculateAge
 * @returns Formatted string like "2 years, 3 months, 5 days"
 */
export function formatAge(age: BabyAge): string {
  const parts: string[] = [];

  if (age.years > 0) {
    parts.push(`${age.years} ${age.years === 1 ? 'year' : 'years'}`);
  }

  if (age.months > 0 && age.years < 2) {
    // Show months for babies under 2 years
    parts.push(`${age.months} ${age.months === 1 ? 'month' : 'months'}`);
  }

  if (age.years === 0 && age.weeks > 0 && age.months < 6) {
    // Show weeks for babies under 6 months
    parts.push(`${age.weeks} ${age.weeks === 1 ? 'week' : 'weeks'}`);
  }

  if (age.years === 0 && age.months === 0) {
    // For very young babies, show exact days
    parts.push(`${age.totalDays} ${age.totalDays === 1 ? 'day' : 'days'}`);
  } else if (age.days > 0 && parts.length < 2) {
    // Add days if we don't have enough detail yet
    parts.push(`${age.days} ${age.days === 1 ? 'day' : 'days'}`);
  }

  return parts.slice(0, 2).join(', '); // Show max 2 units
}

/**
 * Format age in compact form for overlays
 * @param age - Age object from calculateAge
 * @returns Compact string like "2y 3m 5d" or "5 weeks"
 */
export function formatAgeCompact(age: BabyAge): string {
  if (age.years > 0) {
    return age.months > 0
      ? `${age.years}y ${age.months}m`
      : `${age.years}y`;
  }

  if (age.months > 0) {
    return age.days > 0
      ? `${age.months}mo ${age.days}d`
      : `${age.months}mo`;
  }

  if (age.weeks > 0) {
    // Week display pairs with the day-of-week remainder, not the day-of-month.
    return `${age.weeks}w ${age.totalDays % 7}d`;
  }

  return `${age.totalDays}d`;
}
