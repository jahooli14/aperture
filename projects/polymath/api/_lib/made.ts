/**
 * The pure half of "what you made": validating links, reading a link's
 * title and artwork, numbering pieces, and the rules for a row. Tested on
 * its own (made.test.ts); project-outputs.ts does the IO.
 */

export const TITLE_MAX = 120
export const NOTE_MAX = 1200
export type MadeKind = 'image' | 'audio' | 'link'

export interface LinkMeta { title?: string; image?: string; site?: string }

/** https only, no credentials, a real host. Returns the cleaned URL or null. */
export function cleanLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null
  u.hash = ''
  return u.toString()
}

/** Sites with a public oEmbed endpoint: one call gives title and artwork. */
export function oembedUrl(link: string): string | null {
  const host = new URL(link).hostname.replace(/^www\./, '')
  const enc = encodeURIComponent(link)
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com') return `https://soundcloud.com/oembed?format=json&url=${enc}`
  if (host === 'mixcloud.com') return `https://app.mixcloud.com/oembed/?format=json&url=${enc}`
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') return `https://www.youtube.com/oembed?format=json&url=${enc}`
  if (host === 'vimeo.com') return `https://vimeo.com/api/oembed.json?url=${enc}`
  return null
}

const https = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? decode(v) : undefined)
const text = (v: unknown, max = TITLE_MAX) => (typeof v === 'string' && v.trim() ? decode(v.trim()).slice(0, max) : undefined)

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

export function readOembed(json: unknown): LinkMeta {
  const j = (json ?? {}) as Record<string, unknown>
  return { title: text(j.title), image: https(j.thumbnail_url), site: text(j.provider_name, 40) }
}

/** og:title / og:image / og:site_name from a page's head; <title> as a fallback. */
export function readOpenGraph(html: string): LinkMeta {
  const head = html.slice(0, 200_000)
  const og = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i')
    const tag = head.match(re)?.[0]
    return tag?.match(/content=["']([^"']*)["']/i)?.[1]
  }
  const title = og('og:title') ?? head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
  return { title: text(title), image: https(og('og:image')), site: text(og('og:site_name'), 40) }
}

/** YYYY-MM-DD, not in the future, not before 1970. Anything else: today. */
export function madeOn(raw: unknown, today = new Date()): string {
  const iso = today.toISOString().slice(0, 10)
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return iso
  const d = new Date(`${raw}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || raw > iso || raw < '1970-01-01') return iso
  return raw
}

/**
 * "No. 14": a piece's place among everything made on its project, oldest
 * first by the day it was made. Worked out on read, never stored, so adding
 * seven years of paintings in any order still numbers them right.
 */
export function numberPieces<T extends { id: string; made_on?: string | null; created_at: string }>(items: T[]): Map<string, number> {
  const sorted = [...items].sort((a, b) =>
    (a.made_on ?? a.created_at.slice(0, 10)).localeCompare(b.made_on ?? b.created_at.slice(0, 10)) || a.created_at.localeCompare(b.created_at))
  return new Map(sorted.map((x, i) => [x.id, i + 1]))
}

/** One line per piece for the prompts: what they made and what they said about it. */
export function madeLine(m: { title?: string | null; note?: string | null; link_meta?: LinkMeta | null; made_on?: string | null; kind: MadeKind }): string {
  const name = m.title || m.link_meta?.title || (m.kind === 'image' ? 'a photo' : m.kind === 'audio' ? 'a recording' : 'a link')
  return `${m.made_on ? `${m.made_on}: ` : ''}${name}${m.note ? ` — ${m.note}` : ''}`
}

/**
 * One line for a project's corpus row and its summary: how many pieces,
 * the latest day, and the newest few that have words. Untitled photos add
 * a count, not noise. Pure.
 */
export function madeSummary(items: { title?: string | null; note?: string | null; link_meta?: LinkMeta | null; made_on?: string | null; created_at: string; kind: MadeKind }[], shown = 3): string {
  if (items.length === 0) return ''
  const dated = items.map(i => ({ ...i, made_on: i.made_on ?? i.created_at.slice(0, 10) })).sort((a, b) => b.made_on.localeCompare(a.made_on))
  const worded = dated.filter(i => i.title || i.note || i.link_meta?.title).slice(0, shown).map(madeLine)
  const count = items.length === 1 ? 'Made 1 piece' : `Made ${items.length} pieces`
  return `${count}, the latest on ${dated[0].made_on}${worded.length ? `: ${worded.join('; ')}` : ''}.`
}
