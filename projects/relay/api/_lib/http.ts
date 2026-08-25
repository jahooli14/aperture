/** Small helpers so each route reads as its own logic, not error plumbing. */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export function firstParam(req: VercelRequest, name: string): string | undefined {
  const value = req.query[name]
  return Array.isArray(value) ? value[0] : value
}

export function fail(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

export async function handleErrors(res: VercelResponse, fn: () => Promise<unknown>) {
  try {
    return await fn()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Something went wrong'
    console.error('[relay/api]', message, e)
    return res.status(500).json({ error: message })
  }
}

/** Trims and collapses the runaway blank lines a phone keyboard loves to add. */
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!cleaned || cleaned.length > maxLength) return null
  return cleaned
}
