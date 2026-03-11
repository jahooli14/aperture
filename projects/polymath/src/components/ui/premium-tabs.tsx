import React from 'react'
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

export function PremiumTabs({ tabs, activeTab, onChange, className }: PremiumTabsProps) {
  return (
    <div className={cn('flex border-b border-white/10', className)} style={{ gap: 0 }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-black uppercase tracking-wider transition-all duration-150 flex-shrink-0"
            style={{
              color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.38)',
              borderBottom: isActive ? '2px solid rgba(255,255,255,0.8)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && Number(tab.count) > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-sm text-[10px] font-black"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                  color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                  border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
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
