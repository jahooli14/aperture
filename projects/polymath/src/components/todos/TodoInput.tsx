/**
 * TodoInput - NLP-powered quick entry
 *
 * Uses the app's established surface color system (#1e2d45)
 * so the input feels like a real surface, not a ghost element.
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Tag, Clock, AlertCircle, MapPin } from 'lucide-react'
import { parseTodo, describeDate, describeTime, formatMinutes, PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/todoNLP'
import { cn } from '../../lib/utils'
import { handleInputFocus } from '../../utils/keyboard'

interface TodoInputProps {
  onAdd: (parsed: ReturnType<typeof parseTodo>) => void
  placeholder?: string
  autoFocus?: boolean
  defaultScheduledDate?: string
}

export function TodoInput({
  onAdd,
  placeholder = 'Add a task…',
  autoFocus = false,
  defaultScheduledDate,
}: TodoInputProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleSubmit = useCallback(() => {
    if (!parsed.text.trim()) return
    onAdd({
      ...parsed,
      scheduledDate: parsed.scheduledDate ?? (defaultScheduledDate || undefined),
    })
    setValue('')
  }, [parsed, onAdd, defaultScheduledDate])

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

  const hasText = parsed.text.trim().length > 0

  return (
    <div
      className="rounded-2xl transition-all duration-200"
      style={{
        // Use the established surface-2 color — visible, inviting, not a ghost
        background: 'var(--premium-surface-2)',
        backdropFilter: 'blur(20px)',
        boxShadow: focused
          ? 'inset 0 0 0 1.5px rgba(99,179,237,0.55), 0 4px 24px rgba(0,0,0,0.35)'
          : 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Hint — shown when focused+empty */}
      <AnimatePresence>
        {focused && !value && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
            className="px-4 pt-3 pb-1"
          >
            <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
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
              <Chip icon={<Clock className="h-3 w-3" />} color="text-purple-400" bg="bg-purple-500/15">
                Someday
              </Chip>
            )}
            {parsed.scheduledDate && (
              <Chip icon={<Calendar className="h-3 w-3" />} color="text-blue-400" bg="bg-blue-500/15">
                {describeDate(parsed.scheduledDate)}
              </Chip>
            )}
            {parsed.scheduledTime && (
              <Chip icon={<Clock className="h-3 w-3" />} color="text-blue-400" bg="bg-blue-500/15">
                {describeTime(parsed.scheduledTime)}
              </Chip>
            )}
            {parsed.deadlineDate && (
              <Chip icon={<AlertCircle className="h-3 w-3" />} color="text-red-400" bg="bg-red-500/15">
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
              <Chip key={tag} icon={<Tag className="h-3 w-3" />} color="text-emerald-400" bg="bg-emerald-500/15">
                {tag}
              </Chip>
            ))}
            {parsed.areaName && (
              <Chip icon={<MapPin className="h-3 w-3" />} color="text-amber-400" bg="bg-amber-500/15">
                {parsed.areaName}
              </Chip>
            )}
            {parsed.estimatedMinutes && (
              <Chip icon={<Clock className="h-3 w-3" />} color="text-sky-400" bg="bg-sky-500/15">
                {formatMinutes(parsed.estimatedMinutes)}
              </Chip>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input row */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Fake checkbox */}
        <div
          className={cn(
            'flex-shrink-0 h-[20px] w-[20px] rounded-[6px] border-2 transition-all duration-200',
            hasText
              ? 'border-blue-400/70'
              : 'border-white/20'
          )}
        />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => { setFocused(true); handleInputFocus(e) }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 text-[15px] leading-snug outline-none"
          style={{
            color: 'var(--premium-text-primary)',
            backgroundColor: 'transparent',
          }}
        />

        {/* Return button */}
        <AnimatePresence>
          {hasText && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.1 }}
              onClick={handleSubmit}
              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all active:scale-95"
              style={{
                color: 'rgba(147,197,253,0.8)',
                background: 'rgba(59,130,246,0.12)',
                boxShadow: 'inset 0 0 0 1px rgba(99,179,237,0.2)',
              }}
            >
              Return
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function Chip({
  icon, color, bg, children
}: {
  icon: React.ReactNode
  color: string
  bg: string
  children: React.ReactNode
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', color, bg)}>
      {icon}
      {children}
    </span>
  )
}

function HintToken({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: 'rgba(147,197,253,0.55)' }} className="font-medium">{children}</span>
  )
}
