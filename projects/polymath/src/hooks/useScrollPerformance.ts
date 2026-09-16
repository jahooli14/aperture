import { useEffect } from 'react'

// backdrop-filter blur is the most expensive thing on screen to repaint —
// every .glass-card visible gets reblurred each frame the content behind
// it moves, and a notes or projects grid can have dozens on screen at
// once. That's the actual cause of the jank on those pages, not React.
//
// This flags <body data-scrolling> for the brief window the page is
// actually moving; theme.css drops backdrop-filter while that attribute
// is set and restores it the instant scrolling stops. The blur is only
// ever seen at rest, so nothing looks different — it's just cheap while
// nobody could appreciate it anyway.
//
// `capture: true` on window catches scroll events from nested
// overflow-y-auto containers too (scroll doesn't bubble, but capturing
// listeners still see it on the way down), so this covers every
// scrollable surface in the app, not just the page body.
const SCROLL_END_DELAY = 150

export function useScrollPerformance() {
  useEffect(() => {
    let ticking = false
    let endTimer: ReturnType<typeof setTimeout> | undefined

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          document.body.setAttribute('data-scrolling', 'true')
          ticking = false
        })
      }
      if (endTimer) clearTimeout(endTimer)
      endTimer = setTimeout(() => {
        document.body.removeAttribute('data-scrolling')
      }, SCROLL_END_DELAY)
    }

    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      if (endTimer) clearTimeout(endTimer)
      document.body.removeAttribute('data-scrolling')
    }
  }, [])
}
