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

  return (
    <div
      className={cn(
        variants[variant],
        sizes[size],
        'rounded-xl transition-all duration-300',
        hover && 'cursor-pointer active:scale-[0.98]',
        className
      )}
      onClick={onClick}
      style={{
        background: 'var(--brand-glass-bg)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
