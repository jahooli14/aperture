import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode
  variant?: 'vibrant' | 'muted'
  onClick?: () => void
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  className?: string
  style?: React.CSSProperties
  isInteractive?: boolean // Whether it has hover/tap animations
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, variant = 'vibrant', onClick, onMouseEnter, onMouseLeave, className, style, isInteractive = true, ...rest }, ref) => {
    const cardStyles: React.CSSProperties = {
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      border: 'none',
      ...style,
    }

    const vibrantBg = 'var(--premium-bg-2)'
    const vibrantHoverBg = 'var(--premium-bg-3)'
    const mutedBg = 'rgba(15, 24, 41, 0.5)' // More transparent/muted than vibrant
    const mutedHoverBg = 'rgba(15, 24, 41, 0.7)' // Slightly less transparent on hover

    const currentBg = variant === 'vibrant' ? vibrantBg : mutedBg
    const currentHoverBg = variant === 'vibrant' ? vibrantHoverBg : mutedHoverBg

    const commonProps = {
      onClick,
      className: `group premium-card rounded-xl p-4 sm:p-5 transition-all relative overflow-hidden ${isInteractive ? 'cursor-pointer' : ''} ${className || ''}`,
      style: {
        ...cardStyles,
        background: currentBg,
      },
      onMouseEnter: isInteractive
        ? (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
          (e.currentTarget as HTMLElement).style.background = currentHoverBg
            ; (e.currentTarget as HTMLElement).style.boxShadow =
              variant === 'vibrant' ? '0 12px 32px rgba(0, 0, 0, 0.5)' : '0 10px 28px rgba(0, 0, 0, 0.45)'
          onMouseEnter?.(e)
        }
        : onMouseEnter,
      onMouseLeave: isInteractive
        ? (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
          (e.currentTarget as HTMLElement).style.background = currentBg
            ; (e.currentTarget as HTMLElement).style.boxShadow = cardStyles.boxShadow
          onMouseLeave?.(e)
        }
        : onMouseLeave,
    }

    const interactiveProps = isInteractive
      ? {
        whileHover: { y: -6, scale: 1.02 },
        whileTap: { scale: 0.98 },
        transition: {
          type: 'spring' as const,
          stiffness: 400,
          damping: 28,
          mass: 0.6,
          opacity: { duration: 0.3 },
          scale: { duration: 0.3 },
        },
      }
      : {}

    return (
      <motion.div ref={ref} {...commonProps} {...interactiveProps} {...rest}>
        {children}
      </motion.div>
    )
  }
)

GlassCard.displayName = 'GlassCard'
