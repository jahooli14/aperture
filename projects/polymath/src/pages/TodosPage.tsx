/**
 * Todos Page — Things 3-inspired task management
 *
 * Design philosophy:
 *   Aardvark: depth on demand — the list is minimal, richness reveals on tap
 *   Border Collie: anticipate tomorrow before it arrives
 *   Crow: the app remembers what you're avoiding (age indicators in TodoItem)
 *   Sloth: every interaction requires minimum possible effort
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, Sun, CalendarDays, Archive, BookOpen,
  CheckCheck, Sparkles, CalendarCheck, Layers, BookMarked,
  ArrowRight,
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
  { id: 'inbox',    label: 'Inbox',    icon: Inbox,        hint: 'Uncategorized' },
  { id: 'today',    label: 'Today',    icon: Sun,          hint: 'Due today + overdue' },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays, hint: 'Scheduled ahead' },
  { id: 'someday',  label: 'Someday',  icon: Archive,      hint: 'Parked ideas' },
  { id: 'logbook',  label: 'Logbook',  icon: BookOpen,     hint: 'Completed' },
]

// Where does a todo land based on its properties?
function getDestinationView(input: Partial<Todo>): TodoView {
  const t = new Date().toISOString().split('T')[0]
  if (input.tags?.includes('someday')) return 'someday'
  const date = input.scheduled_date ?? input.deadline_date
  if (!date) return 'inbox'
  if (date <= t) return 'today'
  return 'upcoming'
}

// ─── Main page ───────────────────────────────────────────────

export function TodosPage() {
  const {
    todos, areas, loading,
    activeView, setActiveView,
    fetchTodos, fetchAreas,
    addTodo, updateTodo, toggleTodo, deleteTodo,
  } = useTodoStore()

  const { addToast } = useToast()

  // Routing feedback: where did the last added todo go?
  const [addedFeedback, setAddedFeedback] = useState<{ view: TodoView; label: string } | null>(null)

  useEffect(() => {
    fetchTodos()
    fetchAreas()
  }, [])

  const todayYMD = new Date().toISOString().split('T')[0]

  // ── Counts ──
  const todayActive  = selectToday(todos).length
  const inboxCount   = selectInbox(todos).length
  const upcomingCount = selectUpcoming(todos).length
  const somedayCount  = selectSomeday(todos).length
  const logbookCount  = selectLogbook(todos).length

  // Completed today (for progress bar)
  const completedToday = todos.filter(t =>
    t.done && !t.deleted_at && t.completed_at?.startsWith(todayYMD)
  ).length
  const totalTodayItems = todayActive + completedToday

  const counts: Record<TodoView, number> = {
    inbox:    inboxCount,
    today:    todayActive,
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

  // ── Today estimates ──
  const todayTodos = selectToday(todos)
  const overdueCount = todayTodos.filter(t =>
    (t.deadline_date && t.deadline_date < todayYMD) ||
    (t.scheduled_date && t.scheduled_date < todayYMD)
  ).length
  const totalEstimatedMinutes = todayTodos.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0)

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

    if (parsed.isSomeday) {
      // no date — just tag
    } else if (parsed.scheduledDate) {
      input.scheduled_date = parsed.scheduledDate
    } else if (activeView === 'today') {
      input.scheduled_date = todayYMD
    }

    if (parsed.deadlineDate) input.deadline_date = parsed.deadlineDate

    if (parsed.areaName) {
      const area = areas.find(a => a.name.toLowerCase() === parsed.areaName!.toLowerCase())
      if (area) input.area_id = area.id
    }

    await addTodo(input)

    // Show routing feedback if the todo lands in a different view
    const destination = getDestinationView(input)
    if (destination !== activeView) {
      const destLabel = VIEWS.find(v => v.id === destination)?.label ?? destination
      setAddedFeedback({ view: destination, label: destLabel })
      setTimeout(() => setAddedFeedback(null), 3500)
    }
  }

  // ── Toggle with undo toast ──
  const handleToggle = async (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    await toggleTodo(id)

    if (!todo.done) {
      addToast({
        title: 'Done',
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

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--premium-surface-base)' }}
    >
      {/* Header — view-aware, progress-focused */}
      <div className="px-4 pt-7 pb-4 max-w-3xl mx-auto w-full">
        {/* Date line — always visible, always contextual */}
        <p
          className="text-[11px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'rgba(148,163,184,0.4)' }}
        >
          {dayName} · {dateStr}
        </p>

        {activeView === 'today' ? (
          /* Today: show progress, not a title */
          <>
            <div className="flex items-baseline justify-between mb-2.5">
              <h1
                className="text-[26px] font-bold tracking-tight leading-none"
                style={{ color: 'var(--premium-text-primary)' }}
              >
                {totalTodayItems === 0
                  ? 'Nothing today'
                  : completedToday === totalTodayItems
                    ? `All ${completedToday} done`
                    : completedToday > 0
                      ? `${completedToday} of ${totalTodayItems} done`
                      : `${todayActive} ${todayActive === 1 ? 'task' : 'tasks'} today`}
              </h1>

              <div className="flex items-center gap-2 pb-0.5">
                {overdueCount > 0 && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.12)', color: 'rgba(252,165,165,0.8)' }}
                  >
                    {overdueCount} overdue
                  </span>
                )}
                {totalEstimatedMinutes > 0 && (
                  <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    ~{formatMinutes(totalEstimatedMinutes)}
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar — only shown when there's something to measure */}
            {totalTodayItems > 0 && (
              <div
                className="w-full h-[3px] rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: completedToday === totalTodayItems ? 'rgba(52,211,153,0.6)' : 'rgba(59,130,246,0.5)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, (completedToday / totalTodayItems) * 100)}%` }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            )}
          </>
        ) : (
          /* Other views: name + count */
          <div className="flex items-baseline gap-3">
            <h1
              className="text-[28px] font-bold tracking-tight"
              style={{ color: 'var(--premium-text-primary)' }}
            >
              {VIEWS.find(v => v.id === activeView)?.label ?? 'Todos'}
            </h1>
            {counts[activeView] > 0 && (
              <span className="text-[15px] font-medium" style={{ color: 'rgba(255,255,255,0.22)' }}>
                {counts[activeView]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* View tabs */}
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
                  color: 'rgba(255,255,255,0.4)',
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
                      color: 'rgba(255,255,255,0.3)',
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

        {/* Quick input — hidden in logbook */}
        {activeView !== 'logbook' && (
          <div className="mt-1 mb-4">
            <TodoInput
              onAdd={handleAdd}
              defaultScheduledDate={activeView === 'today' ? todayYMD : undefined}
              placeholder={getPlaceholder(activeView)}
            />
          </div>
        )}

        {/* Routing feedback — where did the todo go? */}
        <AnimatePresence>
          {addedFeedback && (
            <motion.button
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={() => {
                setActiveView(addedFeedback.view)
                setAddedFeedback(null)
              }}
              className="w-full flex items-center justify-between mb-3 px-3.5 py-2.5 rounded-xl text-left"
              style={{
                background: 'rgba(59,130,246,0.08)',
                boxShadow: 'inset 0 0 0 1px rgba(99,179,237,0.18)',
              }}
            >
              <span className="text-[13px] font-medium" style={{ color: 'rgba(147,197,253,0.8)' }}>
                Added to {addedFeedback.label}
              </span>
              <ArrowRight className="h-3.5 w-3.5" style={{ color: 'rgba(147,197,253,0.55)' }} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Views */}
        {activeView === 'today' ? (
          <TodayView
            todos={viewTodos}
            areas={areas}
            allTodos={todos}
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
          <div className="space-y-1 mt-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl">
                <div className="flex-shrink-0 h-[20px] w-[20px] rounded-[6px] bg-white/8 animate-pulse" />
                <div className="h-[15px] rounded-lg bg-white/8 animate-pulse" style={{ width: `${50 + i * 15}%` }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
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
    <div className="space-y-1">
      <AnimatePresence mode="popLayout">
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
      </AnimatePresence>
    </div>
  )
}

function TodayView({
  todos, areas, allTodos, onToggle, onUpdate, onDelete
}: {
  todos: Todo[]
  areas: TodoArea[]
  allTodos: Todo[]
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: Partial<Todo>) => void
  onDelete: (id: string) => void
}) {
  const today = new Date().toISOString().split('T')[0]

  // Tomorrow (border collie: see what's coming before it arrives)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowYMD = tomorrow.toISOString().split('T')[0]
  const tomorrowItems = selectUpcoming(allTodos).filter(t =>
    t.scheduled_date === tomorrowYMD || t.deadline_date === tomorrowYMD
  )

  const isOverdueItem = (t: Todo) =>
    !!(t.deadline_date && t.deadline_date < today) ||
    !!(t.scheduled_date && t.scheduled_date < today)

  const overdue = todos.filter(isOverdueItem)
  const onTrack = todos.filter(t => !isOverdueItem(t))

  const renderSection = (items: Todo[], label?: string, labelColor?: string) => (
    <div className={label ? 'mb-6' : ''}>
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('text-[11px] font-semibold uppercase tracking-wider', labelColor ?? 'text-white/35')}>
            {label}
          </span>
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="text-[11px] text-white/18">{items.length}</span>
        </div>
      )}
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
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
        </AnimatePresence>
      </div>
    </div>
  )

  return (
    <div>
      {overdue.length === 0
        ? renderSection(onTrack)
        : (
          <>
            {renderSection(overdue, 'Overdue', 'text-red-400/65')}
            {onTrack.length > 0 && renderSection(onTrack, 'Today', 'text-white/35')}
          </>
        )
      }

      {/* Tomorrow preview — border collie insight */}
      {tomorrowItems.length > 0 && (todos.length > 0 || tomorrowItems.length > 0) && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/22">
              Tomorrow
            </span>
            <div className="flex-1 h-px bg-white/[0.04]" />
            <span className="text-[11px] text-white/15">{tomorrowItems.length}</span>
          </div>
          <div className="space-y-px opacity-40">
            {tomorrowItems.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center gap-3.5 px-4 py-2.5">
                <div
                  className="flex-shrink-0 h-[16px] w-[16px] rounded-[5px] border border-white/12"
                />
                <span className="text-[14px] text-white/45 truncate leading-snug">
                  {t.text}
                </span>
                {t.scheduled_time && (
                  <span className="text-[11px] text-white/22 flex-shrink-0 ml-auto">
                    {t.scheduled_time}
                  </span>
                )}
              </div>
            ))}
            {tomorrowItems.length > 3 && (
              <p className="text-[11px] text-white/18 px-4 py-1">
                +{tomorrowItems.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}
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
              <span className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">
                {label}
              </span>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-[11px] text-white/22">{groups[dateKey].length}</span>
            </div>
            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
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
              </AnimatePresence>
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
              <span className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">
                {label}
              </span>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-[11px] text-white/18">{groups[dateKey].length}</span>
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
  inbox:    { Icon: CheckCheck,    headline: 'Inbox clear',        sub: 'Everything has a place. Add tasks or give them a date.' },
  today:    { Icon: Sparkles,      headline: 'Today is clear',     sub: 'Add something for today, or check what\'s upcoming.' },
  upcoming: { Icon: CalendarCheck, headline: 'Nothing scheduled',  sub: 'Give a task a date and it will appear here.' },
  someday:  { Icon: Layers,        headline: 'Someday is empty',   sub: 'Park ideas here — type "someday" in any task.' },
  logbook:  { Icon: BookMarked,    headline: 'Nothing done yet',   sub: 'Completed tasks appear here at the end of the day.' },
}

function EmptyState({ view }: { view: TodoView }) {
  const { headline, sub, Icon } = EMPTY_COPY[view]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="h-14 w-14 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: 'rgba(59,130,246,0.07)',
          boxShadow: 'inset 0 0 0 1px rgba(99,179,237,0.10)',
        }}
      >
        <Icon className="h-6 w-6" style={{ color: 'rgba(147,197,253,0.4)' }} />
      </div>
      <p className="font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{headline}</p>
      <p className="text-[13px] max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>{sub}</p>
    </motion.div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function getPlaceholder(view: TodoView): string {
  switch (view) {
    case 'today':    return 'What needs doing today?'
    case 'upcoming': return 'Add a task with a date…'
    case 'someday':  return 'Park an idea…'
    default:         return 'Add a task…'
  }
}

