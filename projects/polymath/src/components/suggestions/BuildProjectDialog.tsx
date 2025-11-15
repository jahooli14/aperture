/**
 * Build Project Dialog
 * Custom dialog for building a project from a suggestion
 * Replaces browser confirm() with professional UI
 */

import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select } from '../ui/select'
import { Hammer, Sparkles, TrendingUp } from 'lucide-react'
import type { ProjectSuggestion } from '../../types'

interface BuildProjectDialogProps {
  suggestion: ProjectSuggestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (projectData: {
    title: string
    description: string
  }) => Promise<void>
}

export function BuildProjectDialog({
  suggestion,
  open,
  onOpenChange,
  onConfirm
}: BuildProjectDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  })

  // Pre-fill form when suggestion changes
  useEffect(() => {
    if (suggestion) {
      setFormData({
        title: suggestion.title,
        description: suggestion.description
      })
    }
  }, [suggestion])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onConfirm(formData)
      onOpenChange(false)
    } catch (error) {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  if (!suggestion) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Hammer className="h-5 w-5 text-blue-900" />
              </div>
              <DialogTitle>Build this project</DialogTitle>
            </div>
            <DialogDescription>
              Review and customize your project details before building. This will create a new active project and strengthen related capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Preview Scores */}
            <div className="flex gap-2 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium">{Math.round(suggestion.novelty_score * 100)}% Fresh</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Hammer className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{Math.round(suggestion.feasibility_score * 100)}% Doable</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Sparkles className="h-4 w-4 text-blue-900" />
                <span className="font-medium">{Math.round(suggestion.interest_score * 100)}% Exciting</span>
              </div>
            </div>

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="build-title">Project Title *</Label>
              <Input
                id="build-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                placeholder="My Awesome Project"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="build-description">Description</Label>
              <Textarea
                id="build-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                placeholder="What is this project about?"
              />
            </div>

            {/* Capabilities Info */}
            {suggestion.capability_ids.length > 0 && (
              <div className="text-xs text-neutral-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                <span className="font-semibold">✨ This will strengthen {suggestion.capability_ids.length} capability{suggestion.capability_ids.length !== 1 ? 'ies' : ''}</span>
                <p className="mt-1">Building this project will boost the skills and tools used in the suggestion.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                  Building...
                </>
              ) : (
                <>
                  <Hammer className="h-4 w-4 mr-2" />
                  Build Project
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
