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
    <span className={`inline-flex items-center gap-3 ${sizeClasses[size]} ${className}`} style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {showLogo && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconSizes[size]}
          style={{ filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' }}
        >
          <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 4V10L17.1962 7M12 12L17.1962 17M12 12H18M12 12L6.80385 17M12 12L6.80385 7M12 12V6M12 12H6" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.5" stroke="#3b82f6" strokeWidth="1.5" />
        </svg>
      )}
      <span className="font-black tracking-tighter">
        APER<span style={{ color: 'var(--brand-primary)' }}>TURE</span>
      </span>
    </span>
  )
}
