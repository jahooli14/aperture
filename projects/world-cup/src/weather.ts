// Live weather for venue cities via Open-Meteo (free, no API key, CORS-friendly).
// Used to theme the background while a game is in play.

export type Condition = 'sunny' | 'clear-night' | 'cloudy' | 'rain' | 'snow' | 'thunder' | 'fog'

export interface Weather {
  condition: Condition
  label: string
  icon: string
  tempC: number
}

// Coordinates per host city (keys match the `city` field on predictions).
export const cityCoords: Record<string, { lat: number; lon: number }> = {
  'Boston, USA': { lat: 42.09, lon: -71.26 }, // Gillette, Foxborough
  'New York, USA': { lat: 40.81, lon: -74.07 }, // MetLife, East Rutherford
  'Los Angeles, USA': { lat: 33.95, lon: -118.34 }, // SoFi, Inglewood
  'Monterrey, Mexico': { lat: 25.67, lon: -100.24 }, // Estadio BBVA
  'Toronto, Canada': { lat: 43.63, lon: -79.42 }, // BMO Field
  'San Francisco, USA': { lat: 37.4, lon: -121.97 }, // Levi's, Santa Clara
  'Seattle, USA': { lat: 47.6, lon: -122.33 }, // Lumen Field
  'Houston, USA': { lat: 29.68, lon: -95.41 }, // NRG Stadium
  'Dallas, USA': { lat: 32.75, lon: -97.09 }, // AT&T, Arlington
  'Mexico City, Mexico': { lat: 19.3, lon: -99.15 }, // Estadio Azteca
  'Atlanta, USA': { lat: 33.76, lon: -84.4 }, // Mercedes-Benz
  'Miami, USA': { lat: 25.96, lon: -80.24 }, // Hard Rock
  'Vancouver, Canada': { lat: 49.28, lon: -123.11 }, // BC Place
  'Kansas City, USA': { lat: 39.05, lon: -94.48 }, // Arrowhead
}

// WMO weather code → our condition buckets.
function classify(code: number, isDay: boolean): { condition: Condition; label: string; icon: string } {
  if (code === 0 || code === 1)
    return isDay
      ? { condition: 'sunny', label: 'Sunny', icon: '☀️' }
      : { condition: 'clear-night', label: 'Clear', icon: '🌙' }
  if (code === 2 || code === 3) return { condition: 'cloudy', label: 'Cloudy', icon: '☁️' }
  if (code === 45 || code === 48) return { condition: 'fog', label: 'Fog', icon: '🌫️' }
  if (code >= 71 && code <= 77) return { condition: 'snow', label: 'Snow', icon: '🌨️' }
  if (code === 85 || code === 86) return { condition: 'snow', label: 'Snow', icon: '🌨️' }
  if (code >= 95) return { condition: 'thunder', label: 'Storm', icon: '⛈️' }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return { condition: 'rain', label: 'Rain', icon: '🌧️' }
  return { condition: 'cloudy', label: 'Cloudy', icon: '☁️' }
}

export async function fetchWeather(city: string): Promise<Weather | null> {
  const coords = cityCoords[city]
  if (!coords) return null
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&current=temperature_2m,weather_code,is_day`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const data = await resp.json()
    const cur = data.current
    if (!cur) return null
    const { condition, label, icon } = classify(Number(cur.weather_code), cur.is_day === 1)
    return { condition, label, icon, tempC: Math.round(Number(cur.temperature_2m)) }
  } catch {
    return null
  }
}
