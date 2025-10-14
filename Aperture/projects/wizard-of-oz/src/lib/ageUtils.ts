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

  // Calculate total days
  const totalDays = Math.floor((photo.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate years
  let years = photo.getFullYear() - birth.getFullYear();
  let months = photo.getMonth() - birth.getMonth();
  let days = photo.getDate() - birth.getDate();

  // Adjust if we haven't reached the birth month this year
  if (months < 0 || (months === 0 && days < 0)) {
    years--;
    months += 12;
  }

  // Adjust if we haven't reached the birth day this month
  if (days < 0) {
    months--;
    const prevMonth = new Date(photo.getFullYear(), photo.getMonth(), 0);
    days += prevMonth.getDate();
  }

  // Calculate weeks from remaining days
  const weeks = Math.floor(totalDays / 7);

  return {
    years,
    months,
    weeks,
    days: totalDays % 7, // Days beyond complete weeks
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
    return `${age.weeks}w ${age.days}d`;
  }

  return `${age.totalDays}d`;
}
