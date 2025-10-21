/**
 * Projects Page - Stunning Visual Design
 */

import { useEffect } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/projects/ProjectCard'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Rocket } from 'lucide-react'

export function ProjectsPage() {
  const {
    projects,
    loading,
    error,
    filter,
    fetchProjects,
    setFilter
  } = useProjectStore()

  useEffect(() => {
    fetchProjects()
  }, [])

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stunning Header */}
        <div className="text-center mb-12 relative">
          <div className="inline-block mb-4">
            <div className="relative">
              <Rocket className="h-16 w-16 text-purple-600 mx-auto mb-4 float-animation" />
              <div className="absolute inset-0 bg-purple-600/20 blur-2xl" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 gradient-text">
            My Projects
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Track your creative work and strengthen capabilities
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 backdrop-blur-xl bg-white/60 rounded-2xl p-6 border border-white/20 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: '🚀 Active' },
              { key: 'dormant', label: '💤 Dormant' },
              { key: 'completed', label: '✅ Completed' }
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(key as typeof filter)}
                className={filter === key ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg' : 'hover:scale-105 transition-transform'}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full">
              <span className="font-bold text-purple-700">{projects.length}</span>
              <span className="text-purple-600 ml-1">project{projects.length !== 1 ? 's' : ''}</span>
            </div>
            <CreateProjectDialog />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-300 bg-gradient-to-r from-red-50 to-pink-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600 font-semibold">❌ {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading ? (
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
            <CardContent className="py-24">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-4"></div>
                <p className="text-lg text-gray-600">Loading your projects...</p>
              </div>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          /* Empty State */
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
            <CardContent className="py-24">
              <div className="text-center space-y-6">
                <div className="relative inline-block">
                  <Rocket className="h-20 w-20 text-purple-600 mx-auto float-animation" />
                  <div className="absolute inset-0 bg-purple-600/20 blur-2xl" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">No projects yet</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Build a project from a suggestion or create one manually to get started on your creative journey
                </p>
                <CreateProjectDialog />
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
