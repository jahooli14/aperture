import { describe, it, expect } from 'vitest'
import { kindOfFile, rejectReason, scaledSize, exifDate, fileDate, pieceLabel, pieceName, MAX_OUTPUT_BYTES } from './projectOutputsOps'

describe('kindOfFile', () => {
  it('sorts photos and audio', () => {
    expect(kindOfFile({ type: 'image/heic' })).toBe('image')
    expect(kindOfFile({ type: 'audio/mpeg' })).toBe('audio')
    expect(kindOfFile({ type: 'video/mp4' })).toBeNull()
  })
})

describe('rejectReason', () => {
  it('lets a normal photo through', () => {
    expect(rejectReason({ type: 'image/jpeg', size: 3_000_000 })).toBeNull()
  })
  it('refuses other files and anything too big, in plain words', () => {
    expect(rejectReason({ type: 'application/pdf', size: 10 })).toBe('Photos and audio only.')
    expect(rejectReason({ type: 'audio/wav', size: MAX_OUTPUT_BYTES + 1 })).toMatch(/over 50MB/)
  })
})

describe('scaledSize', () => {
  it('never scales up', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
  it('shrinks the long edge and keeps the shape', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 2000, height: 1500 })
  })
})

/** A minimal JPEG: SOI, APP1 Exif with IFD0 -> ExifIFD -> DateTimeOriginal. */
function jpegWithDate(date: string, little: boolean): ArrayBuffer {
  const tiff: number[] = []
  const u16 = (n: number) => (little ? [n & 255, n >> 8] : [n >> 8, n & 255])
  const u32 = (n: number) => (little ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255])
  const str = [...date].map(c => c.charCodeAt(0)).concat(0)
  // header(8) | IFD0 at 8: 1 entry (2+12+4=18) -> ExifIFD at 26: 1 entry (18) -> string at 44
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8))
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0))
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(str.length), ...u32(44), ...u32(0))
  tiff.push(...str)
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
  const len = app1.length + 2
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xd9]).buffer
}

describe('exifDate', () => {
  it('reads the day a photo was taken, either byte order', () => {
    expect(exifDate(jpegWithDate('2019:03:14 10:22:01', true))).toBe('2019-03-14')
    expect(exifDate(jpegWithDate('2021:11:02 08:00:00', false))).toBe('2021-11-02')
  })
  it('gives up quietly on anything else', () => {
    expect(exifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull()
    expect(exifDate(new Uint8Array([0xff, 0xd8, 0xff]).buffer)).toBeNull()
    expect(exifDate(jpegWithDate('0000:00:00 00:00:00', true))).toBeNull()
  })
})

describe('fileDate', () => {
  it('uses a file date only when it is not just now', () => {
    const now = Date.parse('2026-11-17T12:00:00Z')
    expect(fileDate(Date.parse('2024-05-01T10:00:00Z'), now)).toBe('2024-05-01')
    expect(fileDate(now - 1000, now)).toBeNull()
    expect(fileDate(0, now)).toBeNull()
  })
})

describe('pieceLabel / pieceName', () => {
  it('numbers a piece only when there is more than one', () => {
    expect(pieceLabel({ number: 14, made_on: '2019-03-14' }, 20)).toBe('No. 14 · 14 Mar 2019')
    expect(pieceLabel({ number: 1, made_on: '2019-03-14' }, 1)).toBe('14 Mar 2019')
  })
  it('falls back to the link title, then a plain word', () => {
    expect(pieceName({ title: null, link_meta: { title: 'Mix 5' }, kind: 'link' })).toBe('Mix 5')
    expect(pieceName({ title: null, link_meta: null, kind: 'image' })).toBe('Untitled')
  })
})
