import { parseLocalDate, getTodayLocalDateString } from './dateUtils';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Day number since the heart attack, where the day it happened is Day 1.
 * Most recovery guidance (DVLA driving rules, BHF/NHS activity timelines) is
 * expressed relative to the event itself, not the discharge date.
 */
export function getDayNumber(eventDateStr: string, todayStr: string = getTodayLocalDateString()): number {
  const diffDays = Math.round(
    (parseLocalDate(todayStr).getTime() - parseLocalDate(eventDateStr).getTime()) / MS_PER_DAY,
  );
  return diffDays + 1;
}
