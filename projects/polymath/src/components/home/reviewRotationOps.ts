/**
 * Pure helpers for ReviewRotation.
 *
 * Split out for the same reason focusChatOps is: the component imports the
 * API client, which reaches Supabase's build-time constants, so anything
 * importing the .tsx can't run under vitest. Pure logic lives here and is
 * tested directly.
 */

/**
 * Dormancy → visual weight. A project untouched for a year comes back dimmer
 * than one set down last month; picking it up restores it. Fresh sits at full
 * strength and the fade bottoms out at 0.62 — this is atmosphere, and it must
 * never turn into an accessibility problem.
 */
export function dormancyFade(days: number): number {
  const t = Math.min(Math.max(days, 0), 365) / 365
  return 1 - t * 0.38
}
