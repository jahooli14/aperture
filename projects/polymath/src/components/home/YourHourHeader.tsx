/**
 * YourHourHeader — brand + search.
 */

import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BrandName } from '../BrandName'

export function YourHourHeader() {
  const navigate = useNavigate()

  return (
    <div className="mb-7 relative">
      {/* Soft brand glow tucked behind the wordmark — gives the header lift */}
      <div
        aria-hidden
        className="absolute -top-6 -left-6 h-32 w-64 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at left, rgba(var(--brand-primary-rgb), 0.18), transparent 65%)',
          filter: 'blur(24px)',
        }}
      />
      <div className="relative flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl aperture-header" style={{ color: 'var(--brand-text-primary)', opacity: 0.95 }}>
          <BrandName className="inline" showLogo={true} />
        </h1>

        <button
          onClick={() => navigate('/search')}
          className="h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.15), rgba(var(--brand-primary-rgb),0.04))',
            border: '1px solid rgba(var(--brand-primary-rgb),0.25)',
            color: 'rgb(var(--brand-primary-rgb))',
            boxShadow: '0 4px 14px -4px rgba(var(--brand-primary-rgb),0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
          title="Search everything"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
