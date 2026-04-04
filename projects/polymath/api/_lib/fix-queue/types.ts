/**
 * Fix Queue types
 * Data-driven fix specifications that the runner can execute
 */

export type FixActionType = 'send_email' | 'send_email_digest' | 'http_request' | 'smart_home'

export type FixStatus = 'draft_pending' | 'drafted' | 'approved' | 'deployed' | 'manual' | 'rejected'

export interface FixSchedule {
  cron: string          // e.g. '0 20 * * 2' (Tuesdays at 8pm)
  timezone: string      // e.g. 'Europe/London'
  description: string   // e.g. 'Every Tuesday at 8pm'
}

export interface SendEmailAction {
  type: 'send_email'
  to: string
  subject: string
  body: string
}

export interface SendEmailDigestAction {
  type: 'send_email_digest'
  to: string
  subject: string
  items_query: string   // description of what to aggregate
}

export interface HttpRequestAction {
  type: 'http_request'
  url: string
  method: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  body?: string
}

export interface SmartHomeAction {
  type: 'smart_home'
  device: 'frame_tv' | 'sonos' | 'bird_cam'
  command: string
  params?: Record<string, string>
}

export type FixAction = SendEmailAction | SendEmailDigestAction | HttpRequestAction | SmartHomeAction

export interface FixDraft {
  name: string
  description: string
  schedule: FixSchedule
  actions: FixAction[]
  estimated_cost: string   // e.g. '$0.01/month'
}

export interface FixQueueItem {
  id: string
  list_item_id: string
  user_id: string
  content: string
  severity: 'critical' | 'annoying' | 'minor'
  automatable: boolean
  fix_hint: string | null
  fix_status: FixStatus
  fix_draft: FixDraft | null
  memory_id: string | null
  created_at: string
}
