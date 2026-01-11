import { motion } from 'framer-motion'
import { Check, Circle } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { SceneNode, ChecklistItem } from '../types/manuscript'

interface ChecklistHeaderProps {
  scene: SceneNode
}

export default function ChecklistHeader({ scene }: ChecklistHeaderProps) {
  const { updateScene } = useManuscriptStore()

  const toggleItem = (itemId: string) => {
    const updatedChecklist = scene.checklist.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    )
    updateScene(scene.id, { checklist: updatedChecklist })
  }

  // If no checklist or pulse check not done, show minimal header
  if (!scene.checklist || scene.checklist.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-ink-900/50 border-b border-ink-800">
        <span className="text-xs text-ink-500">
          Complete Pulse Check to generate checklist
        </span>
      </div>
    )
  }

  // Show max 6 items, prioritizing unchecked
  const sortedChecklist = [...scene.checklist].sort((a, b) => {
    if (a.checked === b.checked) return 0
    return a.checked ? 1 : -1
  }).slice(0, 6)

  const completedCount = scene.checklist.filter(i => i.checked).length
  const totalCount = scene.checklist.length

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-ink-900/80 backdrop-blur-sm border-b border-ink-800 overflow-hidden"
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-ink-800">
        <motion.div
          className="h-full bg-status-green"
          initial={{ width: 0 }}
          animate={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Scrollable checklist */}
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
        {sortedChecklist.map(item => (
          <ChecklistItemButton
            key={item.id}
            item={item}
            onToggle={() => toggleItem(item.id)}
          />
        ))}

        {scene.checklist.length > 6 && (
          <span className="text-xs text-ink-500 whitespace-nowrap px-2">
            +{scene.checklist.length - 6} more
          </span>
        )}
      </div>
    </motion.div>
  )
}

function ChecklistItemButton({
  item,
  onToggle
}: {
  item: ChecklistItem
  onToggle: () => void
}) {
  const categoryColors: Record<string, string> = {
    identity: 'border-section-departure',
    sensory: 'border-section-escape',
    footnote: 'border-section-rupture',
    structure: 'border-section-alignment'
  }

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
        item.checked
          ? 'bg-status-green/20 border-status-green/50 text-status-green'
          : `bg-ink-900 ${categoryColors[item.category] || 'border-ink-700'} text-ink-300`
      }`}
    >
      {item.checked ? (
        <Check className="w-3 h-3" />
      ) : (
        <Circle className="w-3 h-3" />
      )}
      <span className="text-xs">{item.label}</span>
    </button>
  )
}
