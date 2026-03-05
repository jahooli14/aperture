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
import { parseTodo, describeDate } from '../lib/todoNLP'
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--premium-surface-base)' }}
    >
      {/* Header */}
      <div className="px-4 pt-6 pb-2 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-white/90 mb-1">Todos</h1>
        <p className="text-sm text-white/40">
          {todayCount > 0
            ? `${todayCount} task${todayCount > 1 ? 's' : ''} for today`
            : 'All clear for today'}
        </p>
      </div>

      {/* View tabs */}
      <div className="px-4 max-w-3xl mx-auto w-full">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-2 pt-1">
          {VIEWS.map(v => {
            const Icon = v.icon
            const count = counts[v.id]
            const isActive = activeView === v.id

            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={cn(
                  'relative flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'text-blue-400'
                    : 'text-white/50 hover:text-white/70'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="tabActiveIndicator"
                    className="absolute inset-0 rounded-xl bg-blue-500/15"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{v.label}</span>
                {count > 0 && (
                  <span className={cn(
                    'relative text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    isActive ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-white/40'
                  )}>
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

        {/* Upcoming: grouped by date */}
        {activeView === 'upcoming' ? (
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
      <div className="space-y-0.5">
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
            <div className="space-y-0.5">
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
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-white/25" />
      </div>
      <p className="text-white/55 font-medium mb-1">{headline}</p>
      <p className="text-sm text-white/25 max-w-xs">{sub}</p>
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
