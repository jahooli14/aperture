import { useEffect } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '../lib/platform'
import { useNotificationSettings } from '../stores/useNotificationSettings'

export function useBedtimeNotifications() {
    const { bedtimeEnabled, bedtimeHour, bedtimeMinute } = useNotificationSettings()

    useEffect(() => {
        if (!isNative()) return

        const scheduleNotifications = async () => {
            try {
                // Request permission
                const permission = await LocalNotifications.requestPermissions()
                if (permission.display !== 'granted') return

                // Cancel existing notifications before rescheduling. 840 is the old
                // "Plan your day" reminder, removed — cancelled here so a phone that
                // still has it scheduled stops showing it.
                const pending = await LocalNotifications.getPending()
                const managedIds = pending.notifications
                    .filter(n => n.id === 930 || n.id === 840)
                    .map(n => ({ id: n.id }))
                if (managedIds.length > 0) {
                    await LocalNotifications.cancel({ notifications: managedIds })
                }

                const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = []
                const now = new Date()

                // Bedtime reflection reminder
                if (bedtimeEnabled) {
                    // Built from `now` itself, not a UTC date string re-parsed as
                    // local midnight -- that round-trip put the notification on
                    // the wrong calendar day for anyone outside UTC (a UTC date
                    // that's already rolled to tomorrow, or hasn't yet rolled to
                    // today, gets read back as local midnight of the wrong day).
                    const scheduledTime = new Date(now)
                    scheduledTime.setHours(bedtimeHour, bedtimeMinute, 0, 0)

                    if (now >= scheduledTime) {
                        // Already past today's time  schedule for tomorrow
                        scheduledTime.setDate(scheduledTime.getDate() + 1)
                    }

                    toSchedule.push({
                        title: "Bedtime Ideas ",
                        body: "End your day with a thought. Tap to capture.",
                        id: 930,
                        schedule: {
                            at: scheduledTime,
                            repeats: true,
                            every: 'day',
                            allowWhileIdle: true
                        },
                        sound: 'bedtime_chime.wav',
                        attachments: [],
                        actionTypeId: '',
                        extra: {
                            path: '/bedtime'
                        }
                    })
                    console.log('[Notifications] Bedtime notification scheduled for', scheduledTime)
                }

                if (toSchedule.length > 0) {
                    await LocalNotifications.schedule({ notifications: toSchedule })
                }
            } catch (error) {
                console.error('[Notifications] Failed to schedule:', error)
            }
        }

        scheduleNotifications()
    }, [bedtimeEnabled, bedtimeHour, bedtimeMinute])
}
