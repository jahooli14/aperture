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
    <span className={`${sizeClasses[size]} ${className}`} style={{ letterSpacing: '0.02em' }}>
      Clan<span style={{
        color: 'var(--premium-amber)',
        fontWeight: 600,
        fontSize: '1.15em',
        letterSpacing: '0.01em'
      }}>destined</span>
    </span>
  )
}
