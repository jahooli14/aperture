/**
 * What it knows about you (api/_lib/portrait.ts): the lines you keep
 * coming back to, each with the notes, projects, lists and answers that
 * show it. Rebuilt every night, so it fills up as you feed it.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/apiClient'
import { SubtleBackground } from '../components/SubtleBackground'

interface LineRow { kind: string; id: string; title: string; at?: string }
interface Line { name: string; rows: LineRow[]; first?: string; last?: string }

const KIND: Record<string, string> = { project: 'project', memory: 'note', fragment: 'note', list_item: 'list', answer: 'your answer', article: 'article' }

function month(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function WhatItKnowsPage() {
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    api.get('utilities?resource=portrait', { timeout: 60_000 })
      .then((d: unknown) => setLines((d as { portrait?: { lines?: Line[] } | null }).portrait?.lines ?? []))
      .catch(() => setFailed(true))
  }, [])

  return (
    <div className="min-h-screen page-bottom">
      <SubtleBackground />
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <header className="page-masthead">
          <div className="page-masthead-text">
            <button onClick={() => navigate(-1)} className="back-link">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <h1 className="page-hero">What it knows.</h1>
          </div>
        </header>

        <p className="text-[15px] mb-6" style={{ color: 'var(--brand-text-secondary)' }}>
          The things you keep coming back to. It reads everything you add, every night, so this fills up as you go.
        </p>

        {failed && <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>Couldn't load it. Try again in a moment.</p>}
        {!failed && lines === null && <p className="text-[15px]" style={{ color: 'var(--brand-text-muted)' }}>Reading your notes…</p>}
        {lines?.length === 0 && <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>Nothing yet. Say a few more notes and check back tomorrow.</p>}

        <div className="space-y-3">
          {lines?.map((l, i) => (
            <button key={l.name} className="glass-card w-full text-left p-4" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <p className="type-lead">{l.name}</p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--brand-text-muted)' }}>
                {l.rows.length} things{l.first ? ` · since ${month(l.first)}` : ''}
              </p>
              {open === i && (
                <ul className="mt-3 space-y-1.5">
                  {l.rows.map(r => (
                    <li key={r.id} className="text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
                      <span className="eyebrow mr-2">{KIND[r.kind] ?? r.kind}</span>{r.title}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
