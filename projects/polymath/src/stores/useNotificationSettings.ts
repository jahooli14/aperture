import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificationSettings {
  // Bedtime reflection reminder
  bedtimeEnabled: boolean
  bedtimeHour: number    // 0-23, default 21
  bedtimeMinute: number  // 0-59, default 30

  // Morning planning reminder
  morningEnabled: boolean
  morningHour: number    // default 8
  morningMinute: number  // default 30

  // Actions
  updateBedtime: (hour: number, minute: number) => void
  toggleBedtime: (enabled: boolean) => void
  updateMorning: (hour: number, minute: number) => void
  toggleMorning: (enabled: boolean) => void
}

export const useNotificationSettings = create<NotificationSettings>()(
  persist(
    (set) => ({
      bedtimeEnabled: true,
      bedtimeHour: 21,
      bedtimeMinute: 30,

      morningEnabled: false,
      morningHour: 8,
      morningMinute: 30,

      updateBedtime: (hour, minute) => set({ bedtimeHour: hour, bedtimeMinute: minute }),
      toggleBedtime: (enabled) => set({ bedtimeEnabled: enabled }),
      updateMorning: (hour, minute) => set({ morningHour: hour, morningMinute: minute }),
      toggleMorning: (enabled) => set({ morningEnabled: enabled }),
    }),
    {
      name: 'polymath-notification-settings',
    }
  )
)
