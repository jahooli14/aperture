/**
 * Rosette Brand Name Component
 * Displays the app name with styling
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
      Coal<span style={{
        color: 'rgba(6, 182, 212, 1)',
        letterSpacing: '0.01em'
      }}>esce</span>
    </span>
  )
}
