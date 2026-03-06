/**
 * Todos Page - Things 3-inspired task management
 *
 * Layout:
 *   - Left sidebar: Inbox / Today / Upcoming / Someday / Areas
 *   - Main area: todo list for the active view + NLP input at top
 *
 * Views:
 *   inbox    - Uncategorized todos (no date, no area)
 *   today    - Due today + overdue
 *   upcoming - Scheduled for the future (next 7 days grouped by day)
 *   someday  - Parked ideas
 *   logbook  - Completed items
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, Sun, CalendarDays, Archive, BookOpen,
  CheckCheck, Sparkles, CalendarCheck, Layers, BookMarked,
  Clock,
} from 'lucide-react'
import {
  useTodoStore,
  selectInbox,
  selectToday,
  selectUpcoming,
  selectSomeday,
  selectLogbook,
  type TodoView,
  type Todo,
  type TodoArea,
} from '../stores/useTodoStore'
import { TodoInput } from '../components/todos/TodoInput'
import { TodoItem, LogbookItem } from '../components/todos/TodoItem'
import { parseTodo, describeDate, formatMinutes } from '../lib/todoNLP'
import { cn } from '../lib/utils'
import { useToast } from '../components/ui/toast'

// ─── View config ─────────────────────────────────────────────

const VIEWS: { id: TodoView; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'inbox',    label: 'Inbox',    icon: Inbox,       hint: 'Uncategorized' },
  { id: 'today',    label: 'Today',    icon: Sun,         hint: 'Due today + overdue' },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays, hint: 'Scheduled ahead' },
  { id: 'someday',  label: 'Someday',  icon: Archive,     hint: 'Parked ideas' },
  { id: 'logbook',  label: 'Logbook',  icon: BookOpen,    hint: 'Completed' },
]

// ─── Main page ───────────────────────────────────────────────

export function TodosPage() {
  const {
    todos, areas, loading,
    activeView, setActiveView,
    fetchTodos, fetchAreas,
    addTodo, updateTodo, toggleTodo, deleteTodo,
  } = useTodoStore()

  const { addToast } = useToast()

  useEffect(() => {
    fetchTodos()
    fetchAreas()
  }, [])

  // ── Counts for sidebar badges ──
  const todayCount   = selectToday(todos).length
  const inboxCount   = selectInbox(todos).length
  const upcomingCount = selectUpcoming(todos).length
  const somedayCount  = selectSomeday(todos).length
  const logbookCount  = selectLogbook(todos).length

  const counts: Record<TodoView, number> = {
    inbox:    inboxCount,
    today:    todayCount,
    upcoming: upcomingCount,
    someday:  somedayCount,
    logbook:  logbookCount,
  }

  // ── Get todos for active view ──
  const viewTodos = (() => {
    switch (activeView) {
      case 'today':    return selectToday(todos)
      case 'upcoming': return selectUpcoming(todos)
      case 'someday':  return selectSomeday(todos)
      case 'logbook':  return selectLogbook(todos)
      default:         return selectInbox(todos)
    }
  })()

  // ── Add todo from NLP input ──
  const handleAdd = async (parsed: ReturnType<typeof parseTodo>) => {
    const input: Partial<Todo> & { text: string } = {
      text: parsed.text,
      priority: parsed.priority,
      tags: [
        ...parsed.tags,
        ...(parsed.isSomeday ? ['someday'] : []),
      ],
      estimated_minutes: parsed.estimatedMinutes,
      scheduled_time: parsed.scheduledTime,
    }

    // Date: use parsed, or apply view context defaults
    if (parsed.isSomeday) {
      // no date - just tag
    } else if (parsed.scheduledDate) {
      input.scheduled_date = parsed.scheduledDate
    } else if (activeView === 'today') {
      input.scheduled_date = new Date().toISOString().split('T')[0]
    }

    if (parsed.deadlineDate) input.deadline_date = parsed.deadlineDate

    // Area: look up by name if parsed
    if (parsed.areaName) {
      const area = areas.find(a => a.name.toLowerCase() === parsed.areaName!.toLowerCase())
      if (area) input.area_id = area.id
    }

    await addTodo(input)
  }

  // ── Toggle with undo toast ──
  const handleToggle = async (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    await toggleTodo(id)

    if (!todo.done) {
      // Was active, now completing → offer undo
      addToast({
        title: 'Done!',
        description: todo.text.length > 40 ? todo.text.slice(0, 40) + '…' : todo.text,
        variant: 'success',
        duration: 4000,
      })
    }
  }

  // ── Delete with undo toast ──
  const handleDelete = async (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    await deleteTodo(id)

    addToast({
      title: 'Deleted',
      description: todo.text.length > 40 ? todo.text.slice(0, 40) + '…' : todo.text,
      variant: 'default',
      duration: 5000,
    })
  }

  const todayYMD = new Date().toISOString().split('T')[0]

  // Daily work estimate for Today view
  const todayTodos = selectToday(todos)
  const overdueCount = todayTodos.filter(t =>
    (t.deadline_date && t.deadline_date < todayYMD) ||
    (t.scheduled_date && t.scheduled_date < todayYMD)
  ).length
  const totalEstimatedMinutes = todayTodos.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0)

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--premium-surface-base)' }}
    >
      {/* Premium Header */}
      <div className="px-4 pt-7 pb-4 max-w-3xl mx-auto w-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
               style={{ color: 'rgba(148,163,184,0.5)' }}>
              {dayName} · {dateStr}
            </p>
            <h1 className="text-3xl font-bold tracking-tight"
                style={{ color: 'var(--premium-text-primary)' }}>
              Todos
            </h1>
          </div>
          {/* Today summary pill */}
          {(todayCount > 0 || overdueCount > 0) && (
            <div className="flex flex-col items-end gap-1 mt-1">
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(239,68,68,0.12)', color: 'rgba(252,165,165,0.9)' }}>
                  {overdueCount} overdue
                </span>
              )}
              {todayCount > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(59,130,246,0.12)', color: 'rgba(147,197,253,0.9)' }}>
                  {todayCount} today
                  {totalEstimatedMinutes > 0 && (
                    <span className="opacity-60">· ~{formatMinutes(totalEstimatedMinutes)}</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Premium View tabs */}
      <div className="px-4 max-w-3xl mx-auto w-full">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-3">
          {VIEWS.map(v => {
            const Icon = v.icon
            const count = counts[v.id]
            const isActive = activeView === v.id

            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className="relative flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[13px] font-semibold transition-all duration-200"
                style={isActive ? {
                  background: 'rgba(59,130,246,0.18)',
                  color: 'rgba(147,197,253,1)',
                  boxShadow: 'inset 0 0 0 1px rgba(99,179,237,0.3)',
                } : {
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="tabActiveIndicator"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'rgba(59,130,246,0.12)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5 flex-shrink-0" />
                <span className="relative">{v.label}</span>
                {count > 0 && (
                  <span
                    className="relative text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                    style={isActive ? {
                      background: 'rgba(99,179,237,0.25)',
                      color: 'rgba(186,230,253,1)',
                    } : {
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 max-w-3xl mx-auto w-full pb-32">

        {/* Quick input (hidden in logbook view) */}
        {activeView !== 'logbook' && (
          <div className="mt-2 mb-4">
            <TodoInput
              onAdd={handleAdd}
              defaultScheduledDate={activeView === 'today' ? todayYMD : undefined}
              placeholder={getPlaceholder(activeView)}
            />
          </div>
        )}

        {/* Views */}
        {activeView === 'today' ? (
          <TodayView
            todos={viewTodos}
            areas={areas}
            onToggle={handleToggle}
            onUpdate={updateTodo}
            onDelete={handleDelete}
          />
        ) : activeView === 'upcoming' ? (
          <UpcomingView
            todos={viewTodos}
            areas={areas}
            onToggle={handleToggle}
            onUpdate={updateTodo}
            onDelete={handleDelete}
          />
        ) : activeView === 'logbook' ? (
          <LogbookView todos={viewTodos} onUndo={handleToggle} />
        ) : (
          <StandardView
            todos={viewTodos}
            areas={areas}
            showDate={activeView !== 'today'}
            showArea={true}
            onToggle={handleToggle}
            onUpdate={updateTodo}
            onDelete={handleDelete}
          />
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-0.5 mt-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                <div className="flex-shrink-0 h-[18px] w-[18px] rounded-[5px] bg-white/8 animate-pulse" />
                <div className="h-4 rounded-lg bg-white/8 animate-pulse" style={{ width: `${50 + i * 15}%` }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state — only shown after load completes */}
        {!loading && viewTodos.length === 0 && (
          <EmptyState view={activeView} />
        )}
      </div>
    </div>
  )
}

// ─── Sub-views ───────────────────────────────────────────────

function StandardView({
  todos, areas, showDate, showArea, onToggle, onUpdate, onDelete
}: {
  todos: Todo[]
  areas: TodoArea[]
  showDate: boolean
  showArea: boolean
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: Partial<Todo>) => void
  onDelete: (id: string) => void
}) {
  return (
    <AnimatePresence>
      <div className="space-y-1">
        {todos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDelete={onDelete}
            showDate={showDate}
            showArea={showArea}
            areaName={areas.find(a => a.id === todo.area_id)?.name}
          />
        ))}
      </div>
    </AnimatePresence>
  )
}

function TodayView({
  todos, areas, onToggle, onUpdate, onDelete
}: {
  todos: Todo[]
  areas: TodoArea[]
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: Partial<Todo>) => void
  onDelete: (id: string) => void
}) {
  const today = new Date().toISOString().split('T')[0]

  const isOverdueItem = (t: Todo) =>
    !!(t.deadline_date && t.deadline_date < today) ||
    !!(t.scheduled_date && t.scheduled_date < today)

  const overdue = todos.filter(isOverdueItem)
  const onTrack = todos.filter(t => !isOverdueItem(t))

  const renderSection = (items: Todo[], label?: string, labelColor?: string) => (
    <div className={label ? 'mb-6' : ''}>
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('text-xs font-semibold uppercase tracking-wider', labelColor ?? 'text-white/40')}>
            {label}
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-xs text-white/20">{items.length}</span>
        </div>
      )}
      <AnimatePresence>
        <div className="space-y-1">
          {items.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              showDate={false}
              showArea={true}
              areaName={areas.find(a => a.id === todo.area_id)?.name}
            />
          ))}
        </div>
      </AnimatePresence>
    </div>
  )

  // If all items are overdue, don't add an extra "Today" header for the empty section
  if (overdue.length === 0) {
    return renderSection(onTrack)
  }

  return (
    <div>
      {renderSection(overdue, 'Overdue', 'text-red-400/70')}
      {onTrack.length > 0 && renderSection(onTrack, 'Today', 'text-white/40')}
    </div>
  )
}

