/**
 * Projects Page - Stunning Visual Design
 */

import { useEffect, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/projects/ProjectCard'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Rocket } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import type { Project } from '../types'

export function ProjectsPage() {
  const {
    projects,
    loading,
    error,
    filter,
    fetchProjects,
    deleteProject,
    setFilter
  } = useProjectStore()

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleEdit = (project: Project) => {
    setSelectedProject(project)
    setEditDialogOpen(true)
  }

  const handleDelete = async (project: Project) => {
    if (confirm(`Delete "${project.title}"? This action cannot be undone.`)) {
      try {
        await deleteProject(project.id)
        addToast({
          title: 'Project deleted',
          description: `"${project.title}" has been removed.`,
          variant: 'success',
        })
      } catch (error) {
        addToast({
          title: 'Failed to delete project',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <div className="min-h-screen py-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
        <div className="inline-flex items-center justify-center mb-4">
          <Rocket className="h-12 w-12 text-orange-600" />
        </div>
        <h1 className="text-4xl font-bold mb-3 text-neutral-900">
          My Projects
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
          Track your creative work and strengthen capabilities
        </p>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-10">
          <div className="flex flex-wrap gap-2 justify-center">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'dormant', label: 'Dormant' },
                { key: 'completed', label: 'Completed' }
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={filter === key ? 'default' : 'outline'}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-full font-medium transition-all ${
                    filter === key
                      ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {label}
                </Button>
              ))}
          </div>

          <div className="flex items-center justify-center gap-4">
            <div className="px-5 py-2.5 bg-orange-50 rounded-full border-2 border-orange-200">
              <span className="font-bold text-neutral-900 text-lg">{projects.length}</span>
              <span className="text-neutral-600 ml-1.5">project{projects.length !== 1 ? 's' : ''}</span>
            </div>
            <CreateProjectDialog />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600 font-semibold">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading ? (
          <Card className="pro-card">
            <CardContent className="py-24">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent mb-4"></div>
                <p className="text-lg text-neutral-600">Loading your projects...</p>
              </div>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          /* Empty State */
          <Card className="pro-card">
            <CardContent className="py-24">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center">
                  <Rocket className="h-16 w-16 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-neutral-900">No projects yet</h3>
                <p className="text-neutral-600 max-w-md mx-auto">
                  Build a project from a suggestion or create one manually to get started on your creative journey
                </p>
                <CreateProjectDialog />
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Projects Grid - Bento Box Layout with Stagger Animation */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children mt-8">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => handleEdit(project)}
                onDelete={() => handleDelete(project)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditProjectDialog
        project={selectedProject}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
