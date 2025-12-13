/**
 * Rosette Brand Name Component
 * Displays the app name with styling
 */

interface BrandNameProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function BrandName({ className = '', size = 'md', showLogo = false }: BrandNameProps & { showLogo?: boolean }) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-10 w-10'
  }

  return (
    <span className={`inline-flex items-center gap-2 ${sizeClasses[size]} ${className}`} style={{ letterSpacing: '0.02em' }}>
      {showLogo && (
        <img
          src="/coalessence-logo.svg"
          alt="Coalessence Logo"
          className={`${iconSizes[size]} object-contain`}
        />
      )}
      <span>
        Coal<span style={{
          color: 'rgba(6, 182, 212, 1)',
          letterSpacing: '0.01em'
        }}>essence</span>
      </span>
    </span>
  )
}
