import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  Palette,
  Check,
  Bug,
  ToggleRight,
  ToggleLeft,
  Zap,
  RefreshCw,
  Search,
  Type,
  Bell
} from 'lucide-react'
import { useThemeStore } from '../stores/useThemeStore'
import { getAvailableColors, getColorPreview } from '../lib/theme'
import { SubtleBackground } from '../components/SubtleBackground'
import { useToast } from '../components/ui/toast'
import { useNotificationSettings } from '../stores/useNotificationSettings'

const intensityOptions = [
  { value: 'subtle' as const, label: 'Subtle', description: 'Minimal visual effects' },
  { value: 'normal' as const, label: 'Balanced', description: 'Default experience' },
  { value: 'vibrant' as const, label: 'Vibrant', description: 'Enhanced visuals' }
]

const fontSizeOptions = [
  { value: 'small' as const, label: 'Small' },
  { value: 'normal' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' }
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { accentColor, intensity, fontSize, showBugTracker, setAccentColor, setIntensity, setFontSize, setShowBugTracker } = useThemeStore()
  const { addToast } = useToast()
  const [regenerating, setRegenerating] = useState(false)
  const {
    bedtimeEnabled, bedtimeHour, bedtimeMinute,
    morningEnabled, morningHour, morningMinute,
    todoTimeNotificationsEnabled,
    overdueReminderEnabled, overdueReminderHour, overdueReminderMinute,
    toggleBedtime, updateBedtime,
    toggleMorning, updateMorning,
    toggleTodoNotifications,
    toggleOverdueReminder, updateOverdueReminder,
  } = useNotificationSettings()

  const handleRegenerateConnections = async () => {
    setRegenerating(true)
    try {
      const response = await fetch('/api/admin/regenerate-connections', {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Regeneration failed')

      const result = await response.json()
      addToast({
        title: 'Connections Regenerated',
        description: result.message,
        variant: 'success'
      })
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to regenerate connections',
        variant: 'destructive'
      })
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      <SubtleBackground />

      {/* Fixed Header Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(15, 24, 41, 0.7)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-7 w-7" style={{ color: 'var(--premium-blue)', opacity: 0.8 }} />
            <h1 className="text-2xl sm:text-3xl" style={{
              fontWeight: 600,
              letterSpacing: 'var(--premium-tracking-tight)',
              color: 'var(--premium-text-secondary)',
              opacity: 0.9
            }}>
              Settings
            </h1>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
            style={{
              color: 'var(--premium-blue)'
            }}
            title="Search everything"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-screen pb-24" style={{ paddingTop: '5.5rem' }}>

        {/* Appearance Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
              <Palette className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
              <h2
                className="text-xl font-bold"
                style={{ color: 'var(--premium-text-primary)' }}
              >
                Appearance
              </h2>
            </div>

            {/* Accent Color */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                Accent Color
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {getAvailableColors().map((color) => {
                  const preview = getColorPreview(color)
                  const isSelected = accentColor === color
                  return (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className={`relative aspect-square rounded-xl transition-all duration-300 ${isSelected ? 'scale-105 ring-2 ring-offset-2 ring-offset-black/50' : 'hover:scale-105'}`}
                      style={{
                        background: `linear-gradient(135deg, ${preview.primary}, ${preview.light})`,
                        boxShadow: isSelected ? `0 0 20px ${preview.primary}40` : 'none',
                        borderColor: isSelected ? preview.primary : 'transparent'
                      }}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-6 w-6 text-white drop-shadow-md" />
                        </div>
                      )}
                      <div className="sr-only">{color}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Intensity */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                Visual Intensity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {intensityOptions.map((option) => {
                  const isSelected = intensity === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => setIntensity(option.value)}
                      className={`p-4 rounded-xl backdrop-blur-xl transition-all text-left border`}
                      style={{
                        background: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.02)',
                        borderColor: isSelected ? 'var(--premium-blue)' : 'rgba(255,255,255,0.05)',
                        boxShadow: isSelected ? '0 0 15px rgba(6, 182, 212, 0.1)' : 'none'
                      }}
                    >
                      <div className={`font-semibold mb-1 ${isSelected ? '' : 'premium-text-platinum'}`} style={{ color: isSelected ? 'var(--premium-blue)' : undefined }}>
                        {option.label}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                        {option.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
                <Type className="h-4 w-4" /> Typography Scale
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {fontSizeOptions.map((option) => {
                  const isSelected = fontSize === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => setFontSize(option.value)}
                      className="p-3 rounded-xl backdrop-blur-xl transition-all text-center border"
                      style={{
                        background: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.02)',
                        borderColor: isSelected ? 'var(--premium-blue)' : 'rgba(255,255,255,0.05)',
                        fontSize: option.value === 'small' ? '14px' : option.value === 'large' ? '18px' : '16px'
                      }}
                    >
                      <div className={`font-medium ${isSelected ? '' : 'premium-text-platinum'}`} style={{ color: isSelected ? 'var(--premium-blue)' : undefined }}>
                        {option.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
              <Bell className="h-6 w-6" style={{ color: 'rgba(59,130,246,0.8)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                Notifications
              </h2>
            </div>

            <div className="space-y-3">

              {/* Bedtime reflection */}
              <div className="rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-[15px]" style={{ color: 'rgba(255,255,255,0.75)' }}>Bedtime reflection</p>
                    <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Daily reminder to capture the day</p>
                  </div>
                  <button
                    onClick={() => toggleBedtime(!bedtimeEnabled)}
                    className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                    style={{ background: bedtimeEnabled ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.12)' }}
                  >
                    <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: bedtimeEnabled ? '26px' : '4px' }} />
                  </button>
                </div>
                {bedtimeEnabled && (
                  <div className="px-4 pb-3.5 flex items-center gap-3 border-t border-white/5 pt-3">
                    <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Time</span>
                    <select
                      value={bedtimeHour}
                      onChange={e => updateBedtime(Number(e.target.value), bedtimeMinute)}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i} style={{ background: '#1a2740' }}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>:</span>
                    <select
                      value={bedtimeMinute}
                      onChange={e => updateBedtime(bedtimeHour, Number(e.target.value))}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m} style={{ background: '#1a2740' }}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Morning planning */}
              <div className="rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-[15px]" style={{ color: 'rgba(255,255,255,0.75)' }}>Morning planning</p>
                    <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Set your intentions for the day</p>
                  </div>
                  <button
                    onClick={() => toggleMorning(!morningEnabled)}
                    className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                    style={{ background: morningEnabled ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.12)' }}
                  >
                    <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: morningEnabled ? '26px' : '4px' }} />
                  </button>
                </div>
                {morningEnabled && (
                  <div className="px-4 pb-3.5 flex items-center gap-3 border-t border-white/5 pt-3">
                    <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Time</span>
                    <select
                      value={morningHour}
                      onChange={e => updateMorning(Number(e.target.value), morningMinute)}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i} style={{ background: '#1a2740' }}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>:</span>
                    <select
                      value={morningMinute}
                      onChange={e => updateMorning(morningHour, Number(e.target.value))}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m} style={{ background: '#1a2740' }}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Task-time notifications */}
              <div className="flex items-center justify-between px-4 py-3.5 rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <p className="text-[15px]" style={{ color: 'rgba(255,255,255,0.75)' }}>Task-time reminders</p>
                  <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Notify when a task's scheduled time arrives</p>
                </div>
                <button
                  onClick={() => toggleTodoNotifications(!todoTimeNotificationsEnabled)}
                  className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                  style={{ background: todoTimeNotificationsEnabled ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.12)' }}
                >
                  <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: todoTimeNotificationsEnabled ? '26px' : '4px' }} />
                </button>
              </div>

              {/* End-of-day overdue reminder */}
              <div className="rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-[15px]" style={{ color: 'rgba(255,255,255,0.75)' }}>End-of-day overdue reminder</p>
                    <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Alert when tasks are still open late in the day</p>
                  </div>
                  <button
                    onClick={() => toggleOverdueReminder(!overdueReminderEnabled)}
                    className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                    style={{ background: overdueReminderEnabled ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.12)' }}
                  >
                    <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: overdueReminderEnabled ? '26px' : '4px' }} />
                  </button>
                </div>
                {overdueReminderEnabled && (
                  <div className="px-4 pb-3.5 flex items-center gap-3 border-t border-white/5 pt-3">
                    <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Time</span>
                    <select
                      value={overdueReminderHour}
                      onChange={e => updateOverdueReminder(Number(e.target.value), overdueReminderMinute)}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i} style={{ background: '#1a2740' }}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>:</span>
                    <select
                      value={overdueReminderMinute}
                      onChange={e => updateOverdueReminder(overdueReminderHour, Number(e.target.value))}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m} style={{ background: '#1a2740' }}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* System & Maintenance */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
              <Zap className="h-6 w-6" style={{ color: 'var(--premium-amber)' }} />
              <h2
                className="text-xl font-bold"
                style={{ color: 'var(--premium-text-primary)' }}
              >
                System
              </h2>
            </div>

            <div className="space-y-4">
              {/* Bug Tracker Toggle */}
              <button
                onClick={() => setShowBugTracker(!showBugTracker)}
                className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left border hover:bg-white/5"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderColor: 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                  background: 'rgba(239, 68, 68, 0.15)'
                }}>
                  <Bug className="w-5 h-5" style={{ color: '#ef4444' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold premium-text-platinum text-sm">
                    Bug Tracker / Debug Panel
                  </h3>
                  <p style={{ color: 'var(--premium-text-secondary)', fontSize: '0.8rem' }}>
                    Show technical details and debug tools
                  </p>
                </div>
                <div>
                  {showBugTracker ? (
                    <ToggleRight className="w-6 h-6" style={{ color: 'var(--premium-blue)' }} />
                  ) : (
                    <ToggleLeft className="w-6 h-6" style={{ color: 'var(--premium-text-tertiary)' }} />
                  )}
                </div>
              </button>

              {/* Regenerate Connections */}
              <button
                onClick={handleRegenerateConnections}
                disabled={regenerating}
                className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left group hover:bg-amber-500/5 hover:border-amber-500/20 border"
                style={{
                  background: 'rgba(245, 158, 11, 0.05)',
                  borderColor: 'rgba(245, 158, 11, 0.15)'
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                  background: 'rgba(245, 158, 11, 0.15)'
                }}>
                  <RefreshCw className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`} style={{ color: '#fbbf24' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold premium-text-platinum text-sm">
                    Regenerate Knowledge Graph
                  </h3>
                  <p style={{ color: 'var(--premium-text-secondary)', fontSize: '0.8rem' }}>
                    Re-scan library to find new semantic connections
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  )
}