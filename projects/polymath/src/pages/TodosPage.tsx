/**
 * Todos Page — Things 3-inspired task management
 *
 * Design philosophy:
 *   Aardvark: depth on demand — the list is minimal, richness reveals on tap
 *   Border Collie: anticipate tomorrow before it arrives
 *   Crow: the app remembers what you're avoiding (age indicators in TodoItem)
 *   Sloth: every interaction requires minimum possible effort
 *
 * Behavioral UX principles embedded here:
 *   1. Fogg Behavior Model — Quick Wins surfaces sub-5min tasks. Motivation
 *      isn't the bottleneck; friction is. Removing "I can't right now" = action.
 *   2. Implementation Intentions — Morning banner prompts WHEN, not just WHAT.
 *      "I will do X at time Y in context Z" is 3x more likely to happen.
 *   3. Goal Gradient + Endowed Progress — progress bar never starts at 0%.
 *      Being "already started" accelerates pace toward the finish.
 *   4. Zeigarnik Effect — in-progress items stay visually open in the list.
 *      Cognitive tension from visible open loops drives return + completion.
 *   5. Loss Aversion Streaks — streak counter shown daily. Fear of breaking
 *      the chain (Kahneman) is a stronger motivator than gaining credit.
 *   6. Habit Stacking — Focus Mode and morning banner anchor to daily rhythms.
 *   7. 2-Minute Rule — Quick Wins section. If it takes <5min, do it NOW.
 *   8. Progressive Disclosure — Focus Mode collapses the list to ONE task.
 *      Path of least resistance becomes the task itself.
 *   9. Variable Reward — completion toasts use randomized copy. Dopamine
 *      anticipation from unpredictable rewards sustains daily engagement.
 *  10. Notifications — useTodoNotifications fires at scheduled_time each day.
 *      The environmental cue retrieves the intention without willpower.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, Sun, CalendarDays, Archive, BookOpen,
  CheckCheck, Sparkles, CalendarCheck, Layers, BookMarked,
  ArrowRight, Zap, Flame, Focus, Moon,
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
import { useStreakStore } from '../hooks/useStreakStore'
import { useTodoNotifications } from '../hooks/useTodoNotifications'
import { TodoInput } from '../components/todos/TodoInput'
import { TodoItem, LogbookItem } from '../components/todos/TodoItem'
import { FocusMode } from '../components/todos/FocusMode'
import { DailyReview } from '../components/review/DailyReview'
import { parseTodo, describeDate, formatMinutes } from '../lib/todoNLP'
import { cn } from '../lib/utils'
import { useToast } from '../components/ui/toast'
import { SubtleBackground } from '../components/SubtleBackground'

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

// Variable reward: randomized completion copy (unpredictable = more dopamine)
const COMPLETION_TOASTS = [
  { title: 'Done.' },
  { title: 'Cleared.' },
  { title: 'One less thing.' },
  { title: 'Knocked out.' },
  { title: 'Keep going.' },
  { title: 'Building momentum.' },
  { title: 'That\'s the one.' },
  { title: 'Clean.' },
  { title: 'On a roll.' },
]

function randomCompletionToast() {
  return COMPLETION_TOASTS[Math.floor(Math.random() * COMPLETION_TOASTS.length)]
}

// ─── Main page ───────────────────────────────────────────────

export function TodosPage() {
  const {
    todos, areas, loading,
    activeView, setActiveView,
    fetchTodos, fetchAreas,
    addTodo, updateTodo, toggleTodo, deleteTodo,
    inProgressIds, startTodo, unstartTodo,
  } = useTodoStore()

  const { streak, recordCompletion, getStreakMessage } = useStreakStore()
  const { addToast } = useToast()

  const [addedFeedback, setAddedFeedback] = useState<{ view: TodoView; label: string } | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    fetchTodos()
    fetchAreas()
  }, [])

  // Schedule notifications for today's timed tasks (fires on native only)
  const todayTodosAll = selectToday(todos)
  useTodoNotifications(todayTodosAll)

  const todayYMD = new Date().toISOString().split('T')[0]

  // ── Counts ──
  const todayActive   = selectToday(todos).length
  const inboxCount    = selectInbox(todos).length
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

    const destination = getDestinationView(input)
    if (destination !== activeView) {
      const destLabel = VIEWS.find(v => v.id === destination)?.label ?? destination
      setAddedFeedback({ view: destination, label: destLabel })
      setTimeout(() => setAddedFeedback(null), 3500)
    }
  }

  // ── Toggle with variable reward toast + streak recording ──
  const handleToggle = async (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    await toggleTodo(id)

    if (!todo.done) {
      // Record streak + fire variable reward toast
      recordCompletion()
      const toast = randomCompletionToast()
      addToast({
        title: toast.title,
        description: todo.text.length > 40 ? todo.text.slice(0, 40) + '…' : todo.text,
        variant: 'success',
        duration: 3500,
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

  // ── Focus mode: today's incomplete tasks, in-progress first ──
  const focusTodos = [
    ...todayTodos.filter(t => inProgressIds.includes(t.id)),
    ...todayTodos.filter(t => !inProgressIds.includes(t.id)),
  ]

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const hour = new Date().getHours()

  // Goal gradient: progress bar starts at 8% (endowed progress) so you're
  // never at zero — the "already started" framing accelerates pace.
  const progressPct = totalTodayItems === 0
    ? 0
    : completedToday === 0
      ? 8
      : (completedToday / totalTodayItems) * 100

  const streakMessage = getStreakMessage()

  return (
    <>
      <div
        className="min-h-screen flex flex-col relative"
        style={{ backgroundColor: 'var(--premium-surface-base)' }}
      >
        <SubtleBackground />
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
                <div className="flex items-baseline gap-3">
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

                  {/* Loss aversion streak — shown after first completion */}
                  {streak > 0 && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1 pb-0.5"
                    >
                      <Flame
                        className="h-3.5 w-3.5"
                        style={{ color: streak >= 7 ? 'rgba(251,191,36,0.9)' : 'rgba(251,146,60,0.8)' }}
                      />
                      <span
                        className="text-[13px] font-bold tabular-nums"
                        style={{ color: streak >= 7 ? 'rgba(251,191,36,0.9)' : 'rgba(251,146,60,0.8)' }}
                      >
                        {streak}
                      </span>
                    </motion.div>
                  )}
                </div>

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
                    <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      ~{formatMinutes(totalEstimatedMinutes)}
                    </span>
                  )}
                </div>
              </div>

              {/* Streak motivation copy — tightens loss aversion */}
              {streakMessage && (
                <p className="text-[11px] mb-2" style={{ color: 'rgba(251,146,60,0.8)' }}>
                  {streakMessage}
                </p>
              )}

              {/* Progress bar — endowed progress: never truly 0% when there are tasks */}
              {totalTodayItems > 0 && (
                <div
                  className="w-full h-[3px] rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: completedToday === totalTodayItems
                        ? 'rgba(52,211,153,0.6)'
                        : 'rgba(59,130,246,0.5)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              )}

              {/* Focus mode button — only when there are tasks */}
              {todayActive > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => setFocusMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={{
                      background: 'rgba(139,92,246,0.12)',
                      color: 'rgba(196,181,253,0.85)',
                      border: '1px solid rgba(139,92,246,0.25)',
                    }}
                  >
                    <Focus className="h-3 w-3" />
                    Focus mode
                  </button>
                  <button
                    onClick={() => setShowReview(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={{
                      background: hour < 12 ? 'rgba(251,191,36,0.10)' : 'rgba(139,92,246,0.10)',
                      color: hour < 12 ? 'rgba(251,191,36,0.85)' : 'rgba(196,181,253,0.85)',
                      border: `1px solid ${hour < 12 ? 'rgba(251,191,36,0.2)' : 'rgba(139,92,246,0.2)'}`,
                    }}
                  >
                    {hour < 12 ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                    {hour < 12 ? 'Morning review' : 'Evening review'}
                  </button>
                  {inProgressIds.filter(id => todayTodos.some(t => t.id === id)).length > 0 && (
                    <span
                      className="flex items-center gap-1 text-[11px]"
                      style={{ color: 'rgba(251,146,60,0.65)' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400/70 animate-pulse" />
                      {inProgressIds.filter(id => todayTodos.some(t => t.id === id)).length} in progress
                    </span>
                  )}
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
                <span className="text-[15px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                  className="relative flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all duration-200"
                  style={isActive ? {
                    background: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.95)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                  } : {
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.42)',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tabActiveIndicator"
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icon className="relative h-3.5 w-3.5 flex-shrink-0" />
                  <span className="relative">{v.label}</span>
                  {count > 0 && (
                    <span
                      className="relative text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                      style={isActive ? {
                        background: 'rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.9)',
                      } : {
                        background: 'rgba(255,255,255,0.07)',
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
              inProgressIds={inProgressIds}
              onToggle={handleToggle}
              onUpdate={updateTodo}
              onDelete={handleDelete}
              onStart={startTodo}
              onUnstart={unstartTodo}
            />
          ) : activeView === 'upcoming' ? (
            <UpcomingView
              todos={viewTodos}
              areas={areas}
              inProgressIds={inProgressIds}
              onToggle={handleToggle}
              onUpdate={updateTodo}
              onDelete={handleDelete}
              onStart={startTodo}
              onUnstart={unstartTodo}
            />
          ) : activeView === 'logbook' ? (
            <LogbookView todos={viewTodos} onUndo={handleToggle} />
          ) : (
            <StandardView
              todos={viewTodos}
              areas={areas}
              showDate={activeView !== 'today'}
              showArea={true}
              inProgressIds={inProgressIds}
              onToggle={handleToggle}
              onUpdate={updateTodo}
              onDelete={handleDelete}
              onStart={startTodo}
              onUnstart={unstartTodo}
            />
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-2 mt-1">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl animate-pulse"
                  style={{
                    background: 'var(--premium-surface-1)',
                    border: '1px solid rgba(255,255,255,0.055)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="flex-shrink-0 h-[20px] w-[20px] rounded-[6px]" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="h-[14px] rounded-lg" style={{ width: `${45 + i * 15}%`, background: 'rgba(255,255,255,0.06)' }} />
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

      {/* Focus Mode overlay */}
      <AnimatePresence>
        {focusMode && (
          <FocusMode
            todos={focusTodos}
            onComplete={handleToggle}
            onClose={() => setFocusMode(false)}
          />
        )}
      </AnimatePresence>

      {/* Daily Review overlay */}
      <AnimatePresence>
        {showReview && (
          <DailyReview
            todos={todos}
            onUpdateTodo={updateTodo}
            onAddTodo={addTodo}
            onDeleteTodo={deleteTodo}
            onClose={() => setShowReview(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Sub-views ───────────────────────────────────────────────

interface ViewProps {
  todos: Todo[]
  areas: TodoArea[]
  inProgressIds: string[]
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: Partial<Todo>) => void
  onDelete: (id: string) => void
  onStart: (id: string) => void
  onUnstart: (id: string) => void
}

function StandardView({
  todos, areas, showDate, showArea, inProgressIds, onToggle, onUpdate, onDelete, onStart, onUnstart
}: ViewProps & { showDate: boolean; showArea: boolean }) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {todos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onStart={onStart}
            onUnstart={onUnstart}
            isInProgress={inProgressIds.includes(todo.id)}
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
  todos, areas, allTodos, inProgressIds, onToggle, onUpdate, onDelete, onStart, onUnstart
}: ViewProps & { allTodos: Todo[] }) {
  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()

  // Border Collie: see what's coming before it arrives
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowYMD = tomorrow.toISOString().split('T')[0]
  const tomorrowItems = selectUpcoming(allTodos).filter(t =>
    t.scheduled_date === tomorrowYMD || t.deadline_date === tomorrowYMD
  )

  const tomorrowDayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' })

  const isOverdueItem = (t: Todo) =>
    !!(t.deadline_date && t.deadline_date < today) ||
    !!(t.scheduled_date && t.scheduled_date < today)

  // Zeigarnik smart sort:
  // 1. In-progress tasks surface to the very top
  // 2. High-priority overdue after in-progress
  // 3. Regular overdue after that
  // 4. Today tasks by scheduled_time
  const smartSortedTodos = [...todos].sort((a, b) => {
    const aInProgress = inProgressIds.includes(a.id)
    const bInProgress = inProgressIds.includes(b.id)
    if (aInProgress && !bInProgress) return -1
    if (!aInProgress && bInProgress) return 1

    const aOverdue = isOverdueItem(a)
    const bOverdue = isOverdueItem(b)
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1

    // Within overdue: high priority first
    if (aOverdue && bOverdue) {
      if (b.priority !== a.priority) return b.priority - a.priority
    }

    // Today items: by scheduled_time asc, then priority desc
    return (a.scheduled_time ?? '99:99').localeCompare(b.scheduled_time ?? '99:99') ||
      (b.priority - a.priority)
  })

  const overdue = smartSortedTodos.filter(isOverdueItem)
  const onTrack = smartSortedTodos.filter(t => !isOverdueItem(t))

  // 2-Minute Rule / Fogg: Quick Wins = tasks with time estimates ≤ 5 min
  // Only shown in the on-track section (overdue get their own urgency treatment)
  const quickWins = onTrack.filter(t =>
    t.estimated_minutes && t.estimated_minutes <= 5
  )
  const mainTasks = onTrack.filter(t =>
    !(t.estimated_minutes && t.estimated_minutes <= 5)
  )

  // Implementation Intentions: morning banner when there are unscheduled tasks
  // Prompts WHEN + context, not just WHAT — 3x completion rate (Gollwitzer 1999)
  const unscheduledCount = onTrack.filter(t => !t.scheduled_time).length
  const isMorning = hour >= 6 && hour < 11
  const showMorningBanner = isMorning && unscheduledCount > 1 && onTrack.length > 0

  // Habit Stacking: evening capture banner — anchor tomorrow planning to tonight's routine
  const isEvening = hour >= 20
  const showEveningBanner = isEvening

  const renderSection = (items: Todo[], label?: string, isOverdueSection?: boolean) => (
    <div className={label ? 'mb-8' : ''}>
      {label && (
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: isOverdueSection ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.50)' }}
          >
            {label}
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{items.length}</span>
        </div>
      )}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {items.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onStart={onStart}
              onUnstart={onUnstart}
              isInProgress={inProgressIds.includes(todo.id)}
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
      {/* Implementation Intentions: morning planning banner */}
      <AnimatePresence>
        {showMorningBanner && (
          <MorningBanner unscheduledCount={unscheduledCount} />
        )}
      </AnimatePresence>

      {/* Quick Wins — Fogg Behavior Model: Remove the "I can't right now" excuse */}
      {quickWins.length > 0 && (
        <QuickWinsSection
          todos={quickWins}
          onToggle={onToggle}
          inProgressIds={inProgressIds}
        />
      )}

      {overdue.length === 0
        ? renderSection(mainTasks)
        : (
          <>
            {renderSection(overdue, 'Overdue', true)}
            {mainTasks.length > 0 && renderSection(mainTasks, 'Today', false)}
          </>
        )
      }

      {/* Habit Stacking: evening capture banner — anchor tomorrow planning to tonight's routine */}
      <AnimatePresence>
        {showEveningBanner && (
          <EveningCaptureBanner tomorrowDayName={tomorrowDayName} />
        )}
      </AnimatePresence>

      {/* Tomorrow preview — Border Collie: see what's coming before it arrives */}
      {tomorrowItems.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2.5 mb-3">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Tomorrow
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>{tomorrowItems.length}</span>
          </div>
          <div className="space-y-1.5" style={{ opacity: 0.45 }}>
            {tomorrowItems.slice(0, 3).map(t => (
              <div
                key={t.id}
                className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl"
                style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div
                  className="flex-shrink-0 h-[16px] w-[16px] rounded-[5px]"
                  style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}
                />
                <span className="flex-1 text-[14px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {t.text}
                </span>
                {t.scheduled_time && (
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    {t.scheduled_time}
                  </span>
                )}
              </div>
            ))}
            {tomorrowItems.length > 3 && (
              <p className="text-[11px] px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                +{tomorrowItems.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quick Wins section — 2-minute rule + Fogg ──────────────

function QuickWinsSection({
  todos, onToggle, inProgressIds,
}: {
  todos: Todo[]
  onToggle: (id: string) => void
  inProgressIds: string[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 px-3.5 py-3 rounded-2xl"
      style={{
        background: 'rgba(251,191,36,0.05)',
        border: '1px solid rgba(251,191,36,0.15)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(251,191,36,0.18)' }}
        >
          <Zap className="h-2.5 w-2.5" style={{ color: 'rgba(251,191,36,0.9)' }} />
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'rgba(251,191,36,0.7)' }}
        >
          Quick wins · under 5 min
        </span>
        <span
          className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(251,191,36,0.15)', color: 'rgba(253,224,71,0.8)' }}
        >
          {todos.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        <AnimatePresence>
          {todos.map(todo => (
            <motion.button
              key={todo.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              onClick={() => onToggle(todo.id)}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-left"
              style={{
                background: inProgressIds.includes(todo.id)
                  ? 'rgba(251,146,60,0.14)'
                  : 'rgba(251,191,36,0.09)',
                border: `1px solid ${inProgressIds.includes(todo.id) ? 'rgba(251,146,60,0.35)' : 'rgba(251,191,36,0.25)'}`,
                maxWidth: 220,
              }}
            >
              <div
                className="flex-shrink-0 h-[16px] w-[16px] rounded-[5px] border-2"
                style={{ borderColor: inProgressIds.includes(todo.id) ? 'rgba(251,146,60,0.6)' : 'rgba(251,191,36,0.5)' }}
              />
              <span
                className="text-[13px] font-medium truncate"
                style={{ color: 'rgba(255,255,255,0.8)' }}
              >
                {todo.text}
              </span>
              {todo.estimated_minutes && (
                <span
                  className="flex-shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(251,191,36,0.15)', color: 'rgba(253,224,71,0.85)' }}
                >
                  {todo.estimated_minutes}m
                </span>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Morning banner — Implementation Intentions ─────────────

function MorningBanner({ unscheduledCount }: { unscheduledCount: number }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mb-4"
    >
      <div
        className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
        style={{
          background: 'rgba(99,179,237,0.07)',
          border: '1px solid rgba(99,179,237,0.18)',
        }}
      >
        <Sun className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'rgba(251,191,36,0.7)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Plan your morning
          </p>
          <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.50)' }}>
            {unscheduledCount} tasks without a time. Add "at 9am", "at 2pm" to lock them in — tasks with a when are 3× more likely to happen.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-[11px] transition-opacity"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          ✕
        </button>
      </div>
    </motion.div>
  )
}

// ── Evening capture banner — Habit Stacking ────────────────
// Anchor tomorrow planning to tonight's routine (after 8pm)

function EveningCaptureBanner({ tomorrowDayName }: { tomorrowDayName: string }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-6"
    >
      <div
        className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
        style={{
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.18)',
        }}
      >
        <CalendarDays className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'rgba(196,181,253,0.6)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Planning tomorrow?
          </p>
          <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.50)' }}>
            Tap to add something for {tomorrowDayName} — tasks captured tonight are ready when you wake up.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-[11px] transition-opacity"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          ✕
        </button>
      </div>
    </motion.div>
  )
}

function UpcomingView({
  todos, areas, inProgressIds, onToggle, onUpdate, onDelete, onStart, onUnstart
}: ViewProps) {
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
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'rgba(255,255,255,0.50)' }}>
                {label}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{groups[dateKey].length}</span>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {groups[dateKey].map(todo => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onStart={onStart}
                    onUnstart={onUnstart}
                    isInProgress={inProgressIds.includes(todo.id)}
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
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {label}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>{groups[dateKey].length}</span>
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
      <p className="text-[13px] max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>
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

