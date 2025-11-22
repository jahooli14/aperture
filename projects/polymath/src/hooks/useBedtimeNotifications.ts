import { useEffect } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '../lib/platform'

export function useBedtimeNotifications() {
    useEffect(() => {
        if (!isNative()) return

        const scheduleNotification = async () => {
            try {
                // Request permission
                const permission = await LocalNotifications.requestPermissions()
                if (permission.display !== 'granted') return

                // Check if already scheduled
                const pending = await LocalNotifications.getPending()
                const hasBedtimeNotification = pending.notifications.some(n => n.id === 930)

                if (!hasBedtimeNotification) {
                    // Schedule for 9:30 PM
                    const now = new Date()
                    const scheduledTime = new Date()
                    scheduledTime.setHours(21, 30, 0, 0)

                    if (now > scheduledTime) {
                        // If it's already past 9:30 PM, schedule for tomorrow
                        scheduledTime.setDate(scheduledTime.getDate() + 1)
                    }

                    await LocalNotifications.schedule({
                        notifications: [
                            {
                                title: "Bedtime Ideas 🌙",
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
                            }
                        ]
                    })
                    console.log('[Notifications] Bedtime notification scheduled for', scheduledTime)
                }
            } catch (error) {
                console.error('[Notifications] Failed to schedule:', error)
            }
        }

        scheduleNotification()
    }, [])
}
