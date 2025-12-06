import { useState, useEffect } from 'react'

export function useScrollDirection() {
    const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null)
    const [prevScrollY, setPrevScrollY] = useState(0)

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY

            // Ignore small scroll movements (debounce/threshold)
            if (Math.abs(currentScrollY - prevScrollY) < 10) {
                return
            }

            if (currentScrollY > prevScrollY && currentScrollY > 50) {
                setScrollDirection('down')
            } else if (currentScrollY < prevScrollY) {
                setScrollDirection('up')
            }

            setPrevScrollY(currentScrollY)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [prevScrollY])

    return scrollDirection
}
