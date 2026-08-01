import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subscribeToVoiceReminder, unsubscribeFromVoiceReminder, updateVoiceReminderSchedule } from '../lib/push'

interface NotificationSettings {
  // Bedtime reflection reminder
  bedtimeEnabled: boolean
  bedtimeHour: number    // 0-23, default 21
  bedtimeMinute: number  // 0-59, default 30

  // Morning planning reminder
  morningEnabled: boolean
  morningHour: number    // default 8
  morningMinute: number  // default 30

  // Daily voice-note reminder — web push, works even when the PWA is closed.
  voiceNoteEnabled: boolean
  voiceNoteHour: number    // default 9
  voiceNoteMinute: number  // default 0
  voiceNoteError: string | null

  // Actions
  updateBedtime: (hour: number, minute: number) => void
  toggleBedtime: (enabled: boolean) => void
  updateMorning: (hour: number, minute: number) => void
  toggleMorning: (enabled: boolean) => void
  updateVoiceNoteTime: (hour: number, minute: number) => void
  toggleVoiceNote: (enabled: boolean) => Promise<void>
}

export const useNotificationSettings = create<NotificationSettings>()(
  persist(
    (set, get) => ({
      bedtimeEnabled: true,
      bedtimeHour: 21,
      bedtimeMinute: 30,

      morningEnabled: false,
      morningHour: 8,
      morningMinute: 30,

      voiceNoteEnabled: false,
      voiceNoteHour: 9,
      voiceNoteMinute: 0,
      voiceNoteError: null,

      updateBedtime: (hour, minute) => set({ bedtimeHour: hour, bedtimeMinute: minute }),
      toggleBedtime: (enabled) => set({ bedtimeEnabled: enabled }),
      updateMorning: (hour, minute) => set({ morningHour: hour, morningMinute: minute }),
      toggleMorning: (enabled) => set({ morningEnabled: enabled }),

      updateVoiceNoteTime: (hour, minute) => {
        set({ voiceNoteHour: hour, voiceNoteMinute: minute })
        if (get().voiceNoteEnabled) {
          updateVoiceReminderSchedule({ enabled: true, hour, minute }).catch((err) => {
            console.error('[NotificationSettings] Failed to update voice reminder schedule:', err)
          })
        }
      },

      toggleVoiceNote: async (enabled) => {
        const { voiceNoteHour, voiceNoteMinute } = get()
        set({ voiceNoteError: null })
        try {
          if (enabled) {
            await subscribeToVoiceReminder({ hour: voiceNoteHour, minute: voiceNoteMinute })
          } else {
            await unsubscribeFromVoiceReminder({ hour: voiceNoteHour, minute: voiceNoteMinute })
          }
          set({ voiceNoteEnabled: enabled })
        } catch (err) {
          set({ voiceNoteError: err instanceof Error ? err.message : 'Failed to update reminder' })
        }
      },
    }),
    {
      name: 'polymath-notification-settings',
    }
  )
)
