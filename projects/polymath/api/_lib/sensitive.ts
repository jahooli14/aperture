/**
 * Notes a take must never be built on: health, illness, drink and drugs,
 * grief. They are real and they stay in the notebook, searchable, but a
 * claim about them on the home screen is the app diagnosing someone.
 *
 * Measured on the owner's corpus (Nov 2026): with these rows in, the
 * judge's two TOP takes of a run were "your intentions to appreciate your
 * parents keep getting pushed into the future" (dad's heart attack) and a
 * take about drinking. The prompt already said "no diagnosing"; the model
 * did it anyway because the rows were the most charged in the corpus.
 * Checked in code, not asked for. Pure.
 */

const PATTERNS: RegExp[] = [
  /\bheart attack/i, /\balzheimer/i, /\bdementia\b/i, /\bcancer\b/i, /\btumou?r\b/i,
  /\bsurgery\b/i, /\bsurgeon\b/i, /\bhospital\b/i, /\binjection\b/i, /\bdiagnos(is|ed|e)\b/i,
  /\bchemo/i, /\bfuneral\b/i, /\bpassed away\b/i, /\bmiscarr/i, /\bnerve root\b/i, /\bspine\b/i,
  /\bdepress(ed|ion)\b/i, /\banxiety\b/i, /\btherap(y|ist)\b/i, /\bpanic attack/i, /\bmental health\b/i,
  /\balcohol/i, /\bdrunk\b/i, /\bhungover\b/i, /\bbeers?\b/i, /\bsober\b/i, /\baddict/i,
  /\b(when|while|get|getting|got) (i'm |i am )?high\b/i, /\bweed\b/i, /\bcocaine\b/i, /\bdrugs\b/i,
  /\bdivorce/i,
]

export function isSensitive(text: string | null | undefined): boolean {
  if (!text) return false
  return PATTERNS.some(p => p.test(text))
}
