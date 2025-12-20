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
    xl: 'text-2xl font-black'
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-10 w-10'
  }

  return (
    <span className={`inline-flex items-center gap-2 ${sizeClasses[size]} ${className}`} style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {showLogo && (
        <div className={`${iconSizes[size]} bg-white flex items-center justify-center rounded-sm`}>
          <div className="w-2/3 h-2/3 bg-black rounded-full" />
        </div>
      )}
      <span className="font-black">
        APER<span className="zebra-text-accent">TURE</span>
      </span>
    </span>
  )
}
