/**
 * The "Keep in mind" lines follow your notes (api/_lib/project-themes.ts).
 *
 * `useRefreshThemes` asks, quietly, whether new notes have landed since the
 * lines were last read; the server only calls the model when they have.
 * `ThemesUpdatedNote` says so for a few days and offers Undo, so a line you
 * liked is never lost to a re-read.
 */

import { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { readThemes, readThemesUpdate } from '../../lib/projectThemes'
import type { Project } from '../../types'

const CHECK_EVERY_MS = 20 * 60_000
const KEY = (id: string) => `themes-checked-${id}`

export function useRefreshThemes(project: Project | null | undefined) {
  const id = project?.id
  const hasThemes = !!project && readThemes(project.metadata).length > 0
  useEffect(() => {
    if (!id || !hasThemes || (typeof navigator !== 'undefined' && !navigator.onLine)) return
    try {
      const last = Number(sessionStorage.getItem(KEY(id)) ?? 0)
      if (Date.now() - last < CHECK_EVERY_MS) return
      sessionStorage.setItem(KEY(id), String(Date.now()))
    } catch { /* storage blocked: just check */ }
    let live = true
    api.post('utilities?resource=themes', { project_id: id, action: 'refresh' }, { timeout: 45_000 })
      .then(r => { if (live && (r as { changed?: boolean } | null)?.changed) void useProjectStore.getState().fetchProjects() })
      .catch(() => { /* a re-read that failed is tried again next time */ })
    return () => { live = false }
  }, [id, hasThemes])
}

export function ThemesUpdatedNote({ project }: { project: Project }) {
  const update = readThemesUpdate(project.metadata)
  const [busy, setBusy] = useState(false)
  if (!update) return null

  const undo = async () => {
    setBusy(true)
    try {
      await api.post('utilities?resource=themes', { project_id: project.id, action: 'set', themes: update.previous })
      await useProjectStore.getState().fetchProjects()
    } catch { /* leave it as it is */ } finally { setBusy(false) }
  }

  return (
    <p className="text-[13px] flex items-center gap-2" style={{ color: 'var(--brand-text-muted)' }}>
      Updated from your notes.
      <button onClick={() => { void undo() }} disabled={busy} className="underline disabled:opacity-40" style={{ color: 'var(--brand-text-secondary)' }}>
        {busy ? 'Undoing…' : 'Undo'}
      </button>
    </p>
  )
}
