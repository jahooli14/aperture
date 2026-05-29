/**
 * DeferMount — mount children only once they're near the viewport.
 *
 * Below-the-fold sections that fetch on mount (reading queue, RSS, resurfaced
 * memories) shouldn't compete with the first paint or the above-the-fold
 * data. Wrapping them here delays both their render and their network calls
 * until the user is about to see them, then mounts once and stays mounted.
 *
 * Reserves `minHeight` while deferred so the page doesn't jump when content
 * arrives. Falls back to mounting immediately where IntersectionObserver is
 * unavailable (old WebViews) so nothing is ever hidden.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DeferMountProps {
  children: ReactNode
  /** Height held while deferred, to avoid layout shift. */
  minHeight?: number
  /** How far outside the viewport to start mounting. */
  rootMargin?: string
}

export function DeferMount({ children, minHeight = 200, rootMargin = '300px' }: DeferMountProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (show) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show, rootMargin])

  return (
    <div ref={ref} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  )
}
