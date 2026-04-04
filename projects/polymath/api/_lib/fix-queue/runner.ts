/**
 * Fix Runner
 * Executes approved fixes based on their data-driven specifications.
 * Each fix is a set of actions (email, HTTP, smart home) on a schedule.
 */

import { Resend } from 'resend'
import type { FixAction, FixDraft, WeatherEmailAction } from './types.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Fix Queue <onboarding@resend.dev>'

function getResend() {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')
  return new Resend(RESEND_API_KEY)
}

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
    case 'send_email': {
      const resend = getResend()
      await resend.emails.send({
        from: FROM_EMAIL,
        to: action.to,
        subject: action.subject,
        html: formatEmailHtml(action.subject, action.body)
      })
      break
    }

    case 'send_email_digest': {
      const resend = getResend()
      await resend.emails.send({
        from: FROM_EMAIL,
        to: action.to,
        subject: action.subject,
        html: formatEmailHtml(action.subject, action.items_query)
      })
      break
    }

    case 'weather_email': {
      const weather = await fetchWeather(action)
      const body = action.template.replace('{{weather}}', weather)
      const resend = getResend()
      await resend.emails.send({
        from: FROM_EMAIL,
        to: action.to,
        subject: action.subject,
        html: formatEmailHtml(action.subject, body)
      })
      break
    }

    case 'http_request': {
      const resp = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
      break
    }

    case 'smart_home':
      await executeSmartHomeAction(action)
      break
  }
}

// ============================================================================
// WEATHER (Open-Meteo — free, no API key)
// ============================================================================

interface WeatherData {
  temperature: number
  feelsLike: number
  weatherCode: number
  precipitation: number
  windSpeed: number
  humidity: number
}

async function fetchWeather(action: WeatherEmailAction): Promise<string> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${action.lat}&longitude=${action.lon}&current=temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe%2FLondon&forecast_days=1`

  const resp = await fetch(url)
  if (!resp.ok) return 'Weather data unavailable'

  const data = await resp.json()
  const current = data.current
  const daily = data.daily

  const weather: WeatherData = {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    weatherCode: current.weather_code,
    precipitation: current.precipitation,
    windSpeed: Math.round(current.wind_speed_10m),
    humidity: current.relative_humidity_2m
  }

  const condition = weatherCodeToText(weather.weatherCode)
  const maxTemp = Math.round(daily.temperature_2m_max[0])
  const minTemp = Math.round(daily.temperature_2m_min[0])
  const rainTotal = daily.precipitation_sum[0]

  const lines = [
    `${condition}, ${weather.temperature}°C (feels like ${weather.feelsLike}°C)`,
    `High ${maxTemp}°C / Low ${minTemp}°C`,
    rainTotal > 0 ? `Rain expected: ${rainTotal}mm — bring a coat` : 'No rain expected',
    weather.windSpeed > 30 ? `Windy: ${weather.windSpeed} km/h` : '',
  ].filter(Boolean)

  return lines.join('<br>')
}

function weatherCodeToText(code: number): string {
  const codes: Record<number, string> = {
    0: 'Clear sky ☀️', 1: 'Mainly clear 🌤️', 2: 'Partly cloudy ⛅', 3: 'Overcast ☁️',
    45: 'Foggy 🌫️', 48: 'Icy fog 🌫️',
    51: 'Light drizzle 🌦️', 53: 'Moderate drizzle 🌦️', 55: 'Dense drizzle 🌧️',
    61: 'Light rain 🌧️', 63: 'Moderate rain 🌧️', 65: 'Heavy rain 🌧️',
    71: 'Light snow 🌨️', 73: 'Moderate snow 🌨️', 75: 'Heavy snow ❄️',
    80: 'Light showers 🌦️', 81: 'Moderate showers 🌧️', 82: 'Heavy showers ⛈️',
    95: 'Thunderstorm ⛈️', 96: 'Thunderstorm with hail ⛈️', 99: 'Severe thunderstorm ⛈️',
  }
  return codes[code] || 'Unknown conditions'
}

// ============================================================================
// SMART HOME
// ============================================================================

interface SmartHomeResult {
  success: boolean
  message: string
}

async function executeSmartHomeAction(action: FixAction & { type: 'smart_home' }): Promise<SmartHomeResult> {
  const haUrl = process.env.HOME_ASSISTANT_URL  // e.g. http://homeassistant.local:8123
  const haToken = process.env.HOME_ASSISTANT_TOKEN

  // If Home Assistant is configured, use it as the hub
  if (haUrl && haToken) {
    return executeViaHomeAssistant(haUrl, haToken, action)
  }

  // Fallback: direct device control via local network
  switch (action.device) {
    case 'frame_tv':
      return executeFrameTvAction(action)
    case 'sonos':
      return executeSonosAction(action)
    case 'bird_cam':
      return executeBirdCamAction(action)
    default:
      console.log(`[fix-runner] Unknown smart home device: ${action.device}`)
      return { success: false, message: `Unknown device: ${action.device}` }
  }
}

async function executeViaHomeAssistant(
  haUrl: string,
  haToken: string,
  action: FixAction & { type: 'smart_home' }
): Promise<SmartHomeResult> {
  const serviceMap: Record<string, { domain: string; service: string; entity_id: string }> = {
    // Frame TV
    'frame_tv:art_mode_on': { domain: 'media_player', service: 'turn_on', entity_id: 'media_player.samsung_frame' },
    'frame_tv:art_mode_off': { domain: 'media_player', service: 'turn_off', entity_id: 'media_player.samsung_frame' },
    'frame_tv:next_art': { domain: 'media_player', service: 'media_next_track', entity_id: 'media_player.samsung_frame' },
    // Sonos
    'sonos:play': { domain: 'media_player', service: 'media_play', entity_id: 'media_player.sonos_office' },
    'sonos:pause': { domain: 'media_player', service: 'media_pause', entity_id: 'media_player.sonos_office' },
    'sonos:set_volume': { domain: 'media_player', service: 'volume_set', entity_id: 'media_player.sonos_office' },
  }

  const key = `${action.device}:${action.command}`
  const mapping = serviceMap[key]

  if (!mapping) {
    return { success: false, message: `No HA mapping for: ${key}` }
  }

  const serviceData: Record<string, unknown> = { entity_id: mapping.entity_id }
  if (action.params) {
    Object.assign(serviceData, action.params)
  }

  const resp = await fetch(`${haUrl}/api/services/${mapping.domain}/${mapping.service}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${haToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(serviceData)
  })

  if (!resp.ok) {
    return { success: false, message: `HA API error: ${resp.status}` }
  }

  return { success: true, message: `Executed ${key} via Home Assistant` }
}

