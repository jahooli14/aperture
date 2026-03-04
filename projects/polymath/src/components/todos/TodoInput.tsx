/**
 * TodoInput - NLP-powered quick entry
 *
 * Type naturally: "call dentist tomorrow !high #health 30min"
 * Live preview chips appear as you type, showing parsed metadata.
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Calendar, Tag, Clock, AlertCircle, MapPin } from 'lucide-react'
import { parseTodo, describeDate, PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/todoNLP'
import { cn } from '../../lib/utils'
import { handleInputFocus } from '../../utils/keyboard'

interface TodoInputProps {
  onAdd: (parsed: ReturnType<typeof parseTodo>) => void
  placeholder?: string
  autoFocus?: boolean
  defaultScheduledDate?: string   // Pre-fill "today" when in Today view
}

export function TodoInput({
  onAdd,
  placeholder = 'Add todo… (try "call dentist tomorrow !high #health")',
  autoFocus = false,
  defaultScheduledDate,
}: TodoInputProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = parseTodo(value)

  const hasMetadata =
    parsed.scheduledDate ||
    parsed.deadlineDate ||
    parsed.priority > 0 ||
    parsed.tags.length > 0 ||
    parsed.areaName ||
    parsed.estimatedMinutes ||
    parsed.isSomeday

  const handleSubmit = useCallback(() => {
    if (!parsed.text.trim()) return

    // If in Today view and no date specified, default to today
    const toSubmit = {
      ...parsed,
      scheduledDate: parsed.scheduledDate ?? (defaultScheduledDate || undefined),
    }

    onAdd(toSubmit)
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

  return (
    <div className="relative">
      {/* Input row */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200',
          focused
            ? 'ring-1 ring-white/20'
            : 'hover:bg-white/[0.03]'
        )}
        style={{
          background: focused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Plus icon / submit */}
        <button
          onClick={handleSubmit}
          disabled={!parsed.text.trim()}
          className={cn(
            'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all',
            parsed.text.trim()
              ? 'bg-blue-500 text-white hover:bg-blue-400'
              : 'border border-white/20 text-white/30'
          )}
          aria-label="Add todo"
        >
          <Plus className="h-4 w-4" />
        </button>

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
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
          style={{ color: 'var(--premium-text-primary)' }}
        />
      </div>

      {/* Live preview chips */}
      <AnimatePresence>
        {focused && hasMetadata && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-wrap gap-1.5 px-4 pt-2 pb-1 overflow-hidden"
          >
            {/* Someday */}
            {parsed.isSomeday && (
              <Chip icon={<Clock className="h-3 w-3" />} color="text-purple-400" bg="bg-purple-500/15">
                Someday
              </Chip>
            )}

            {/* Scheduled date */}
            {parsed.scheduledDate && (
              <Chip icon={<Calendar className="h-3 w-3" />} color="text-blue-400" bg="bg-blue-500/15">
                {describeDate(parsed.scheduledDate)}
              </Chip>
            )}

            {/* Deadline */}
            {parsed.deadlineDate && (
              <Chip icon={<AlertCircle className="h-3 w-3" />} color="text-red-400" bg="bg-red-500/15">
                Due {describeDate(parsed.deadlineDate)}
              </Chip>
            )}

            {/* Priority */}
            {parsed.priority > 0 && (
              <Chip
                icon={<span className="font-black text-[10px]">!</span>}
                color={PRIORITY_COLORS[parsed.priority]}
                bg="bg-white/10"
              >
                {PRIORITY_LABELS[parsed.priority]}
              </Chip>
            )}

            {/* Tags */}
            {parsed.tags.map(tag => (
              <Chip key={tag} icon={<Tag className="h-3 w-3" />} color="text-emerald-400" bg="bg-emerald-500/15">
                {tag}
              </Chip>
            ))}

            {/* Area */}
            {parsed.areaName && (
              <Chip icon={<MapPin className="h-3 w-3" />} color="text-amber-400" bg="bg-amber-500/15">
                {parsed.areaName}
              </Chip>
            )}

            {/* Time estimate */}
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

      {/* Hint text */}
      {focused && !value && (
        <p className="px-4 py-1 text-[10px] text-white/20">
          Use <span className="text-white/30">tomorrow</span>,{' '}
          <span className="text-white/30">#tag</span>,{' '}
          <span className="text-white/30">!high</span>,{' '}
          <span className="text-white/30">@area</span>,{' '}
          <span className="text-white/30">30min</span>
        </p>
      )}
    </div>
  )
}

// ─── Chip sub-component ─────────────────────────────────────

function Chip({
  icon,
  color,
  bg,
  children
}: {
  icon: React.ReactNode
  color: string
  bg: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
        color, bg
      )}
    >
      {icon}
      {children}
    </span>
  )
}
