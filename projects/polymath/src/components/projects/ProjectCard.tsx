/**
 * ProjectCard Component - Stunning Visual Design
 */

import { PinnedTaskList } from './PinnedTaskList'

export const ProjectCard = React.memo(function ProjectCard({
  project: initialProject,
  onDelete,
  onClick,
  showActions = true,
  compact = false
}: ProjectCardProps) {
  // Get fresh project data from store every render
  const projects = useProjectStore(state => state.projects)
  const project = projects.find(p => p.id === initialProject.id) || initialProject

  const relativeTime = formatRelativeTime(project.last_active)
  const [connectionCount, setConnectionCount] = useState(0)
  const [exitX, setExitX] = useState(0)
  const [showQuickNote, setShowQuickNote] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [draggedPinnedTaskId, setDraggedPinnedTaskId] = useState<string | null>(null)

  const { updateProject, setPriority } = useProjectStore()
  const { addToast } = useToast()

  // ... existing code ...

  // Pinned Task Handlers
  const handlePinnedAddTask = React.useCallback(async (text: string) => {
    const tasks = (project.metadata?.tasks || []) as any[]
    const newTask = {
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      created_at: new Date().toISOString(),
      order: tasks.length
    }
    const updatedTasks = [...tasks, newTask]
    
    try {
      await updateProject(project.id, {
        metadata: { ...project.metadata, tasks: updatedTasks }
      })
    } catch (error) {
      console.error('Failed to add task:', error)
    }
  }, [project, updateProject])

  const handlePinnedToggleTask = React.useCallback(async (taskId: string) => {
    const tasks = (project.metadata?.tasks || []) as any[]
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, done: !t.done } : t
    )
    const progress = Math.round((updatedTasks.filter(t => t.done).length / updatedTasks.length) * 100) || 0
    
    try {
      await updateProject(project.id, {
        metadata: { ...project.metadata, tasks: updatedTasks, progress }
      })
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }, [project, updateProject])

  const handlePinnedReorderTask = React.useCallback((draggedId: string, targetId: string) => {
    const allTasks = (project.metadata?.tasks || []) as any[]
    const sortedTasks = [...allTasks].sort((a, b) => a.order - b.order)

    const draggedIndex = sortedTasks.findIndex(t => t.id === draggedId)
    const targetIndex = sortedTasks.findIndex(t => t.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newTasks = [...sortedTasks]
    const [draggedTask] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(targetIndex, 0, draggedTask)

    const reorderedTasks = newTasks.map((task, index) => ({
      ...task,
      order: index
    }))

    // Optimistic update
    updateProject(project.id, {
      metadata: { ...project.metadata, tasks: reorderedTasks }
    })
  }, [project, updateProject])

  const pinnedContent = React.useMemo(() => (
    <PinnedTaskList
      tasks={project.metadata?.tasks || []}
      onToggle={handlePinnedToggleTask}
      onAdd={handlePinnedAddTask}
      onReorder={handlePinnedReorderTask}
      draggedTaskId={draggedPinnedTaskId}
      onDragStart={setDraggedPinnedTaskId}
      onDragEnd={() => setDraggedPinnedTaskId(null)}
    />
  ), [project.metadata?.tasks, handlePinnedToggleTask, handlePinnedAddTask, handlePinnedReorderTask, draggedPinnedTaskId])

  // ... existing code ...

  return (
    <>
      {/* ... existing code ... */}
                  <PinButton
                    type="project"
                    id={project.id}
                    title={project.title}
                    content={pinnedContent}
                  />
      {/* ... existing code ... */}
    </>
  )
})

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}w ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}mo ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years}y ago`
  }
}