// Direct device control (no Home Assistant required)
// These use local network APIs — requires the Vercel function to have network access
// or a local proxy/bridge running on the home network

async function executeFrameTvAction(action: FixAction & { type: 'smart_home' }): Promise<SmartHomeResult> {
  const tvIp = process.env.FRAME_TV_IP
  if (!tvIp) return { success: false, message: 'FRAME_TV_IP not configured' }

  // Samsung Frame TV WebSocket API (port 8002)
  // Note: Full integration requires samsungtvws Python library or a local bridge
  // For now, log the intent — a local Raspberry Pi bridge would handle execution
  console.log(`[fix-runner] Frame TV (${tvIp}): ${action.command}`, action.params)
  return { success: true, message: `Frame TV command queued: ${action.command}` }
}

async function executeSonosAction(action: FixAction & { type: 'smart_home' }): Promise<SmartHomeResult> {
  const sonosHttpApi = process.env.SONOS_HTTP_API_URL // e.g. http://192.168.1.x:5005
  if (!sonosHttpApi) return { success: false, message: 'SONOS_HTTP_API_URL not configured' }

  // node-sonos-http-api endpoints
  const commandMap: Record<string, string> = {
    'play': '/Office/play',
    'pause': '/Office/pause',
    'set_volume': `/Office/volume/${action.params?.volume || '30'}`,
    'play_favourite': `/Office/favorite/${encodeURIComponent(action.params?.name || '')}`,
    'say': `/Office/say/${encodeURIComponent(action.params?.text || '')}/en-gb`,
  }

  const endpoint = commandMap[action.command]
  if (!endpoint) return { success: false, message: `Unknown Sonos command: ${action.command}` }

  const resp = await fetch(`${sonosHttpApi}${endpoint}`)
  if (!resp.ok) return { success: false, message: `Sonos API error: ${resp.status}` }

  return { success: true, message: `Sonos: ${action.command} executed` }
}

async function executeBirdCamAction(action: FixAction & { type: 'smart_home' }): Promise<SmartHomeResult> {
  const camUrl = process.env.BIRD_CAM_URL
  if (!camUrl) return { success: false, message: 'BIRD_CAM_URL not configured' }

  // RTSP or HTTP snapshot — depends on camera model
  // For now, support snapshot capture
  if (action.command === 'snapshot') {
    const resp = await fetch(`${camUrl}/snapshot`)
    if (!resp.ok) return { success: false, message: `Bird cam error: ${resp.status}` }
    return { success: true, message: 'Bird cam snapshot captured' }
  }

  return { success: false, message: `Unknown bird cam command: ${action.command}` }
}

// ============================================================================
// EMAIL TEMPLATE
// ============================================================================

function formatEmailHtml(subject: string, body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 14px; color: #92400e; font-weight: 600;">🔧 Fix Queue</span>
      </div>
      <h2 style="font-size: 18px; color: #1a1a1a; margin: 0 0 16px;">${subject}</h2>
      <div style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0;">${body}</div>
      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        <span style="font-size: 12px; color: #9ca3af;">Automated by Polymath Fix Queue</span>
      </div>
    </div>
  `
}
