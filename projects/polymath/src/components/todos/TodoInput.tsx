/**
 * TodoInput - NLP-powered quick entry
 *
 * Inspired by Linear and Things 3: a spacious, prominent input
 * that feels like adding to YOUR list — not a chat box.
 *
 * Type naturally: "call dentist tomorrow at 3pm !high #health 30min"
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Tag, Clock, AlertCircle, MapPin } from 'lucide-react'
import { parseTodo, describeDate, describeTime, PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/todoNLP'
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
      className={cn(
        'rounded-2xl transition-all duration-200 overflow-hidden',
        focused
          ? 'ring-1 ring-white/25 shadow-lg shadow-black/20'
          : 'hover:bg-white/[0.02]'
      )}
      style={{
        background: focused
          ? 'rgba(255,255,255,0.07)'
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Main input row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Fake checkbox — signals "this is a task" */}
        <div
          className={cn(
            'flex-shrink-0 h-[18px] w-[18px] rounded-[5px] border-2 transition-all duration-200',
            hasText
              ? 'border-blue-400/60'
              : 'border-white/15'
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
          className="flex-1 bg-transparent text-[15px] leading-tight outline-none placeholder:text-white/25"
          style={{ color: 'var(--premium-text-primary)' }}
        />

        {/* Return hint — only when text is present */}
        <AnimatePresence>
          {hasText && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.1 }}
              onClick={handleSubmit}
              className="flex-shrink-0 px-2 py-0.5 rounded-md bg-white/8 text-white/40 text-[11px] font-medium hover:bg-white/12 hover:text-white/60 transition-all border border-white/10"
            >
              Return
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Metadata chips */}
      <AnimatePresence>
        {focused && hasMetadata && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-wrap gap-1.5 px-4 pb-3 overflow-hidden"
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
                {parsed.estimatedMinutes >= 60
                  ? `${parsed.estimatedMinutes / 60}h`
                  : `${parsed.estimatedMinutes}m`}
              </Chip>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint — shown when focused and empty */}
      <AnimatePresence>
        {focused && !value && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.12 }}
            className="px-4 pb-3 overflow-hidden"
          >
            <p className="text-[11px] text-white/25 leading-relaxed">
              Try{' '}
              <HintToken>tomorrow</HintToken>,{' '}
              <HintToken>at 3pm</HintToken>,{' '}
              <HintToken>!high</HintToken>,{' '}
              <HintToken>#tag</HintToken>,{' '}
              <HintToken>@area</HintToken>,{' '}
              <HintToken>30min</HintToken>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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
    <span className="text-white/40 font-medium">{children}</span>
  )
}
