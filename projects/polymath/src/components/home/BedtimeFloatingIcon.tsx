/**
 * BedtimeFloatingIcon — Floating moon icon that appears after 9:30pm.
 * Links to the bedtime page for evening wind-down ritual.
 */

import { useState, useEffect } from 'react'
import { Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '../../utils/haptics'

export function BedtimeFloatingIcon() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => {
      const now = new Date()
      const hour = now.getHours()
      const minutes = now.getMinutes()
      setVisible(hour > 21 || (hour === 21 && minutes >= 30))
    }
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => {
            haptic.medium()
            navigate('/bedtime')
          }}
          className="fixed bottom-24 right-4 z-30 h-12 w-12 rounded-full flex items-center justify-center shadow-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
            border: '1px solid rgba(129,140,248,0.3)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(99,102,241,0.2)',
          }}
          title="Bedtime prompts"
        >
          <Moon className="h-5 w-5" style={{ color: 'rgba(165,180,252,0.9)' }} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
