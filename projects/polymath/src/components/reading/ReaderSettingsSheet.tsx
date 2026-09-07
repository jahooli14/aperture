import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import {
  SIZE_LABELS,
  TYPEFACE_LABELS,
  type ReaderPrefs,
  type ReaderSize,
  type ReaderTypeface,
} from '../../lib/readerPrefs'

interface ReaderSettingsSheetProps {
  open: boolean
  prefs: ReaderPrefs
  onChange: (next: ReaderPrefs) => void
  onClose: () => void
}

const SIZES: ReaderSize[] = ['small', 'medium', 'large', 'xlarge']
const TYPEFACES: ReaderTypeface[] = ['reading-serif', 'sans']

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <span
        className="text-[13px]"
        style={{ fontFamily: 'var(--brand-font-body)', color: 'rgba(255,255,255,0.6)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {children}
      </div>
    </div>
  )
}

function Segment({
  active,
  onClick,
  children,
  wide,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`${wide ? 'px-4' : 'px-3'} h-8 rounded-full text-[12px] font-semibold transition-all press-spring`}
      style={{
        background: active ? 'rgba(var(--brand-primary-rgb), 0.9)' : 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
      }}
    >
      {children}
    </button>
  )
}

/**
 * Type settings, out of the toolbar and into a sheet.
 *
 * The old toolbar carried seven controls, three of which were identical
 * "A" icons at slightly different sizes — unreadable at a glance and
 * impossible to hit accurately while holding a phone one-handed. Reading
 * settings are set once and then left alone, so they belong one tap away,
 * not permanently across the top of the thing you're reading.
 *
 * Every change previews live behind the sheet, and persists (readerPrefs).
 */
export function ReaderSettingsSheet({ open, prefs, onChange, onClose }: ReaderSettingsSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[21000] flex items-end md:items-center md:justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full md:w-[420px] z-10 rounded-t-[2rem] md:rounded-[2rem] overflow-hidden"
            style={{
              background: 'rgba(12, 17, 25, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full bg-white/10" />
              </div>

              <div className="flex items-center justify-between px-6 pt-4 pb-1">
                <span
                  className="text-[11px] uppercase tracking-[0.32em] font-semibold"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  Reading
                </span>
                <button
                  onClick={onClose}
                  className="h-9 w-9 -mr-2 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 opacity-60" />
                </button>
              </div>

              <div className="px-6 pb-6 divide-y divide-white/[0.06]">
                <Row label="Typeface">
                  {TYPEFACES.map(face => (
                    <Segment
                      key={face}
                      wide
                      active={prefs.typeface === face}
                      onClick={() => onChange({ ...prefs, typeface: face })}
                    >
                      <span style={{ fontFamily: face === 'sans' ? 'var(--brand-font-body)' : 'var(--brand-font-reading)' }}>
                        {TYPEFACE_LABELS[face]}
                      </span>
                    </Segment>
                  ))}
                </Row>

                <Row label="Size">
                  {SIZES.map(size => (
                    <Segment
                      key={size}
                      active={prefs.size === size}
                      onClick={() => onChange({ ...prefs, size })}
                    >
                      <span
                        aria-label={SIZE_LABELS[size]}
                        style={{ fontSize: size === 'small' ? 11 : size === 'medium' ? 13 : size === 'large' ? 15 : 17 }}
                      >
                        A
                      </span>
                    </Segment>
                  ))}
                </Row>

                <Row label="Line spacing">
                  <Segment active={!prefs.looseLines} onClick={() => onChange({ ...prefs, looseLines: false })} wide>
                    Normal
                  </Segment>
                  <Segment active={prefs.looseLines} onClick={() => onChange({ ...prefs, looseLines: true })} wide>
                    Loose
                  </Segment>
                </Row>

                <Row label="Column width">
                  <Segment active={prefs.width === 'narrow'} onClick={() => onChange({ ...prefs, width: 'narrow' })} wide>
                    Narrow
                  </Segment>
                  <Segment active={prefs.width === 'wide'} onClick={() => onChange({ ...prefs, width: 'wide' })} wide>
                    Wide
                  </Segment>
                </Row>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
