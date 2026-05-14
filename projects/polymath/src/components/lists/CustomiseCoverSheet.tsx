/**
 * CustomiseCoverSheet — bottom sheet for overriding a list's cover.
 *
 * Three tabs:
 *   1. Image — paste a URL, see a preview, save.
 *   2. Palette — pick a colour swatch; covers use a gradient poster.
 *   3. Reset — clear overrides, fall back to the auto-derived cover.
 *
 * Persists to lists.settings via updateListSettings (server-side merge
 * preserves the rest of the settings JSONB).
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ImageIcon, Palette, RefreshCw, Check, Link as LinkIcon } from 'lucide-react'
import type { List } from '../../types'
import { useListStore } from '../../stores/useListStore'
import { useToast } from '../ui/toast'
import { OptimizedImage } from '../ui/optimized-image'

interface Props {
  list: List | null
  isOpen: boolean
  onClose: () => void
}

// Six gentle gradient stops the user can pick. RGB triples so the
// poster path on the Lists page can reuse the same vocabulary as the
// per-type accent colours.
const PALETTE: Array<{ label: string; rgb: string }> = [
  { label: 'Cyan',   rgb: '56, 189, 248' },
  { label: 'Violet', rgb: '167, 139, 250' },
  { label: 'Pink',   rgb: '236, 72, 153' },
  { label: 'Amber',  rgb: '252, 211, 77' },
  { label: 'Emerald', rgb: '16, 185, 129' },
  { label: 'Slate',  rgb: '148, 163, 184' },
]

type Tab = 'image' | 'palette' | 'reset'

export function CustomiseCoverSheet({ list, isOpen, onClose }: Props) {
  const { updateListSettings } = useListStore()
  const { addToast } = useToast()
  const [tab, setTab] = useState<Tab>('image')
  const [draftUrl, setDraftUrl] = useState(list?.settings?.cover_image_url ?? '')
  const [draftColor, setDraftColor] = useState(list?.settings?.cover_color ?? PALETTE[0].rgb)
  const [saving, setSaving] = useState(false)

  if (!list) return null

  const saveImage = async () => {
    const url = draftUrl.trim()
    if (!url) {
      addToast({ title: 'Add an image URL first', variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//.test(url)) {
      addToast({ title: 'Use an https URL', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      // Setting an image clears any palette override — covers should
      // resolve to exactly one source.
      await updateListSettings(list.id, { cover_image_url: url, cover_color: null })
      addToast({ title: 'Cover updated', variant: 'success' })
      onClose()
    } catch {
      addToast({ title: "Couldn't save cover", variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const savePalette = async () => {
    setSaving(true)
    try {
      await updateListSettings(list.id, { cover_color: draftColor, cover_image_url: null })
      addToast({ title: 'Cover updated', variant: 'success' })
      onClose()
    } catch {
      addToast({ title: "Couldn't save cover", variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const resetCover = async () => {
    setSaving(true)
    try {
      await updateListSettings(list.id, { cover_image_url: null, cover_color: null })
      addToast({ title: 'Cover reset', variant: 'success' })
      onClose()
    } catch {
      addToast({ title: "Couldn't reset cover", variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[10000] bg-black/65 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-[10001] rounded-t-3xl pb-safe glass-sheet"
            style={{
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            <div className="px-5 pt-3 pb-8">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="min-w-0">
                  <p className="text-[10px] tracking-[0.2em] mb-1" style={{ color: 'rgba(var(--brand-primary-rgb), 0.7)' }}>
                    customise cover
                  </p>
                  <h3 className="text-lg font-semibold text-[var(--brand-text-primary)] truncate">
                    {list.title}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-[var(--brand-text-muted)] hover:text-white transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(12px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tabs */}
              <div
                className="flex gap-1.5 mb-5 p-1 rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.20)',
                }}
              >
                {([
                  { id: 'image', label: 'Image', Icon: ImageIcon },
                  { id: 'palette', label: 'Palette', Icon: Palette },
                  { id: 'reset', label: 'Reset', Icon: RefreshCw },
                ] as const).map(({ id, label, Icon }) => {
                  const active = tab === id
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: active
                          ? 'linear-gradient(180deg, rgba(var(--brand-primary-rgb), 0.22), rgba(var(--brand-primary-rgb), 0.10))'
                          : 'transparent',
                        border: active
                          ? '1px solid rgba(var(--brand-primary-rgb), 0.40)'
                          : '1px solid transparent',
                        color: active ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-secondary)',
                        boxShadow: active
                          ? '0 4px 14px -2px rgba(var(--brand-primary-rgb), 0.30), inset 0 1px 0 rgba(255,255,255,0.10)'
                          : 'none',
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Image tab */}
              {tab === 'image' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] tracking-[0.2em] mb-2 block" style={{ color: 'var(--brand-text-muted)' }}>
                      image url
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                      <input
                        type="url"
                        value={draftUrl}
                        onChange={e => setDraftUrl(e.target.value)}
                        placeholder="https://…"
                        className="soft-input pl-11"
                      />
                    </div>
                    <p className="text-[11px] mt-2 opacity-60" style={{ color: 'var(--brand-text-muted)' }}>
                      Direct image URL — book covers, posters, photos. We'll use it as-is.
                    </p>
                  </div>

                  {draftUrl.trim() && /^https?:\/\//.test(draftUrl.trim()) && (
                    <div>
                      <p className="text-[10px] tracking-[0.2em] mb-2" style={{ color: 'var(--brand-text-muted)' }}>
                        preview
                      </p>
                      <div className="aspect-[3/4] w-32 rounded-xl overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)' }}>
                        <OptimizedImage src={draftUrl.trim()} alt="Cover preview" className="w-full h-full" priority={true} />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={saveImage}
                    disabled={saving || !draftUrl.trim()}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40 active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(180deg, rgb(var(--color-accent-light-rgb)) 0%, rgb(var(--brand-primary-rgb)) 100%)',
                      color: 'black',
                      boxShadow: '0 10px 28px -6px rgba(var(--brand-primary-rgb), 0.55), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.20)',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {saving ? 'Saving…' : 'Use this image'}
                  </button>
                </div>
              )}

              {/* Palette tab */}
              {tab === 'palette' && (
                <div className="space-y-4">
                  <p className="text-[11px] opacity-60" style={{ color: 'var(--brand-text-muted)' }}>
                    Pick a colour. The cover becomes a gradient poster with the list title set in serif.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {PALETTE.map(p => {
                      const selected = draftColor === p.rgb
                      return (
                        <button
                          key={p.rgb}
                          onClick={() => setDraftColor(p.rgb)}
                          className="relative aspect-[3/4] rounded-xl overflow-hidden transition-all"
                          style={{
                            background: `linear-gradient(150deg, rgba(${p.rgb}, 0.85) 0%, rgba(${p.rgb}, 0.35) 45%, #0a0f1c 100%)`,
                            boxShadow: selected
                              ? `0 0 0 2px rgb(${p.rgb}), 0 4px 16px rgba(${p.rgb}, 0.3)`
                              : 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                          }}
                        >
                          {selected && (
                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                              style={{ background: `rgb(${p.rgb})`, color: 'black' }}>
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center px-2">
                            <p className="text-xs text-white/95 italic text-center" style={{ fontFamily: 'var(--brand-font-body)', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
                              {p.label}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={savePalette}
                    disabled={saving}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40 active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(180deg, rgba(${draftColor}, 1) 0%, rgba(${draftColor}, 0.85) 100%)`,
                      color: 'black',
                      boxShadow: `0 10px 28px -6px rgba(${draftColor}, 0.55), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.20)`,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {saving ? 'Saving…' : 'Use this colour'}
                  </button>
                </div>
              )}

              {/* Reset tab */}
              {tab === 'reset' && (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>
                    Clear the override. The cover falls back to the auto-derived one — the first item with an image, or the type-coloured poster if there isn't one.
                  </p>
                  <button
                    onClick={resetCover}
                    disabled={saving}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40 active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: 'var(--brand-text-secondary)',
                      backdropFilter: 'blur(14px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.10)',
                    }}
                  >
                    {saving ? 'Resetting…' : 'Reset to auto'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
