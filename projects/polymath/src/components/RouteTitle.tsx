import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/memories/, 'Thoughts'],
  [/^\/projects\/.+/, 'Project'],
  [/^\/projects/, 'Projects'],
  [/^\/reading\/.+/, 'Reading'],
  [/^\/(reading|rss)/, 'Reading'],
  [/^\/lists\/.+/, 'List'],
  [/^\/(lists|favourites)/, 'Lists'],
  [/^\/search/, 'Search'],
  [/^\/settings/, 'Settings'],
  [/^\/bedtime/, 'Bedtime'],
]

/** Keeps the browser tab and task-switcher title in step with the page. */
export function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const hit = TITLES.find(([re]) => re.test(pathname))
    document.title = hit ? `${hit[1]} · Aperture` : 'Aperture'
  }, [pathname])
  return null
}
