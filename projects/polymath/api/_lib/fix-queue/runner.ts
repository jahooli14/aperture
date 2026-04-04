/**
 * Fix Runner
 * Executes approved fixes based on their data-driven specifications.
 * Each fix is a set of actions (email, HTTP, smart home) on a schedule.
 */

import { Resend } from 'resend'
import type { FixAction, FixDraft } from './types.js'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface RunResult {
  fix_name: string
  success: boolean
  actions_run: number
  errors: string[]
}

export async function executeFix(draft: FixDraft): Promise<RunResult> {
  const result: RunResult = {
    fix_name: draft.name,
    success: true,
    actions_run: 0,
    errors: []
  }

  for (const action of draft.actions) {
    try {
      await executeAction(action)
      result.actions_run++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push(`${action.type}: ${msg}`)
      result.success = false
    }
  }

  return result
}

async function executeAction(action: FixAction): Promise<void> {
  switch (action.type) {
    case 'send_email':
      await resend.emails.send({
        from: 'Fix Queue <fixes@updates.polymath.wiki>',
        to: action.to,
        subject: action.subject,
        html: formatEmailHtml(action.subject, action.body)
      })
      break

    case 'send_email_digest':
      // Digest emails aggregate data — for now, send a simple version
      await resend.emails.send({
        from: 'Fix Queue <fixes@updates.polymath.wiki>',
        to: action.to,
        subject: action.subject,
        html: formatEmailHtml(action.subject, action.items_query)
      })
      break

    case 'http_request':
      await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body
      })
      break

    case 'smart_home':
      // Smart home actions are logged for now — Phase 3 will integrate
      // with Home Assistant / Samsung TV / Sonos APIs on the local network
      console.log(`[fix-runner] Smart home action: ${action.device} → ${action.command}`, action.params)
      break
  }
}

function formatEmailHtml(subject: string, body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 14px; color: #92400e; font-weight: 600;">🔧 Fix Queue</span>
      </div>
      <h2 style="font-size: 18px; color: #1a1a1a; margin: 0 0 16px;">${subject}</h2>
      <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0;">${body}</p>
      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        <span style="font-size: 12px; color: #9ca3af;">Automated by Polymath Fix Queue</span>
      </div>
    </div>
  `
}
