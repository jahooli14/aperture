import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  back,
  subtitle,
  actions,
}: {
  title: string
  back?: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-reading items-center gap-3 px-4 py-3">
        {back && (
          <Link
            to={back}
            aria-label="Back"
            className="-ml-1 rounded p-1 text-muted hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-story text-lg leading-tight">{title}</h1>
          {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
        </div>
        {actions}
      </div>
    </header>
  )
}
