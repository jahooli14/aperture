import { useEffect } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '../lib/platform'
import { useNotificationSettings } from '../stores/useNotificationSettings'

export function useBedtimeNotifications() {
    const {
        bedtimeEnabled, bedtimeHour, bedtimeMinute,
        morningEnabled, morningHour, morningMinute,
    } = useNotificationSettings()

    useEffect(() => {
        if (!isNative()) return

        const scheduleNotifications = async () => {
            try {
                // Request permission
                const permission = await LocalNotifications.requestPermissions()
                if (permission.display !== 'granted') return

                // Cancel existing bedtime/morning notifications before rescheduling
                const pending = await LocalNotifications.getPending()
                const managedIds = pending.notifications
                    .filter(n => n.id === 930 || n.id === 840)
                    .map(n => ({ id: n.id }))
                if (managedIds.length > 0) {
                    await LocalNotifications.cancel({ notifications: managedIds })
                }

                const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = []
                const now = new Date()
                const todayYMD = now.toISOString().split('T')[0]

                // Bedtime reflection reminder
                if (bedtimeEnabled) {
                    const scheduledTime = new Date(todayYMD + 'T00:00:00')
                    scheduledTime.setHours(bedtimeHour, bedtimeMinute, 0, 0)

                    if (now >= scheduledTime) {
                        // Already past today's time  schedule for tomorrow
                        scheduledTime.setDate(scheduledTime.getDate() + 1)
                    }

                    toSchedule.push({
                        title: "Bedtime Ideas ",
                        body: "Your nightly prompts are ready. Tap to reflect.",
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

                // Morning planning reminder
                if (morningEnabled) {
                    const morningTime = new Date(todayYMD + 'T00:00:00')
                    morningTime.setHours(morningHour, morningMinute, 0, 0)

                    if (now >= morningTime) {
                        // Already past today's time  schedule for tomorrow
                        morningTime.setDate(morningTime.getDate() + 1)
                    }

                    toSchedule.push({
                        title: "Plan your day",
                        body: "What are you getting done today? Tap to set your intentions.",
                        id: 840,
                        schedule: {
                            at: morningTime,
                            repeats: true,
                            every: 'day',
                            allowWhileIdle: true
                        },
                        attachments: [],
                        actionTypeId: '',
                        extra: {
                            path: '/todos'
                        }
                    })
                    console.log('[Notifications] Morning planning notification scheduled for', morningTime)
                }

                if (toSchedule.length > 0) {
                    await LocalNotifications.schedule({ notifications: toSchedule })
                }
            } catch (error) {
                console.error('[Notifications] Failed to schedule:', error)
            }
        }

        scheduleNotifications()
    }, [bedtimeEnabled, bedtimeHour, bedtimeMinute, morningEnabled, morningHour, morningMinute])
}
