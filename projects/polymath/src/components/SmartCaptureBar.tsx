/**
 * SmartCaptureBar — universal capture input for the HomePage
 *
 * More prominent than the compact TodoInput. Understands what you're
 * typing and routes it to the right destination: todo, thought, article,
 * or list item.
 *
 * Features:
 *   - Morphing left-side icon (animates on type change)
 *   - URL paste → shows inline link preview card
 *   - Keyboard hint footer
 *   - All classification is local (smartCapture.ts, no API calls)
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseTodo } from '../lib/todoNLP'
import {
  classifyCapture,
  isLikelyUrl,
  CAPTURE_TYPE_META,
  type CaptureType,
  type CaptureClassification,
} from '../lib/smartCapture'

interface SmartCaptureBarProps {
  placeholder?: string
  onCaptureTodo?: (parsed: ReturnType<typeof parseTodo>) => void
  onCaptureThought?: (text: string) => void
  onCaptureArticle?: (url: string, title?: string) => void
  onCaptureListItem?: (text: string, listType?: string) => void
}

interface UrlPreview {
  url: string
  hostname: string
  faviconUrl: string
}

function buildUrlPreview(url: string): UrlPreview {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return {
      url,
      hostname: u.hostname.replace(/^www\./, ''),
      faviconUrl: `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`,
    }
  } catch {
    return { url, hostname: url, faviconUrl: '' }
  }
}

export function SmartCaptureBar({
  placeholder = 'Capture anything — task, thought, article, idea…',
  onCaptureTodo,
  onCaptureThought,
  onCaptureArticle,
  onCaptureListItem,
}: SmartCaptureBarProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [classification, setClassification] = useState<CaptureClassification>({
    type: 'ambiguous',
    confidence: 0,
    hint: CAPTURE_TYPE_META.ambiguous.hint,
    icon: CAPTURE_TYPE_META.ambiguous.icon,
    color: CAPTURE_TYPE_META.ambiguous.color,
  })
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const classifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const captureType: CaptureType = classification.type
  const typeMeta = CAPTURE_TYPE_META[captureType]
  const hasText = value.trim().length > 0
  const showClassification = hasText && classification.confidence > 0.2 && captureType !== 'ambiguous'

  // ── Debounced classification ──
  useEffect(() => {
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current)

    if (!value.trim()) {
      setClassification({
        type: 'ambiguous',
        confidence: 0,
        hint: CAPTURE_TYPE_META.ambiguous.hint,
        icon: CAPTURE_TYPE_META.ambiguous.icon,
        color: CAPTURE_TYPE_META.ambiguous.color,
      })
      setUrlPreview(null)
      return
    }

    classifyTimerRef.current = setTimeout(() => {
      const result = classifyCapture(value)
      setClassification(result)

      if (result.type === 'article' && isLikelyUrl(value.trim())) {
        setUrlPreview(buildUrlPreview(value.trim()))
      } else {
        setUrlPreview(null)
      }
    }, 200)

    return () => {
      if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current)
    }
  }, [value])

  // ── Paste: detect URLs immediately ──
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (isLikelyUrl(pasted)) {
      // Immediately override — don't wait for debounce
      const result: CaptureClassification = {
        type: 'article',
        confidence: 0.97,
        hint: 'Looks like a link — save to Reading?',
        icon: CAPTURE_TYPE_META.article.icon,
        color: CAPTURE_TYPE_META.article.color,
        alternativeType: 'todo',
      }
      setClassification(result)
      setUrlPreview(buildUrlPreview(pasted.trim()))
    }
  }, [])

  // ── Submit with smart routing ──
  const handleSubmit = useCallback(() => {
    if (!value.trim()) return

    const final = classifyCapture(value)

    if (final.type === 'article' && isLikelyUrl(value.trim()) && onCaptureArticle) {
      onCaptureArticle(value.trim())
      setValue('')
      setUrlPreview(null)
      return
    }

    if (final.type === 'thought' && final.confidence >= 0.55 && onCaptureThought) {
      onCaptureThought(value.trim())
      setValue('')
      return
    }

    if (final.type === 'list-item' && onCaptureListItem) {
      onCaptureListItem(value.trim())
      setValue('')
      return
    }

    // Default: create as todo
    if (onCaptureTodo) {
      const parsed = parseTodo(value)
      if (parsed.text.trim()) {
        onCaptureTodo(parsed)
        setValue('')
      }
    }
  }, [value, onCaptureTodo, onCaptureThought, onCaptureArticle, onCaptureListItem])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setValue('')
      setUrlPreview(null)
      inputRef.current?.blur()
    }
  }

  // Effective border color shifts to match capture type when classified
  const borderColor = showClassification
    ? typeMeta.color.replace('0.8)', '0.45)')
    : focused
    ? 'rgba(99,179,237,0.4)'
    : 'rgba(255,255,255,0.10)'

  return (
    <div className="w-full">
      <div
        className="rounded-2xl transition-all duration-200 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          boxShadow: focused
            ? `inset 0 0 0 1.5px ${borderColor}, 0 6px 32px rgba(0,0,0,0.4)`
            : `inset 0 0 0 1px ${borderColor}, 0 2px 12px rgba(0,0,0,0.25)`,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Main input row */}
        <div className="flex items-center gap-3 px-4 py-4">
          {/* Morphing type icon (left side) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={captureType}
              initial={{ opacity: 0, scale: 0.6, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 15 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex-shrink-0 h-[28px] w-[28px] flex items-center justify-center rounded-[8px] text-[15px] leading-none select-none"
              style={
                showClassification
                  ? {
                      background: typeMeta.color.replace('0.8)', '0.15)'),
                      boxShadow: `0 0 0 1.5px ${typeMeta.color.replace('0.8)', '0.35)')}`,
                      transition: 'background 0.25s, box-shadow 0.25s',
                    }
                  : {
                      background: 'rgba(255,255,255,0.06)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.10)',
                      transition: 'background 0.25s, box-shadow 0.25s',
                    }
              }
              title={showClassification ? typeMeta.label : 'Smart Capture'}
            >
              {showClassification ? typeMeta.icon : '✦'}
            </motion.div>
          </AnimatePresence>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            className="flex-1 text-[16px] leading-snug outline-none"
            style={{
              color: 'var(--premium-text-primary, rgba(255,255,255,0.9))',
              backgroundColor: 'transparent',
            }}
          />

          {/* Capture type pill (right) */}
          <AnimatePresence>
            {showClassification && (
              <motion.span
                key={captureType}
                initial={{ opacity: 0, scale: 0.8, x: 6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 6 }}
                transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium select-none"
                style={{
                  color: typeMeta.color,
                  background: typeMeta.color.replace('0.8)', '0.12)'),
                  boxShadow: `inset 0 0 0 1px ${typeMeta.color.replace('0.8)', '0.25)')}`,
                }}
              >
                {typeMeta.icon} {typeMeta.label}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <AnimatePresence>
            {hasText && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
                onClick={handleSubmit}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all active:scale-95"
                style={
                  showClassification
                    ? {
                        color: typeMeta.color,
                        background: typeMeta.color.replace('0.8)', '0.15)'),
                        boxShadow: `inset 0 0 0 1px ${typeMeta.color.replace('0.8)', '0.30)')}`,
                      }
                    : {
                        color: 'rgba(147,197,253,0.8)',
                        background: 'rgba(59,130,246,0.12)',
                        boxShadow: 'inset 0 0 0 1px rgba(99,179,237,0.2)',
                      }
                }
              >
                ↵
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Contextual hint row */}
        <AnimatePresence>
          {focused && hasText && showClassification && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-3"
                style={{
                  borderTop: `1px solid ${typeMeta.color.replace('0.8)', '0.10)')}`,
                }}
              >
                <p
                  className="text-[11px] leading-relaxed pt-2.5"
                  style={{ color: typeMeta.color.replace('0.8)', '0.6)') }}
                >
                  {classification.hint}
                  {classification.alternativeType && classification.alternativeType !== captureType && (
                    <> · or keep as {CAPTURE_TYPE_META[classification.alternativeType].label}</>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* URL preview card */}
        <AnimatePresence>
          {urlPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div
                className="mx-3 mb-3 px-3 py-2.5 rounded-xl flex items-center gap-3"
                style={{
                  background: 'rgba(34,211,238,0.07)',
                  border: '1px solid rgba(34,211,238,0.18)',
                }}
              >
                {urlPreview.faviconUrl && (
                  <img
                    src={urlPreview.faviconUrl}
                    alt=""
                    className="h-4 w-4 rounded flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12px] font-medium truncate"
                    style={{ color: 'rgba(34,211,238,0.85)' }}
                  >
                    {urlPreview.hostname}
                  </p>
                  <p
                    className="text-[11px] truncate"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {urlPreview.url.length > 60
                      ? urlPreview.url.substring(0, 60) + '…'
                      : urlPreview.url}
                  </p>
                </div>
                <span
                  className="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    color: 'rgba(34,211,238,0.7)',
                    background: 'rgba(34,211,238,0.12)',
                  }}
                >
                  📖 Save
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcut hint footer */}
      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, delay: 0.05 }}
            className="flex items-center justify-between px-2 pt-2"
          >
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              Press <kbd className="font-mono">Enter</kbd> to capture
            </span>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              <kbd className="font-mono">Esc</kbd> to clear
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
