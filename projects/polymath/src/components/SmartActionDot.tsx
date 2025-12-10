import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

interface SmartActionDotProps {
  color?: string
  isActive?: boolean
  onClick?: (event: React.MouseEvent) => void
  title?: string
  className?: string
}

export const SmartActionDot: React.FC<SmartActionDotProps> = ({
  color = 'var(--premium-blue)',
  isActive = false,
  onClick,
  title = 'AI Analysis / Suggestion',
  className,
}) => {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`relative h-6 w-6 rounded-full flex items-center justify-center transition-colors duration-200 ${className}`}
      style={{
        backgroundColor: `${color.replace('var(', '').replace(')', '')}, 0.2)`, // Use RGB from CSS var
        color: color,
      }}
      title={title}
    >
      <Sparkles className="h-4 w-4" />
      {isActive && (
        <motion.div
          initial={{ scale: 0.8, opacity: 1 }}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [1, 0, 1] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
            times: [0, 0.5, 1],
          }}
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: color,
            opacity: 0,
            filter: `blur(4px)`,
          }}
        />
      )}
    </motion.button>
  )
}
