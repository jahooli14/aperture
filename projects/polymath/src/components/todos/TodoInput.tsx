/**
 * TodoInput - NLP-powered quick entry with Smart Capture classification
 *
 * Uses the app's established surface color system (#1e2d45)
 * so the input feels like a real surface, not a ghost element.
 *
 * Smart Capture: as the user types, the input classifies what they're
 * capturing (task / thought / article / list) and shows a subtle inline
 * type indicator. On submit, non-todo items are auto-routed.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Tag, Clock, AlertCircle, MapPin } from 'lucide-react'
import { parseTodo, describeDate, describeTime, formatMinutes, PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/todoNLP'
import { classifyCapture, isLikelyUrl, CAPTURE_TYPE_META, type CaptureType } from '../../lib/smartCapture'
import { cn } from '../../lib/utils'
import { handleInputFocus } from '../../utils/keyboard'

interface TodoInputProps {
  onAdd: (parsed: ReturnType<typeof parseTodo>) => void
  onCaptureThought?: (text: string) => void
  onCaptureArticle?: (url: string) => void
  placeholder?: string
  autoFocus?: boolean
  defaultScheduledDate?: string
}

export function TodoInput({
  onAdd,
  onCaptureThought,
  onCaptureArticle,
  placeholder = 'Add a task',
  autoFocus = false,
  defaultScheduledDate,
}: TodoInputProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [captureType, setCaptureType] = useState<CaptureType>('ambiguous')
  const [captureConfidence, setCaptureConfidence] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const classifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parsed = parseTodo(value)

  const hasMetadata =
    parsed.scheduledDate ||
    parsed.scheduledTime ||
    parsed.deadlineDate ||
    parsed.priority > 0 ||
    parsed.tags.length > 0 ||
    parsed.areaName ||
    parsed.estimatedMinutes ||
    parsed.isSomeday

  //  Debounced classification 
  useEffect(() => {
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current)

    if (!value.trim()) {
      setCaptureType('ambiguous')
      setCaptureConfidence(0)
      return
    }

    classifyTimerRef.current = setTimeout(() => {
      const result = classifyCapture(value)
      setCaptureType(result.type)
      setCaptureConfidence(result.confidence)
    }, 200)

    return () => {
      if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current)
    }
  }, [value])

  //  Paste: detect URLs immediately 
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (isLikelyUrl(pasted)) {
      // Override classification immediately without waiting for debounce
      setCaptureType('article')
      setCaptureConfidence(0.97)
    }
  }, [])

  //  Submit with smart routing 
  const handleSubmit = useCallback(() => {
    if (!parsed.text.trim() && !value.trim()) return

    const classification = classifyCapture(value)

    // Route article: if we have a URL handler and text is a URL
    if (classification.type === 'article' && isLikelyUrl(value.trim()) && onCaptureArticle) {
      onCaptureArticle(value.trim())
      setValue('')
      return
    }

    // Route thought: if we have a thought handler and confidence is high
    if (classification.type === 'thought' && classification.confidence >= 0.55 && onCaptureThought) {
      onCaptureThought(value.trim())
      setValue('')
      return
    }

    // Default: create as a todo (includes ambiguous, todo, list-item, low-confidence)
    if (!parsed.text.trim()) return
    onAdd({
      ...parsed,
      scheduledDate: parsed.scheduledDate ?? (defaultScheduledDate || undefined),
    })
    setValue('')
  }, [parsed, value, onAdd, onCaptureThought, onCaptureArticle, defaultScheduledDate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setValue('')
      inputRef.current?.blur()
    }
  }

  const hasText = value.trim().length > 0

  // Determine whether to show the type pill
  // Show when: focused + has text + type is not default ambiguous
  const showTypePill = focused && hasText && captureType !== 'ambiguous' && captureConfidence > 0.25
  const typeMeta = CAPTURE_TYPE_META[captureType]

  return (
    <div
      className="rounded-lg transition-all duration-200"
      style={{
        background: 'var(--brand-glass-bg)',
        border: focused ? '2px solid rgba(255,255,255,0.28)' : '2px solid var(--glass-surface-hover)',
        boxShadow: focused ? '4px 4px 0 rgba(0,0,0,0.8)' : '0 4px 16px rgba(0,0,0,0.6)',
      }}
    >
      {/* Hint  shown when focused+empty */}
      <AnimatePresence>
        {focused && !value && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
            className="px-4 pt-3 pb-1"
          >
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--brand-primary)" }}>
              Try{' '}
              <HintToken>tom</HintToken>,{' '}
              <HintToken>eow</HintToken>,{' '}
              <HintToken>morning</HintToken>,{' '}
              <HintToken>!high</HintToken>,{' '}
              <HintToken>#tag</HintToken>,{' '}
              <HintToken>@area</HintToken>,{' '}
              <HintToken>30min</HintToken>,{' '}
              <HintToken>due:friday</HintToken>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart capture type hint  shown when a non-todo type is detected */}
      <AnimatePresence>
        {showTypePill && captureType !== 'todo' && (
          <motion.div
            key={captureType}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="px-4 pt-3 pb-1"
          >
            <p className="text-[11px] leading-relaxed" style={{ color: typeMeta.color }}>
              {typeMeta.icon} {CAPTURE_TYPE_META[captureType].hint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metadata chips */}
      <AnimatePresence>
        {focused && hasMetadata && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1"
          >
            {parsed.isSomeday && (
              <Chip icon={<Clock className="h-3 w-3" />} color="text-brand-primary" bg="bg-brand-primary/15">
                Someday
              </Chip>
            )}
            {parsed.scheduledDate && (
              <Chip icon={<Calendar className="h-3 w-3" />} color="text-brand-primary" bg="bg-brand-primary/15">
                {describeDate(parsed.scheduledDate)}
              </Chip>
            )}
            {parsed.scheduledTime && (
              <Chip icon={<Clock className="h-3 w-3" />} color="text-brand-primary" bg="bg-brand-primary/15">
                {describeTime(parsed.scheduledTime)}
              </Chip>
            )}
            {parsed.deadlineDate && (
              <Chip icon={<AlertCircle className="h-3 w-3" />} color="text-brand-text-secondary" bg="bg-brand-primary/15">
                Due {describeDate(parsed.deadlineDate)}
              </Chip>
            )}
            {parsed.priority > 0 && (
              <Chip
                icon={<span className="font-black text-[10px] leading-none">!</span>}
                color={PRIORITY_COLORS[parsed.priority]}
                bg="bg-white/8"
              >
                {PRIORITY_LABELS[parsed.priority]}
              </Chip>
            )}
            {parsed.tags.map(tag => (
              <Chip key={tag} icon={<Tag className="h-3 w-3" />} color="text-brand-text-secondary" bg="bg-brand-primary/15">
                {tag}
              </Chip>
            ))}
            {parsed.areaName && (
              <Chip icon={<MapPin className="h-3 w-3" />} color="text-brand-text-secondary" bg="bg-brand-primary/15">
                {parsed.areaName}
              </Chip>
            )}
            {parsed.estimatedMinutes && (
              <Chip icon={<Clock className="h-3 w-3" />} color="text-brand-primary" bg="bg-brand-primary/15">
                {formatMinutes(parsed.estimatedMinutes)}
              </Chip>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input row */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Fake checkbox / morphing type icon */}
        <AnimatePresence mode="wait">
          {showTypePill && captureType !== 'todo' ? (
            <motion.div
              key={captureType}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex-shrink-0 h-[20px] w-[20px] flex items-center justify-center rounded-lg text-[13px] leading-none select-none"
              style={{
                background: typeMeta.color.replace('0.8)', '0.15)'),
                boxShadow: `0 0 0 1.5px ${typeMeta.color}`,
              }}
              title={typeMeta.label}
            >
              {typeMeta.icon}
            </motion.div>
          ) : (
            <motion.div
              key="checkbox"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="flex-shrink-0 h-[18px] w-[18px] rounded-lg transition-all duration-200"
              style={{
                border: hasText ? '2px solid rgba(147,197,253,0.6)' : '2px solid rgba(255,255,255,0.2)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => { setFocused(true); handleInputFocus(e) }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 text-[15px] leading-snug outline-none"
          style={{
            color: 'var(--brand-text-primary)',
            backgroundColor: 'transparent',
          }}
        />

        {/* Type pill indicator  compact, right-aligned */}
        <AnimatePresence>
          {showTypePill && (
            <motion.span
              key={captureType}
              initial={{ opacity: 0, scale: 0.85, x: 4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 4 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide select-none"
              style={{
                color: typeMeta.color,
                background: typeMeta.color.replace('0.8)', '0.1)'),
                border: `1.5px solid ${typeMeta.color.replace('0.8)', '0.35)')}`,
              }}
            >
              {typeMeta.icon} {typeMeta.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Return button */}
        <AnimatePresence>
          {hasText && !showTypePill && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.1 }}
              onClick={handleSubmit}
              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all active:scale-95"
              style={{
                color: "var(--brand-text-secondary)",
                background: 'rgba(var(--brand-primary-rgb),0.1)',
                border: '1px solid rgba(99,179,237,0.35)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              Return
            </motion.button>
          )}
          {hasText && showTypePill && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.1 }}
              onClick={handleSubmit}
              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all active:scale-95"
              style={{
                color: typeMeta.color,
                background: typeMeta.color.replace('0.8)', '0.1)'),
                border: `2px solid ${typeMeta.color.replace('0.8)', '0.4)')}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

//  Sub-components 

function Chip({
  icon, color, bg, children
}: {
  icon: React.ReactNode
  color: string
  bg: string
  children: React.ReactNode
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide', color, bg)}>
      {icon}
      {children}
    </span>
  )
}

function HintToken({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "var(--brand-primary)" }} className="font-medium">{children}</span>
  )
}
