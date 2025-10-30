/**
 * Clandestined Brand Name Component
 * Displays "Clandestined" with "destined" highlighted
 */

interface BrandNameProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function BrandName({ className = '', size = 'md' }: BrandNameProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  return (
    <span className={`${sizeClasses[size]} ${className}`}>
      Clan<span style={{ color: 'var(--premium-amber)', fontWeight: 600 }}>destined</span>
    </span>
  )
}
