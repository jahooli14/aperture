/**
 * Everything you've made, across every project: each one's pieces under
 * its name, the project you made most recently first. Reached from a
 * project's shelf and from Settings.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listOutputs, type ProjectOutput } from '../lib/projectOutputs'
import { useProjectStore } from '../stores/useProjectStore'
import { SubtleBackground } from '../components/SubtleBackground'
import { MadeTile } from '../components/made/MadeTile'
import { PieceSheet } from '../components/made/PieceSheet'

export function MadePage() {
  const navigate = useNavigate()
  const projects = useProjectStore(s => s.allProjects)
  const fetchProjects = useProjectStore(s => s.fetchProjects)
  const [items, setItems] = useState<ProjectOutput[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [open, setOpen] = useState<ProjectOutput | null>(null)

  const load = () => listOutputs().then(r => { setItems(r.items); setAvailable(r.available) }).catch(() => setItems([]))
  useEffect(() => {
    void load()
    if (projects.length === 0) void fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groups = useMemo(() => {
    const by = new Map<string, ProjectOutput[]>()
    for (const i of items ?? []) by.set(i.project_id, [...(by.get(i.project_id) ?? []), i])
    return [...by.entries()].sort((a, b) => b[1][0].made_on.localeCompare(a[1][0].made_on))
  }, [items])
  const titleOf = (id: string) => projects.find(p => p.id === id)?.title ?? 'A project'

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
            <h1 className="page-hero">What you've made.</h1>
          </div>
        </header>

        {items === null && <p className="text-[15px]" style={{ color: 'var(--brand-text-muted)' }}>Loading…</p>}
        {!available && <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>Not set up yet.</p>}
        {available && items?.length === 0 && (
          <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>Nothing yet. Add a photo, recording or link from any project's page.</p>
        )}

        <div className="space-y-8 pb-24">
          {groups.map(([projectId, list]) => (
            <section key={projectId} className="space-y-3">
              <button className="type-lead text-left" onClick={() => navigate(`/projects/${projectId}`)}>{titleOf(projectId)}</button>
              <div className="grid grid-cols-3 gap-2">
                {list.map(item => <MadeTile key={item.id} item={item} showNumber={list.length > 1} onOpen={() => setOpen(item)} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
      {open && (
        <PieceSheet
          item={open}
          total={(items ?? []).filter(i => i.project_id === open.project_id).length}
          projectTitle={titleOf(open.project_id)}
          onChanged={() => { void load() }}
          onRemoved={() => { void load() }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
