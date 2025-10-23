/**
 * Demo Data Banner Component
 * Shows when user is viewing template/demo data
 * Provides clear CTAs to either keep exploring or clear and start fresh
 */

import { useState } from 'react'
import { X, Sparkles, Trash2, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface DemoDataBannerProps {
  onDismiss: () => void
  onDataCleared: () => void
}

export function DemoDataBanner({ onDismiss, onDataCleared }: DemoDataBannerProps) {
  const [isClearing, setIsClearing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClearDemoData = async () => {
    setIsClearing(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Clear user's data in order (respecting foreign keys)
      await supabase.from('project_suggestions').delete().eq('user_id', user.id)
      await supabase.from('projects').delete().eq('user_id', user.id)
      await supabase.from('memories').delete().eq('user_id', user.id)

      // Mark demo as dismissed
      localStorage.setItem('polymath_demo_dismissed', 'true')

      onDataCleared()
    } catch (error) {
      console.error('Error clearing demo data:', error)
    } finally {
      setIsClearing(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="sticky top-16 z-40 backdrop-blur-xl bg-gradient-to-r from-amber-500/95 to-orange-500/95 border-b border-amber-600/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Trash2 className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Clear all demo data?
              </h3>
              <p className="text-sm text-amber-50 mb-4">
                This will delete all template memories, suggestions, and projects. You'll start with a clean slate. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClearDemoData}
                  disabled={isClearing}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Yes, Clear Everything'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 bg-amber-600/20 text-white rounded-lg font-medium hover:bg-amber-600/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-16 z-40 backdrop-blur-xl bg-gradient-to-r from-amber-500/95 to-orange-500/95 border-b border-amber-600/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              You're viewing demo data
            </h3>
            <p className="text-sm text-amber-50 mb-3">
              This is template data to show you how Polymath works. You're seeing{' '}
              <strong>8 memories</strong>, <strong>7 AI suggestions</strong>, and{' '}
              <strong>4 projects</strong> that demonstrate the voice notes → synthesis → projects flow.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-medium hover:bg-amber-50 transition-colors"
              >
                <Eye className="h-4 w-4" />
                Keep Exploring
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600/20 text-white rounded-lg font-medium hover:bg-amber-600/30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Clear Demo Data
              </button>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 text-white hover:text-amber-100 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
