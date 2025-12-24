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
    <span className={`inline-flex items-center gap-3 ${sizeClasses[size]} ${className}`} style={{ letterSpacing: '0.05em' }}>
      {showLogo && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconSizes[size]}
          style={{ filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))' }}
        >
          {/* Outer Ring */}
          <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.4" />

          {/* Iris Blades - Tangential Design */}
          <g stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round">
            <path d="M12 2L18.5 6" />
            <path d="M18.5 6L22 12" />
            <path d="M22 12L18.5 18" />
            <path d="M18.5 18L12 22" />
            <path d="M12 22L5.5 18" />
            <path d="M5.5 18L2 12" />
            <path d="M2 12L5.5 6" />
            <path d="M5.5 6L12 2" />

            {/* Inner Tangents */}
            <path d="M12 2L18 12" strokeOpacity="0.3" />
            <path d="M22 12L12 18" strokeOpacity="0.3" />
            <path d="M12 22L6 12" strokeOpacity="0.3" />
            <path d="M2 12L12 6" strokeOpacity="0.3" />
          </g>

          {/* Center Aperture Hole */}
          <circle cx="12" cy="12" r="3.5" fill="black" stroke="#3b82f6" strokeWidth="1" />
          {/* Iris shutter lines */}
          <path d="M12 8.5V10.5" stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.5" />
          <path d="M12 13.5V15.5" stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.5" />
          <path d="M8.5 12H10.5" stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.5" />
          <path d="M13.5 12H15.5" stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.5" />
        </svg>
      )}
      <span className="font-black tracking-tighter lowercase">
        aper<span style={{ color: 'var(--brand-primary)' }}>ture</span>
      </span>
    </span>
  )
}
