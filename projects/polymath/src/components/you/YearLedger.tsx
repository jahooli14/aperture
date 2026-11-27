/**
 * Your year: every day you touched something, on one grid, with the projects
 * you gave them to and the times you came back to one. The only number is
 * days. No streaks, no empty-project accusations (api/_lib/year-ledger.ts).
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient'
import { yearGrid, shortDay, monthName } from '../../lib/yearGrid'

interface Year {
  from: string; to: string; days: string[]
  projects: { project_id: string; title: string; days: number; first: string; last: string }[]
  comebacks: { project_id: string; title: string; day: string; gap: number }[]
  busiest_month: { month: string; days: number } | null
}

export function YearLedger() {
  const [year, setYear] = useState<Year | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.get(`utilities?resource=mirror&span=year&tz=${new Date().getTimezoneOffset()}`)
      .then((d: unknown) => setYear((d as { year?: Year }).year ?? null))
      .catch(() => setFailed(true))
  }, [])

  const cells = useMemo(() => (year ? yearGrid(year.days, year.from, year.to) : []), [year])
  if (failed || !year) return null

  const n = year.days.length
  return (
    <section className="mb-8" aria-label="Your year">
      <p className="eyebrow mb-2">Your year</p>
      {n === 0 ? (
        <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
          Nothing yet. Every day you add a note to a project or tap Update shows up here.
        </p>
      ) : (
        <div className="glass-card p-4">
          <p className="type-lead">You worked on {n === 1 ? 'one day' : `${n} days`} this past year.</p>
          <div
            className="mt-3 grid gap-[2px]"
            style={{ gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column', gridAutoColumns: '1fr' }}
            role="img" aria-label={`${n} days worked in the last year`}
          >
            {cells.map((c, i) => (
              <span
                key={i} title={c.day ? shortDay(c.day) : undefined}
                className="aspect-square rounded-[2px]"
                style={{ background: c.on ? 'var(--brand-primary)' : c.day ? 'rgba(148,163,184,0.14)' : 'transparent' }}
              />
            ))}
          </div>
          {year.busiest_month && (
            <p className="text-[13px] mt-3" style={{ color: 'var(--brand-text-muted)' }}>
              Your busiest month was {monthName(year.busiest_month.month)}: {year.busiest_month.days} days.
            </p>
          )}
          <ul className="mt-4 space-y-1.5">
            {year.projects.slice(0, 6).map(p => (
              <li key={p.project_id} className="flex justify-between text-[15px]">
                <span>{p.title}</span>
                <span style={{ color: 'var(--brand-text-muted)' }}>{p.days} {p.days === 1 ? 'day' : 'days'}</span>
              </li>
            ))}
          </ul>
          {year.comebacks.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t pt-3" style={{ borderColor: 'rgba(148,163,184,0.2)' }}>
              {year.comebacks.map(c => (
                <li key={c.project_id + c.day} className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>
                  You went back to {c.title} on {shortDay(c.day)}, after {c.gap} days away.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
