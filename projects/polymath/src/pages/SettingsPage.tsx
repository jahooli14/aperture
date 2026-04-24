import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Settings, Palette, Check, Bug, ToggleRight, ToggleLeft, Zap, RefreshCw, Search, Type, Bell, GitBranch, RotateCcw, Sparkles } from 'lucide-react'
import { useSelfModelFlag, setSelfModelFlag } from '../lib/useSelfModelFlag'
import { api } from '../lib/apiClient'
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
  const { accentColor, intensity, fontSize, showBugTracker, showRegenerateInsights, setAccentColor, setIntensity, setFontSize, setShowBugTracker, setShowRegenerateInsights } = useThemeStore()
  const selfModelEnabled = useSelfModelFlag()
  const { addToast } = useToast()
  const [regenerating, setRegenerating] = useState(false)
  const [allowHandoff, setAllowHandoff] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = (await api.get('projects?resource=metabolism-settings')) as { allow_handoff_mutations?: boolean } | null
        if (res && typeof res.allow_handoff_mutations === 'boolean') {
          setAllowHandoff(res.allow_handoff_mutations)
        }
      } catch {
        // Silent — settings are optional.
      }
    })()
  }, [])

  const toggleHandoff = async () => {
    const next = !allowHandoff
    setAllowHandoff(next)
    try {
      await api.post('projects?resource=metabolism-settings', { allow_handoff_mutations: next })
    } catch {
      setAllowHandoff(!next)
      addToast({ title: 'Failed to save', variant: 'destructive' })
    }
  }
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

  const handleResetOnboarding = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/utilities?resource=reset-onboarding', { method: 'POST' })
      if (!res.ok) throw new Error('Reset failed')
      const { deleted } = await res.json() as { deleted: Record<string, number> }
      const total = Object.values(deleted || {}).reduce((a, b) => a + b, 0)
      addToast({
        title: 'Onboarding reset',
        description: total > 0
          ? `Removed ${total} onboarding artifact${total === 1 ? '' : 's'}. Head to /onboarding to run it again.`
          : 'Nothing to remove — you’re clear to re-run /onboarding.',
        variant: 'success',
      })
      setResetConfirm(false)
    } catch {
      addToast({ title: 'Reset failed', description: 'Try again in a moment.', variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  const handleRegenerateConnections = async () => {
    setRegenerating(true)
    try {
      const response = await fetch('/api/connections?resource=regenerate', {
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
          backgroundColor: 'rgba(15, 24, 41, 0.85)',
          paddingTop: 'env(safe-area-inset-top)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.75rem] sm:text-4xl leading-[0.95] font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] truncate">
              your <span className="page-accent">settings</span>
            </h1>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="h-11 w-11 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--glass-surface)] bg-[var(--glass-surface)] press-spring flex-shrink-0"
            style={{ color: 'rgb(var(--page-accent-rgb, var(--brand-primary-rgb)))', border: '1px solid rgba(255,255,255,0.1)' }}
            title="Search everything"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-screen pb-24" style={{ paddingTop: 'calc(5.5rem + env(safe-area-inset-top))' }}>

        {/* Appearance Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--brand-glass-bg)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="flex items-center gap-3 mb-6 border-b border-[var(--glass-surface)] pb-4">
              <Palette className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--brand-primary)" }}
              >
                Appearance
              </h2>
            </div>

            {/* Accent Color */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: "var(--brand-primary)" }}>
                Accent Color
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 sm:gap-3">
                {getAvailableColors().map((color) => {
                  const preview = getColorPreview(color)
                  const isSelected = accentColor === color
                  return (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className={`relative aspect-square rounded-xl transition-all duration-300 min-h-[44px] ${isSelected ? 'scale-105 ring-2 ring-offset-2 ring-offset-black/50' : 'hover:scale-105'}`}
                      style={{
                        background: `linear-gradient(135deg, ${preview.primary}, ${preview.light})`,
                        boxShadow: isSelected ? `0 0 20px ${preview.primary}60` : '0 2px 8px rgba(0,0,0,0.3)',
                        borderColor: isSelected ? preview.primary : 'transparent'
                      }}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-6 w-6 text-[var(--brand-text-primary)] drop-shadow-md" />
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
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: "var(--brand-primary)" }}>
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
                        background: isSelected ? 'rgba(var(--color-accent-dark-rgb), 0.1)' : 'var(--glass-surface)',
                        borderColor: isSelected ? 'var(--brand-primary)' : 'var(--glass-surface)',
                        boxShadow: isSelected ? '0 0 15px rgba(var(--color-accent-dark-rgb), 0.1)' : 'none'
                      }}
                    >
                      <div className={`font-semibold mb-1 ${isSelected ? '' : 'premium-text-platinum'}`} style={{ color: isSelected ? 'var(--brand-primary)' : undefined }}>
                        {option.label}
                      </div>
                      <div className="text-xs" style={{ color: "var(--brand-primary)" }}>
                        {option.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: "var(--brand-primary)" }}>
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
                        background: isSelected ? 'rgba(var(--color-accent-dark-rgb), 0.1)' : 'var(--glass-surface)',
                        borderColor: isSelected ? 'var(--brand-primary)' : 'var(--glass-surface)',
                        fontSize: option.value === 'small' ? '14px' : option.value === 'large' ? '18px' : '16px'
                      }}
                    >
                      <div className={`font-medium ${isSelected ? '' : 'premium-text-platinum'}`} style={{ color: isSelected ? 'var(--brand-primary)' : undefined }}>
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
            background: 'var(--brand-glass-bg)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="flex items-center gap-3 mb-6 border-b border-[var(--glass-surface)] pb-4">
              <Bell className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--brand-primary)" }}>
                Notifications
              </h2>
            </div>

            <div className="space-y-3">

              {/* Bedtime reflection */}
              <div className="rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface-hover)' }}>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-[15px]" style={{ color: "var(--brand-primary)" }}>Bedtime reflection</p>
                    <p className="text-[12px]" style={{ color: "var(--brand-primary)" }}>Daily reminder to capture the day</p>
                  </div>
                  <button
                    onClick={() => toggleBedtime(!bedtimeEnabled)}
                    className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                    style={{ background: bedtimeEnabled ? 'rgba(52,211,153,0.8)' : 'var(--glass-surface-hover)' }}
                  >
                    <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: bedtimeEnabled ? '26px' : '4px' }} />
                  </button>
                </div>
                {bedtimeEnabled && (
                  <div className="px-4 pb-3.5 flex items-center gap-3 border-t border-[var(--glass-surface)] pt-3">
                    <span className="text-[12px]" style={{ color: "var(--brand-primary)" }}>Time</span>
                    <select
                      value={bedtimeHour}
                      onChange={e => updateBedtime(Number(e.target.value), bedtimeMinute)}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i} style={{ background: 'var(--brand-bg)' }}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: "var(--brand-primary)" }}>:</span>
                    <select
                      value={bedtimeMinute}
                      onChange={e => updateBedtime(bedtimeHour, Number(e.target.value))}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m} style={{ background: 'var(--brand-bg)' }}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Morning planning */}
              <div className="rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface-hover)' }}>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-[15px]" style={{ color: "var(--brand-primary)" }}>Morning planning</p>
                    <p className="text-[12px]" style={{ color: "var(--brand-primary)" }}>Set your intentions for the day</p>
                  </div>
                  <button
                    onClick={() => toggleMorning(!morningEnabled)}
                    className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                    style={{ background: morningEnabled ? 'rgba(52,211,153,0.8)' : 'var(--glass-surface-hover)' }}
                  >
                    <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: morningEnabled ? '26px' : '4px' }} />
                  </button>
                </div>
                {morningEnabled && (
                  <div className="px-4 pb-3.5 flex items-center gap-3 border-t border-[var(--glass-surface)] pt-3">
                    <span className="text-[12px]" style={{ color: "var(--brand-primary)" }}>Time</span>
                    <select
                      value={morningHour}
                      onChange={e => updateMorning(Number(e.target.value), morningMinute)}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i} style={{ background: 'var(--brand-bg)' }}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: "var(--brand-primary)" }}>:</span>
                    <select
                      value={morningMinute}
                      onChange={e => updateMorning(morningHour, Number(e.target.value))}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m} style={{ background: 'var(--brand-bg)' }}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Task-time notifications */}
              <div className="flex items-center justify-between px-4 py-3.5 rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface-hover)' }}>
                <div>
                  <p className="text-[15px]" style={{ color: "var(--brand-primary)" }}>Task-time reminders</p>
                  <p className="text-[12px]" style={{ color: "var(--brand-primary)" }}>Notify when a task's scheduled time arrives</p>
                </div>
                <button
                  onClick={() => toggleTodoNotifications(!todoTimeNotificationsEnabled)}
                  className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                  style={{ background: todoTimeNotificationsEnabled ? 'rgba(52,211,153,0.8)' : 'var(--glass-surface-hover)' }}
                >
                  <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: todoTimeNotificationsEnabled ? '26px' : '4px' }} />
                </button>
              </div>

              {/* End-of-day overdue reminder */}
              <div className="rounded-xl" style={{ background: 'var(--premium-surface-1)', border: '1px solid var(--glass-surface-hover)' }}>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-[15px]" style={{ color: "var(--brand-primary)" }}>End-of-day overdue reminder</p>
                    <p className="text-[12px]" style={{ color: "var(--brand-primary)" }}>Alert when tasks are still open late in the day</p>
                  </div>
                  <button
                    onClick={() => toggleOverdueReminder(!overdueReminderEnabled)}
                    className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
                    style={{ background: overdueReminderEnabled ? 'rgba(52,211,153,0.8)' : 'var(--glass-surface-hover)' }}
                  >
                    <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: overdueReminderEnabled ? '26px' : '4px' }} />
                  </button>
                </div>
                {overdueReminderEnabled && (
                  <div className="px-4 pb-3.5 flex items-center gap-3 border-t border-[var(--glass-surface)] pt-3">
                    <span className="text-[12px]" style={{ color: "var(--brand-primary)" }}>Time</span>
                    <select
                      value={overdueReminderHour}
                      onChange={e => updateOverdueReminder(Number(e.target.value), overdueReminderMinute)}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i} style={{ background: 'var(--brand-bg)' }}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: "var(--brand-primary)" }}>:</span>
                    <select
                      value={overdueReminderMinute}
                      onChange={e => updateOverdueReminder(overdueReminderHour, Number(e.target.value))}
                      className="rounded-lg px-2 py-1 text-[13px] outline-none"
                      style={{ background: 'var(--glass-surface)', color: "var(--brand-text-secondary)" }}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m} style={{ background: 'var(--brand-bg)' }}>
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
            background: 'var(--brand-glass-bg)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="flex items-center gap-3 mb-6 border-b border-[var(--glass-surface)] pb-4">
              <Zap className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--brand-primary)" }}
              >
                System
              </h2>
            </div>

            <div className="space-y-4">
              {/* Bug Tracker Toggle */}
              <button
                onClick={() => setShowBugTracker(!showBugTracker)}
                className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left border hover:bg-[var(--glass-surface)]"
                style={{
                  background: 'var(--glass-surface)',
                  borderColor: 'var(--glass-surface)'
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                  background: 'rgba(var(--color-error-rgb), 0.15)'
                }}>
                  <Bug className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold premium-text-platinum text-sm">
                    Bug Tracker / Debug Panel
                  </h3>
                  <p style={{ color: 'var(--brand-text-secondary)', fontSize: '0.8rem' }}>
                    Show technical details and debug tools
                  </p>
                </div>
                <div>
                  {showBugTracker ? (
                    <ToggleRight className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
                  ) : (
                    <ToggleLeft className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
                  )}
                </div>
              </button>

              {/* This-week regenerate button */}
              <button
                onClick={() => setShowRegenerateInsights(!showRegenerateInsights)}
                className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left border hover:bg-[var(--glass-surface)]"
                style={{
                  background: 'var(--glass-surface)',
                  borderColor: 'var(--glass-surface)',
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(var(--brand-primary-rgb), 0.15)' }}>
                  <RefreshCw className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold premium-text-platinum text-sm">
                    Regenerate “this week” button
                  </h3>
                  <p style={{ color: 'var(--brand-text-secondary)', fontSize: '0.8rem' }}>
                    Show a refresh icon on the home-page deck so you can rebuild it on demand instead of waiting for Monday.
                  </p>
                </div>
                <div>
                  {showRegenerateInsights ? (
                    <ToggleRight className="w-6 h-6" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                  ) : (
                    <ToggleLeft className="w-6 h-6" style={{ color: 'var(--brand-text-muted)' }} />
                  )}
                </div>
              </button>

              {/* Self-model homepage — experimental A/B */}
              <button
                onClick={() => setSelfModelFlag(!selfModelEnabled)}
                className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left border hover:bg-[var(--glass-surface)]"
                style={{
                  background: 'var(--glass-surface)',
                  borderColor: 'var(--glass-surface)',
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(var(--brand-primary-rgb), 0.15)' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold premium-text-platinum text-sm">
                    Self-model homepage (experimental)
                  </h3>
                  <p style={{ color: 'var(--brand-text-secondary)', fontSize: '0.8rem' }}>
                    Show the Thesis + Threads + Move panel at the top of the home page.
                  </p>
                </div>
                <div>
                  {selfModelEnabled ? (
                    <ToggleRight className="w-6 h-6" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                  ) : (
                    <ToggleLeft className="w-6 h-6" style={{ color: 'var(--brand-text-muted)' }} />
                  )}
                </div>
              </button>

              {/* Handoff mutations toggle — opt-in evolution mode */}
              <button
                onClick={toggleHandoff}
                className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left border hover:bg-[var(--glass-surface)]"
                style={{
                  background: 'var(--glass-surface)',
                  borderColor: 'var(--glass-surface)',
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(var(--brand-primary-rgb), 0.15)' }}>
                  <GitBranch className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold premium-text-platinum text-sm">
                    Allow handoff mutations
                  </h3>
                  <p style={{ color: 'var(--brand-text-secondary)', fontSize: '0.8rem' }}>
                    Let the weekly digest propose handing a dormant project to someone else.
                  </p>
                </div>
                <div>
                  {allowHandoff ? (
                    <ToggleRight className="w-6 h-6" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                  ) : (
                    <ToggleLeft className="w-6 h-6" style={{ color: 'var(--brand-text-muted)' }} />
                  )}
                </div>
              </button>

              {/* Regenerate Connections */}
              <button
                onClick={handleRegenerateConnections}
                disabled={regenerating}
                className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left group hover:bg-brand-primary/5 hover:border-brand-primary/20 border"
                style={{
                  background: 'rgba(var(--brand-primary-rgb), 0.05)',
                  borderColor: 'rgba(var(--brand-primary-rgb), 0.15)'
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                  background: 'rgba(var(--brand-primary-rgb), 0.15)'
                }}>
                  <RefreshCw className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`} style={{ color: "var(--brand-primary)" }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold premium-text-platinum text-sm">
                    Rediscover Connections
                  </h3>
                  <p style={{ color: 'var(--brand-text-secondary)', fontSize: '0.8rem' }}>
                    Re-scan everything to find new links between your ideas
                  </p>
                </div>
              </button>

              {/* Reset Onboarding — dev/debug. Two-tap: first reveals the
                  confirmation, second actually fires. Wipes memories, list
                  items, lists, projects, and suggestions created by the
                  voice chat. */}
              {!resetConfirm ? (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left border hover:bg-[var(--glass-surface)]"
                  style={{ background: 'var(--glass-surface)', borderColor: 'var(--glass-surface)' }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(var(--color-error-rgb), 0.15)' }}>
                    <RotateCcw className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold premium-text-platinum text-sm">
                      Reset onboarding
                    </h3>
                    <p style={{ color: 'var(--brand-text-secondary)', fontSize: '0.8rem' }}>
                      Wipe onboarding-created memories, lists, and ideas so you can run it again
                    </p>
                  </div>
                </button>
              ) : (
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    background: 'rgba(var(--color-error-rgb), 0.05)',
                    borderColor: 'rgba(var(--color-error-rgb), 0.3)',
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(var(--color-error-rgb), 0.15)' }}>
                      <RotateCcw className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold premium-text-platinum text-sm mb-1">
                        Reset onboarding?
                      </h3>
                      <p style={{ color: 'var(--brand-text-secondary)', fontSize: '0.8rem' }}>
                        This permanently deletes everything the voice chat created — memories, list items, the captured lists (if still empty), projects, and idea suggestions. Items you added manually are kept. Can't be undone.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleResetOnboarding}
                          disabled={resetting}
                          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                          style={{
                            background: 'rgba(var(--color-error-rgb), 0.8)',
                            color: 'white',
                          }}
                        >
                          {resetting ? 'Resetting…' : 'Yes, reset'}
                        </button>
                        <button
                          onClick={() => setResetConfirm(false)}
                          disabled={resetting}
                          className="px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                          style={{
                            background: 'var(--glass-surface)',
                            color: 'var(--brand-text-secondary)',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  )
}