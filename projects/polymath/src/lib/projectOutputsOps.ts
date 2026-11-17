/**
 * Pure helpers for "what you made" (projectOutputs.ts). Split out so they
 * test without a browser or a Supabase client.
 */

export type OutputKind = 'image' | 'audio' | 'link'

export interface LinkMeta { title?: string; image?: string; site?: string }

export interface ProjectOutput {
  id: string
  project_id: string
  kind: OutputKind
  title: string | null
  note: string | null
  link: string | null
  link_meta: LinkMeta | null
  /** YYYY-MM-DD: the day it was made, not the day it was added. */
  made_on: string
  created_at: string
  /** Its place among everything made on the project, oldest first. */
  number: number | null
  /** Signed, expires in an hour. Null for a link. */
  url: string | null
}

/** Supabase's free tier refuses single files over 50MB. */
export const MAX_OUTPUT_BYTES = 50 * 1024 * 1024
/** Photos are shrunk to this on the long edge before upload. */
export const MAX_IMAGE_EDGE = 2000

export function kindOfFile(file: { type: string }): 'image' | 'audio' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

/** Plain reason a file can't be added, or null when it can. */
export function rejectReason(file: { type: string; size: number }): string | null {
  if (!kindOfFile(file)) return 'Photos and audio only.'
  if (file.size > MAX_OUTPUT_BYTES) return 'That file is over 50MB. Try a shorter clip.'
  return null
}

/** Target size for a photo, keeping its shape. Never scales up. */
export function scaledSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const k = maxEdge / longest
  return { width: Math.round(width * k), height: Math.round(height * k) }
}

/**
 * The day a JPEG was taken, from its EXIF (DateTimeOriginal, else DateTime),
 * as YYYY-MM-DD. A photo of a painting from 2019 is dated 2019 without
 * anyone typing it. Null when there is no date to read.
 */
export function exifDate(buf: ArrayBuffer): string | null {
  const v = new DataView(buf)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null
  let off = 2
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off)
    const size = v.getUint16(off + 2)
    if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) return readTiff(v, off + 10)
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null
    off += 2 + size
  }
  return null
}

function readTiff(v: DataView, base: number): string | null {
  try {
    const little = v.getUint16(base) === 0x4949
    const u16 = (o: number) => v.getUint16(base + o, little)
    const u32 = (o: number) => v.getUint32(base + o, little)
    const entries = (ifd: number) => Array.from({ length: u16(ifd) }, (_, i) => ifd + 2 + i * 12)
    const ascii = (entry: number) => {
      const count = u32(entry + 4)
      const at = count > 4 ? u32(entry + 8) : entry + 8
      let s = ''
      for (let i = 0; i < Math.min(count, 20); i++) s += String.fromCharCode(v.getUint8(base + at + i))
      return s
    }
    const ifd0 = u32(4)
    let fallback: string | null = null
    for (const e of entries(ifd0)) {
      const tag = u16(e)
      if (tag === 0x0132) fallback = ascii(e)
      if (tag === 0x8769) {
        for (const x of entries(u32(e + 8))) if (u16(x) === 0x9003) return toIso(ascii(x))
      }
    }
    return fallback ? toIso(fallback) : null
  } catch {
    return null
  }
}

function toIso(exif: string): string | null {
  const m = exif.match(/^(\d{4}):(\d{2}):(\d{2})/)
  if (!m || m[1] === '0000') return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** A file's own date as YYYY-MM-DD, when it isn't just "now". */
export function fileDate(lastModified: number, now = Date.now()): string | null {
  if (!lastModified || now - lastModified < 5 * 60_000) return null
  return new Date(lastModified).toISOString().slice(0, 10)
}

/** "No. 14 · March 2019", or just the date. */
export function pieceLabel(item: { number: number | null; made_on: string }, total?: number): string {
  const d = new Date(`${item.made_on}T12:00:00Z`)
  const when = Number.isNaN(d.getTime()) ? item.made_on : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return item.number && (total ?? 2) > 1 ? `No. ${item.number} · ${when}` : when
}

/** What to call a piece when it has no title. */
export function pieceName(item: Pick<ProjectOutput, 'title' | 'link_meta' | 'kind'>): string {
  return item.title || item.link_meta?.title || (item.kind === 'image' ? 'Untitled' : item.kind === 'audio' ? 'A recording' : 'A link')
}
