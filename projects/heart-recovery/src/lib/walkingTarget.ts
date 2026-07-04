const START_MINUTES = 5;
const CAP_MINUTES = 30;

/**
 * A roughly-linear daily walking target, in minutes, ramping from a short
 * house-and-garden walk up to a steady ~30 minutes by about week 7, then
 * holding. Walking is the one activity that's safe to make genuinely
 * progressive day by day — driving and farm work need real clinical
 * clearance and can't be given an invented daily number.
 */
export function getWalkingTargetMinutes(day: number): number {
  const safeDay = Math.max(day, 1);
  return Math.min(CAP_MINUTES, START_MINUTES + Math.floor(safeDay / 2));
}

export function getStartingWalkingTargetMinutes(): number {
  return START_MINUTES;
}
