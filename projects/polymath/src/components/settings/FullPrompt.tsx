/**
 * Settings: read-only view of a prompt exactly as the model gets it. Your own
 * brief is in it where it goes; a bracketed line stands in for each block of
 * your real data. Fetched once, on first open.
 */

import { useState } from 'react'
import { api } from '../../lib/apiClient'

export type PromptKey = 'ideas' | 'take_draft' | 'take_judge'

type Preview = Record<PromptKey, string>
let cache: Promise<Preview> | null = null
const load = (): Promise<Preview> => {
  cache ??= (api.get('utilities?resource=prompt-preview') as Promise<Preview>).catch(e => { cache = null; throw e })
  return cache
}

export function FullPrompt({ which, label }: { which: PromptKey; label: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && text === null) {
      try { setText((await load())[which] ?? ''); setFailed(false) } catch { setFailed(true) }
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(text ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* no clipboard */ }
  }

  return (
    <div className="mt-3">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="text-[13px] underline"
        style={{ color: 'var(--brand-text-secondary)' }}
      >
        {open ? 'Hide' : 'See'} {label}
      </button>
      {open && (
        <div className="mt-2">
          {failed ? (
            <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>Couldn't load it. Try again.</p>
          ) : text === null ? (
            <p className="text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>Loading…</p>
          ) : (
            <>
              <pre
                className="glass-card-subtle rounded-xl p-3 text-[12px] leading-relaxed whitespace-pre-wrap break-words overflow-y-auto font-mono"
                style={{ maxHeight: '420px', color: 'var(--brand-text-secondary)' }}
              >{text}</pre>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>
                  Brackets stand in for your real notes. Read only.
                </span>
                <button onClick={copy} className="text-[13px] underline" style={{ color: 'var(--brand-text-secondary)' }}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
