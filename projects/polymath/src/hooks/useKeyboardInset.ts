import { useEffect, useState } from 'react'

/**
 * Returns how many pixels the on-screen keyboard currently obscures at the
 * bottom of the screen (0 when closed).
 *
 * Our viewport meta uses `interactive-widget=resizes-visual`, so opening the
 * keyboard shrinks the visual viewport but NOT the layout viewport. A
 * `position: fixed; bottom: 0` element therefore stays anchored under the
 * keyboard. Offsetting `bottom` by this value lifts it back into view and
 * stops the browser's scroll-correction "jump".
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const obscured = window.innerHeight - vv.height - vv.offsetTop
      setInset(obscured > 1 ? obscured : 0)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
