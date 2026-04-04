/**
 * Fix Queue types
 * Data-driven fix specifications that the runner can execute
 */

export type FixActionType = 'send_email' | 'send_email_digest' | 'http_request' | 'smart_home' | 'weather_email'

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

export interface WeatherEmailAction {
  type: 'weather_email'
  to: string
  subject: string
  lat: number           // e.g. 51.5074
  lon: number           // e.g. -0.1278
  template: string      // template with {{weather}} placeholder
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

export type FixAction = SendEmailAction | SendEmailDigestAction | WeatherEmailAction | HttpRequestAction | SmartHomeAction

/** What env vars / hardware a fix needs before it can actually run */
export interface FixRequirement {
  env_var: string          // e.g. 'HOME_ASSISTANT_URL'
  label: string            // e.g. 'Home Assistant URL'
  description: string      // e.g. 'Publicly accessible Home Assistant instance (e.g. via Nabu Casa)'
}

/** Map of action types to their requirements */
export const ACTION_REQUIREMENTS: Record<string, FixRequirement[]> = {
  send_email: [{ env_var: 'RESEND_API_KEY', label: 'Resend API key', description: 'Email sending service' }],
  weather_email: [{ env_var: 'RESEND_API_KEY', label: 'Resend API key', description: 'Email sending service' }],
  send_email_digest: [{ env_var: 'RESEND_API_KEY', label: 'Resend API key', description: 'Email sending service' }],
  'smart_home:frame_tv': [
    { env_var: 'HOME_ASSISTANT_URL', label: 'Home Assistant', description: 'HA instance reachable from internet (Nabu Casa or tunnel)' },
    { env_var: 'HOME_ASSISTANT_TOKEN', label: 'HA Long-Lived Token', description: 'Settings → Long-Lived Access Tokens' },
  ],
  'smart_home:sonos': [
    { env_var: 'HOME_ASSISTANT_URL', label: 'Home Assistant', description: 'HA instance reachable from internet (Nabu Casa or tunnel)' },
    { env_var: 'HOME_ASSISTANT_TOKEN', label: 'HA Long-Lived Token', description: 'Settings → Long-Lived Access Tokens' },
  ],
  'smart_home:bird_cam': [
    { env_var: 'BIRD_CAM_URL', label: 'Bird cam URL', description: 'HTTP endpoint for bird cam snapshots' },
  ],
}

export function getRequirementsForDraft(draft: FixDraft): FixRequirement[] {
  const seen = new Set<string>()
  const reqs: FixRequirement[] = []
  for (const action of draft.actions) {
    const key = action.type === 'smart_home' ? `smart_home:${action.device}` : action.type
    for (const req of ACTION_REQUIREMENTS[key] || []) {
      if (!seen.has(req.env_var)) {
        seen.add(req.env_var)
        reqs.push(req)
      }
    }
  }
  return reqs
}

export function getMissingRequirements(draft: FixDraft): FixRequirement[] {
  return getRequirementsForDraft(draft).filter(r => !process.env[r.env_var])
}

export interface FixDraft {
  name: string
  description: string
  schedule: FixSchedule
  actions: FixAction[]
  estimated_cost: string   // e.g. '$0.01/month'
  requirements?: FixRequirement[]  // populated by drafter/runner
  ready?: boolean                  // all requirements met?
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
