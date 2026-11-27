/**
 * Keeps server errors. Vercel Hobby holds runtime logs for one hour, so
 * anything older is gone; a 500 recorded here can still be read next week.
 * Wraps a route handler: any 5xx response, or a throw, is written to
 * `app_errors` (server-only table). Logging never changes what the caller
 * sees and never throws.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './supabase.js'

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

const KEEP_DAYS = 30

async function record(route: string, req: VercelRequest, status: number, message: string) {
  try {
    const supabase = getSupabaseClient()
    const resource = typeof req.query?.resource === 'string' ? req.query.resource : null
    await supabase.from('app_errors').insert({
      route, resource, method: req.method ?? null, status, message: message.slice(0, 500),
    })
    // Tidy up now and then, so the table never grows without limit.
    if (Math.random() < 0.02) {
      await supabase.from('app_errors').delete().lt('at', new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString())
    }
  } catch { /* never let logging break a request */ }
}

export function withErrorLog(route: string, handler: Handler): Handler {
  return async (req, res) => {
    let code = 200
    let message = ''
    const status = res.status.bind(res)
    res.status = ((c: number) => { code = c; return status(c) }) as typeof res.status
    const json = res.json.bind(res)
    res.json = ((body: unknown) => {
      const e = (body as { error?: unknown } | null)?.error
      if (typeof e === 'string') message = e
      return json(body)
    }) as typeof res.json
    try {
      const out = await handler(req, res)
      if (code >= 500) await record(route, req, code, message || 'server error')
      return out
    } catch (e) {
      await record(route, req, 500, e instanceof Error ? e.message : String(e))
      throw e
    }
  }
}
