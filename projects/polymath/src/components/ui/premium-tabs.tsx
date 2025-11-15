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
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border"
            style={{
              backgroundColor: isActive
                ? 'rgba(59, 130, 246, 0.15)'
                : 'rgba(59, 130, 246, 0.08)',
              color: isActive
                ? 'var(--premium-blue)'
                : 'var(--premium-text-tertiary)',
              borderColor: isActive ? 'var(--premium-blue)' : 'transparent',
              backdropFilter: 'blur(12px)',
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: isActive
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'rgba(255, 255, 255, 0.1)',
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
