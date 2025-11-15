import React from 'react'
import { cn } from '@/lib/utils'

interface PremiumCardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'subtle' | 'strong'
  size?: 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

export function PremiumCard({
  children,
  className,
  variant = 'default',
  size = 'md',
  hover = true,
  onClick,
  style,
}: PremiumCardProps) {
  const variants = {
    default: 'premium-glass',
    subtle: 'premium-glass-subtle',
    strong: 'premium-glass-strong',
  }

  const sizes = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <div
      className={cn(
        variants[variant],
        sizes[size],
        'rounded-xl transition-all duration-300',
        hover && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => hover && setIsHovered(true)}
      onMouseLeave={() => hover && setIsHovered(false)}
      style={{
        background: isHovered ? 'var(--premium-bg-3)' : 'var(--premium-bg-2)',
        boxShadow: isHovered
          ? '0 12px 32px rgba(0, 0, 0, 0.5)'
          : '0 8px 24px rgba(0, 0, 0, 0.4)',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        backdropFilter: 'blur(12px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
