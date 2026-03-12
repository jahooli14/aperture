/**
 * useTodoNotifications  Surface at the right moment
 *
 * Principle: Implementation Intentions (Gollwitzer, 1999)  tasks anchored
 * to specific times fire automatically without willpower. A 9am notification
 * saying "Call dentist" pre-retrieves the intention at the exact cue moment.
 *
 * The environmental cue (notification) retrieves the intention without
 * deliberation  bypassing the "I'll do it later" rationalization.
 *
 * Schedules one notification per todo that has scheduled_time set for today.
 * Also schedules an overdue reminder for any tasks not yet completed.
 */

import { useEffect } from 'react'
import { isNative } from '../lib/platform'
import type { Todo } from '../stores/useTodoStore'
import { useNotificationSettings } from '../stores/useNotificationSettings'

// Stable notification ID space for todos (10001999) to avoid collisions
const TODO_NOTIF_BASE = 1000
const OVERDUE_NOTIF_ID = 1999

function hashToId(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash % 900) + TODO_NOTIF_BASE
}

export function useTodoNotifications(todos: Todo[]) {
  const {
    todoTimeNotificationsEnabled,
    overdueReminderEnabled,
    overdueReminderHour,
    overdueReminderMinute,
  } = useNotificationSettings()

  useEffect(() => {
    if (!isNative()) return
    if (todos.length === 0) return

    const schedule = async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')

        const perm = await LocalNotifications.requestPermissions()
        if (perm.display !== 'granted') return

        const todayYMD = new Date().toISOString().split('T')[0]
        const now = new Date()

        // Cancel existing todo notifications before rescheduling
        const pending = await LocalNotifications.getPending()
        const todoNotifIds = pending.notifications
          .filter(n => n.id >= TODO_NOTIF_BASE && n.id <= OVERDUE_NOTIF_ID)
          .map(n => ({ id: n.id }))
        if (todoNotifIds.length > 0) {
          await LocalNotifications.cancel({ notifications: todoNotifIds })
        }

        const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = []

        // 1. Per-task scheduled_time notifications (only if enabled)
        if (todoTimeNotificationsEnabled) {
          const todayWithTime = todos.filter(t =>
            !t.done &&
            !t.deleted_at &&
            t.scheduled_date === todayYMD &&
            t.scheduled_time
          )

          for (const todo of todayWithTime) {
            const [hours, minutes] = todo.scheduled_time!.split(':').map(Number)
            const notifTime = new Date(todayYMD + 'T00:00:00')
            notifTime.setHours(hours, minutes, 0, 0)

            // Only schedule if it's in the future (with 1-min buffer)
            if (notifTime.getTime() > now.getTime() + 60_000) {
              const notifId = hashToId(todo.id + todayYMD)
              toSchedule.push({
                id: notifId,
                title: todo.text,
                body: todo.notes
                  ? todo.notes.slice(0, 80)
                  : 'Time to get this done.',
                schedule: { at: notifTime },
                actionTypeId: '',
                attachments: [],
                extra: { path: '/todos', todoId: todo.id },
              })
            }
          }
        }

        // 2. End-of-day overdue reminder (only if enabled)
        if (overdueReminderEnabled) {
          const overdueOrUndone = todos.filter(t =>
            !t.done &&
            !t.deleted_at &&
            (t.scheduled_date === todayYMD || (t.deadline_date && t.deadline_date <= todayYMD))
          )

          if (overdueOrUndone.length > 0) {
            const reminderTime = new Date(todayYMD + 'T00:00:00')
            reminderTime.setHours(overdueReminderHour, overdueReminderMinute, 0, 0)

            if (reminderTime > now) {
              const taskWord = overdueOrUndone.length === 1 ? 'task' : 'tasks'
              toSchedule.push({
                id: OVERDUE_NOTIF_ID,
                title: `${overdueOrUndone.length} ${taskWord} still open`,
                body: overdueOrUndone.length === 1
                  ? overdueOrUndone[0].text
                  : `Including: ${overdueOrUndone[0].text}`,
                schedule: { at: reminderTime },
                actionTypeId: '',
                attachments: [],
                extra: { path: '/todos' },
              })
            }
          }
        }

        if (toSchedule.length > 0) {
          await LocalNotifications.schedule({ notifications: toSchedule })
        }
      } catch (err) {
        console.warn('[TodoNotifications] Failed to schedule:', err)
      }
    }

    schedule()
  }, [todos, todoTimeNotificationsEnabled, overdueReminderEnabled, overdueReminderHour, overdueReminderMinute])
}
