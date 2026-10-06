import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  count?: number | string
}

interface PremiumTabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

// Fades the right edge while there are more tabs off-screen, so a row cut
// mid-word ("ARCHI") reads as "scroll for more" rather than as a bug.
const MORE_FADE = 'linear-gradient(to right, black calc(100% - 40px), transparent)'

export function PremiumTabs({ tabs, activeTab, onChange, className }: PremiumTabsProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [moreRight, setMoreRight] = useState(false)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const check = () => setMoreRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 2)
    check()
    row.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      row.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [tabs.length])

  return (
    <div
      ref={rowRef}
      className={cn('flex border-b border-white/10 overflow-x-auto scrollbar-hide', className)}
      style={{ gap: 0, maskImage: moreRight ? MORE_FADE : undefined, WebkitMaskImage: moreRight ? MORE_FADE : undefined }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex items-center gap-1.5 px-4 min-h-[44px] text-[12px] font-bold uppercase tracking-wider transition-all duration-150 flex-shrink-0"
            style={{
              color: isActive ? 'var(--brand-text-primary)' : 'var(--brand-text-muted)',
              borderBottom: isActive ? '2px solid var(--brand-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && Number(tab.count) > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-md text-[11px] font-semibold min-w-[20px] text-center"
                style={{
                  backgroundColor: isActive ? 'rgba(var(--brand-primary-rgb),0.2)' : 'var(--glass-surface)',
                  color: isActive ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-secondary)',
                  border: `1px solid ${isActive ? 'rgba(var(--brand-primary-rgb),0.3)' : 'transparent'}`,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
