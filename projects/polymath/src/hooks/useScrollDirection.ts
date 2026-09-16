import { useState, useEffect, useRef } from 'react'

export function useScrollDirection() {
    const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null)
    // A ref, not state, for the last-seen position: state would re-run the
    // effect below on every scroll tick, tearing down and re-adding the
    // window listener in the middle of the user's scroll gesture.
    const prevScrollYRef = useRef(0)

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY

            // Ignore small scroll movements (debounce/threshold)
            if (Math.abs(currentScrollY - prevScrollYRef.current) < 10) {
                return
            }

            if (currentScrollY > prevScrollYRef.current && currentScrollY > 50) {
                setScrollDirection('down')
            } else if (currentScrollY < prevScrollYRef.current) {
                setScrollDirection('up')
            }

            prevScrollYRef.current = currentScrollY
        }

        // passive: true tells the browser this listener never calls
        // preventDefault, so it can start scrolling immediately instead of
        // waiting on the handler to finish — without it every scroll frame
        // blocks on JS first.
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return scrollDirection
}
