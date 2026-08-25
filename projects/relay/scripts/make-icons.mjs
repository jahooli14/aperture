/**
 * Generates Relay's PNG icons with no image dependencies.
 *
 * The mark is four alternating, offset capsules — two voices passing lines
 * back and forth. Run with `npm run icons`; output lands in public/.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const INK = [28, 26, 22, 255]
const CREAM = [244, 239, 230, 255]
const OCHRE = [200, 135, 58, 255]
const WHITE = [255, 255, 255, 255]
const CLEAR = [0, 0, 0, 0]

// x0, x1, centre-y — all normalised to the 0..1 icon box.
const BARS = [
  { x0: 0.20, x1: 0.72, y: 0.255, tone: 0 },
  { x0: 0.30, x1: 0.82, y: 0.425, tone: 1 },
  { x0: 0.20, x1: 0.66, y: 0.595, tone: 0 },
  { x0: 0.30, x1: 0.80, y: 0.765, tone: 1 },
]
const BAR_H = 0.088

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Signed distance from a point to a horizontal capsule, in normalised units. */
function inCapsule(px, py, bar, scale, offset) {
  const r = (BAR_H * scale) / 2
  const y = bar.y * scale + offset
  const x0 = bar.x0 * scale + offset + r
  const x1 = bar.x1 * scale + offset - r
  const cx = Math.min(Math.max(px, x0), x1)
  return Math.hypot(px - cx, py - y) <= r
}

function over(dst, src) {
  const a = src[3] / 255
  if (a === 0) return dst
  const ia = 1 - a
  return [
    Math.round(src[0] * a + dst[0] * ia),
    Math.round(src[1] * a + dst[1] * ia),
    Math.round(src[2] * a + dst[2] * ia),
    Math.round(255 * a + dst[3] * ia),
  ]
}

function render(size, { bg, tones, scale = 1 }) {
  const px = Buffer.alloc(size * size * 4)
  const offset = (1 - scale) / 2
  const SS = 3 // supersample factor, for smooth capsule edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hits = [0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size
          const ny = (y + (sy + 0.5) / SS) / size
          for (const bar of BARS) {
            if (inCapsule(nx, ny, bar, scale, offset)) hits[bar.tone]++
          }
        }
      }
      let out = bg
      const total = SS * SS
      for (let tone = 0; tone < 2; tone++) {
        if (!hits[tone]) continue
        const colour = tones[tone]
        out = over(out, [colour[0], colour[1], colour[2], Math.round((colour[3] * hits[tone]) / total)])
      }
      const i = (y * size + x) * 4
      px[i] = out[0]
      px[i + 1] = out[1]
      px[i + 2] = out[2]
      px[i + 3] = out[3]
    }
  }
  return encodePng(size, px)
}

const jobs = [
  ['icon-192.png', 192, { bg: INK, tones: [CREAM, OCHRE] }],
  ['icon-512.png', 512, { bg: INK, tones: [CREAM, OCHRE] }],
  ['apple-touch-icon.png', 180, { bg: INK, tones: [CREAM, OCHRE] }],
  ['icon-maskable-512.png', 512, { bg: INK, tones: [CREAM, OCHRE], scale: 0.66 }],
  ['notification-icon.png', 192, { bg: CLEAR, tones: [CREAM, OCHRE] }],
  ['notification-badge.png', 96, { bg: CLEAR, tones: [WHITE, WHITE] }],
]

for (const [name, size, opts] of jobs) {
  writeFileSync(join(OUT, name), render(size, opts))
  console.log(`wrote public/${name} (${size}px)`)
}