function UpcomingView({
  todos, areas, onToggle, onUpdate, onDelete
}: {
  todos: Todo[]
  areas: TodoArea[]
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: Partial<Todo>) => void
  onDelete: (id: string) => void
}) {
  // Group by scheduled_date, falling back to deadline_date
  const groups: Record<string, Todo[]> = {}
  for (const todo of todos) {
    const key = todo.scheduled_date ?? todo.deadline_date ?? 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(todo)
  }

  const sortedDates = Object.keys(groups).sort()

  return (
    <div className="space-y-6">
      {sortedDates.map(dateKey => {
        const label = dateKey === 'unknown' ? 'No date' : describeDate(dateKey)
        return (
          <div key={dateKey}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                {label}
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-white/25">{groups[dateKey].length}</span>
            </div>
            <div className="space-y-1">
              {groups[dateKey].map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  showDate={false}
                  showArea={true}
                  areaName={areas.find(a => a.id === todo.area_id)?.name}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LogbookView({
  todos,
  onUndo,
}: {
  todos: Todo[]
  onUndo: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  // Group by completion date (day)
  const groups: Record<string, Todo[]> = {}
  for (const todo of todos) {
    const key = todo.completed_at
      ? todo.completed_at.split('T')[0]
      : todo.updated_at.split('T')[0]
    if (!groups[key]) groups[key] = []
    groups[key].push(todo)
  }

  const sortedDates = Object.keys(groups).sort().reverse()

  return (
    <div className="space-y-4">
      {sortedDates.map(dateKey => {
        const label = describeDate(dateKey)
        return (
          <div key={dateKey}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                {label}
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-white/20">{groups[dateKey].length}</span>
            </div>
            <div className="space-y-px">
              {groups[dateKey].map(todo => (
                <LogbookItem key={todo.id} todo={todo} onUndo={onUndo} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Empty states ─────────────────────────────────────────────

const EMPTY_COPY: Record<TodoView, { headline: string; sub: string; Icon: React.ElementType }> = {
  inbox:    { Icon: CheckCheck,    headline: 'Inbox clear',        sub: 'Nothing uncategorized. You\'re on top of it.' },
  today:    { Icon: Sparkles,      headline: 'Nothing due today',  sub: 'Add a task or schedule one for today.' },
  upcoming: { Icon: CalendarCheck, headline: 'Nothing scheduled',  sub: 'Add a date to any task and it\'ll show up here.' },
  someday:  { Icon: Layers,        headline: 'Someday list empty', sub: 'Park an idea — type "someday" in your task.' },
  logbook:  { Icon: BookMarked,    headline: 'Logbook is empty',   sub: 'Completed tasks will appear here.' },
}

function EmptyState({ view }: { view: TodoView }) {
  const { headline, sub, Icon } = EMPTY_COPY[view]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="h-14 w-14 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: 'rgba(59,130,246,0.08)',
          boxShadow: 'inset 0 0 0 1px rgba(99,179,237,0.12)',
        }}
      >
        <Icon className="h-6 w-6" style={{ color: 'rgba(147,197,253,0.5)' }} />
      </div>
      <p className="font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{headline}</p>
      <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>{sub}</p>
    </motion.div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function getPlaceholder(view: TodoView): string {
  switch (view) {
    case 'today':    return 'What needs doing today?'
    case 'upcoming': return 'Add a task…'
    case 'someday':  return 'Park an idea…'
    default:         return 'Add a task…'
  }
}
