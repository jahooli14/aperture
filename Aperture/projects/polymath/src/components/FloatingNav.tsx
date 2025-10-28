/**
 * Floating Navigation - Context-Aware Glassmorphic FAB
 * Replaces bottom navbar with modern radial menu navigation
 */

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, FolderKanban, FileText, BarChart3, Sparkles, X } from 'lucide-react'

// Schema colors for each pillar
const PILLAR_COLORS = {
  thoughts: {
    primary: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.4)'
  },
  projects: {
    primary: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.4)'
  },
  reading: {
    primary: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)'
  },
  insights: {
    primary: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)'
  }
} as const

type Pillar = keyof typeof PILLAR_COLORS

interface PillarOption {
  id: Pillar
  label: string
  icon: any
  path: string
  angle: number // Degrees for radial positioning
}

const PILLARS: PillarOption[] = [
  { id: 'insights', label: 'Insights', icon: BarChart3, path: '/', angle: 90 },
  { id: 'reading', label: 'Reading', icon: FileText, path: '/reading', angle: 180 },
  { id: 'thoughts', label: 'Thoughts', icon: Layers, path: '/memories', angle: 270 },
  { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects', angle: 0 }
]

export function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Determine current pillar based on path
  const getCurrentPillar = (): Pillar => {
    const path = location.pathname
    if (path.startsWith('/memories')) return 'thoughts'
    if (path.startsWith('/projects')) return 'projects'
    if (path.startsWith('/reading')) return 'reading'
    return 'insights'
  }

  const currentPillar = getCurrentPillar()
  const currentColors = PILLAR_COLORS[currentPillar]

  const handlePillarClick = (pillar: PillarOption) => {
    navigate(pillar.path)
    setIsOpen(false)
  }

  const handleFabClick = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 backdrop-blur-sm bg-black/20"
          />
        )}
      </AnimatePresence>

      {/* Radial Menu Options */}
      <AnimatePresence>
        {isOpen && (
          <>
            {PILLARS.map((pillar, index) => {
              const colors = PILLAR_COLORS[pillar.id]
              const Icon = pillar.icon
              const radius = 120 // Distance from FAB center
              const angleRad = (pillar.angle * Math.PI) / 180
              const x = Math.cos(angleRad) * radius
              const y = -Math.sin(angleRad) * radius

              return (
                <motion.button
                  key={pillar.id}
                  initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                  animate={{
                    scale: 1,
                    x,
                    y,
                    opacity: 1,
                    transition: {
                      type: 'spring',
                      stiffness: 260,
                      damping: 20,
                      delay: index * 0.05
                    }
                  }}
                  exit={{
                    scale: 0,
                    x: 0,
                    y: 0,
                    opacity: 0,
                    transition: { duration: 0.15 }
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePillarClick(pillar)}
                  className="fixed z-50 flex flex-col items-center gap-2"
                  style={{
                    bottom: 24,
                    right: 24,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Glassmorphic Button */}
                  <div
                    className="relative w-16 h-16 rounded-2xl backdrop-blur-xl bg-white/80 border-2 shadow-2xl flex items-center justify-center transition-all duration-300"
                    style={{
                      borderColor: colors.primary,
                      boxShadow: `0 8px 32px ${colors.glow}`
                    }}
                  >
                    <Icon className="w-7 h-7" style={{ color: colors.primary }} />

                    {/* Glow effect */}
                    <div
                      className="absolute inset-0 rounded-2xl blur-xl opacity-50"
                      style={{ backgroundColor: colors.glow }}
                    />
                  </div>

                  {/* Label */}
                  <div
                    className="px-3 py-1 rounded-full backdrop-blur-xl bg-white/90 border shadow-lg"
                    style={{ borderColor: `${colors.primary}40` }}
                  >
                    <span
                      className="text-xs font-semibold whitespace-nowrap"
                      style={{ color: colors.primary }}
                    >
                      {pillar.label}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={handleFabClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-2xl backdrop-blur-xl bg-white/80 border-2 shadow-2xl flex items-center justify-center transition-all duration-300"
        style={{
          borderColor: currentColors.primary,
          boxShadow: `0 8px 32px ${currentColors.glow}`
        }}
      >
        {/* Rotating icon */}
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          {isOpen ? (
            <X className="w-7 h-7" style={{ color: currentColors.primary }} />
          ) : (
            <Sparkles className="w-7 h-7" style={{ color: currentColors.primary }} />
          )}
        </motion.div>

        {/* Pulsing glow when closed */}
        {!isOpen && (
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute inset-0 rounded-2xl blur-xl"
            style={{ backgroundColor: currentColors.glow }}
          />
        )}
      </motion.button>
    </>
  )
}
