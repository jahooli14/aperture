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
      if (!user) {
        console.error('No user found')
        alert('Not logged in')
        return
      }

      console.log('Clearing data for user:', user.id)

      // Clear user's data in order (respecting foreign keys)
      // Delete in reverse dependency order to avoid FK violations
      const tables = [
        'gap_prompts',
        'creative_opportunities',
        'project_suggestions',
        'projects',
        'memories',
        'user_daily_context'
      ]

      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('user_id', user.id)
        if (error) {
          console.error(`Error deleting from ${table}:`, error)
        } else {
          console.log(`✓ Cleared ${table}`)
        }
      }

      // Mark demo as dismissed
      localStorage.setItem('polymath_demo_dismissed', 'true')

      console.log('All data cleared successfully')
      alert('Demo data cleared! Refreshing page...')

      onDataCleared()
    } catch (error) {
      console.error('Error clearing demo data:', error)
      alert('Error clearing data: ' + (error as Error).message)
    } finally {
      setIsClearing(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="sticky top-16 z-40 backdrop-blur-xl bg-gradient-to-r from-amber-500/95 to-blue-500/95 border-b border-amber-600/20 shadow-lg">
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
                  className="backdrop-blur-xl bg-white/90 border-2 shadow-xl rounded-lg px-4 py-2 font-medium transition-all hover:shadow-2xl disabled:opacity-50"
                  style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#dc2626' }}
                >
                  {isClearing ? 'Clearing...' : 'Yes, Clear Everything'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="backdrop-blur-xl bg-white/30 border-2 shadow-md rounded-lg px-4 py-2 font-medium transition-all hover:shadow-lg text-white"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
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
    <div className="sticky top-16 z-40 backdrop-blur-xl bg-gradient-to-r from-amber-500/95 to-blue-500/95 border-b border-amber-600/20 shadow-lg">
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
              Explore <strong>8 diverse memories</strong> spanning tech, hobbies, and life insights.{' '}
              <strong>Click "Generate Ideas"</strong> to watch AI synthesis in action - it connects your interests in unexpected ways!
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-2 backdrop-blur-xl bg-white/90 border-2 shadow-xl rounded-lg px-4 py-2 font-medium transition-all hover:shadow-2xl"
                style={{ borderColor: 'rgba(59, 130, 246, 0.5)', color: '#3b82f6' }}
              >
                <Eye className="h-4 w-4" />
                Keep Exploring
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-2 backdrop-blur-xl bg-white/30 border-2 shadow-md rounded-lg px-4 py-2 font-medium transition-all hover:shadow-lg text-white"
                style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
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
