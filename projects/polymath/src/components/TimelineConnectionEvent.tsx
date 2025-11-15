import { motion } from 'framer-motion'
import { Link2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePin } from '../contexts/PinContext'

interface TimelineConnectionEventProps {
  fromItem: {
    type: 'project' | 'thought' | 'article'
    id: string
    title: string
  }
  toItem: {
    type: 'project' | 'thought' | 'article'
    id: string
    title: string
  }
  reasoning?: string
  timestamp: string
  connectionType: 'ai_suggested' | 'user_created'
}

export function TimelineConnectionEvent({
  fromItem,
  toItem,
  reasoning,
  timestamp,
  connectionType
}: TimelineConnectionEventProps) {
  const navigate = useNavigate()
  const { pinItem } = usePin()

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'project': return '📦'
      case 'article': return '📰'
      case 'thought': return '💭'
      default: return '📄'
    }
  }

  const getItemUrl = (item: typeof fromItem) => {
    switch (item.type) {
      case 'project': return `/projects/${item.id}`
      case 'thought': return `/memories?highlight=${item.id}`
      case 'article': return `/reading?highlight=${item.id}`
      default: return '#'
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const handleSplitView = () => {
    // Open both items in split view
    navigate(getItemUrl(fromItem))

    // Pin the second item
    setTimeout(() => {
      pinItem({
        type: toItem.type,
        id: toItem.id,
        title: toItem.title,
        content: (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--premium-text-primary)' }}>
              {toItem.title}
            </h2>
            <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
              Click to view full details
            </p>
          </div>
        )
      })
    }, 100)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative pl-8 pb-6"
    >
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-2 w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: 'var(--premium-cyan)',
          borderColor: 'var(--premium-surface-base)'
        }}
      />

      {/* Connection card */}
      <div
        className="premium-glass rounded-2xl p-4 cursor-pointer hover:bg-white/5 transition-all"
        onClick={handleSplitView}
        style={{
          border: '1px solid rgba(6, 182, 212, 0.2)'
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <Link2 size={16} style={{ color: 'var(--premium-cyan)' }} />
          </motion.div>
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--premium-cyan)' }}
          >
            {connectionType === 'ai_suggested' ? 'AI Connected' : 'Connected'}
          </span>
          <span className="text-xs ml-auto" style={{ color: 'var(--premium-text-tertiary)' }}>
            {formatTime(timestamp)}
          </span>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getItemIcon(fromItem.type)}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
              {fromItem.title}
            </span>
          </div>

          <div className="flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: 'var(--premium-cyan)', opacity: 0.5 }}
            >
              <path
                d="M12 5v14m0 0l-4-4m4 4l4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">{getItemIcon(toItem.type)}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
              {toItem.title}
            </span>
          </div>
        </div>

        {/* Reasoning */}
        {reasoning && (
          <div
            className="mt-3 pt-3 border-t text-xs italic leading-relaxed"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--premium-text-secondary)'
            }}
          >
            "{reasoning}"
          </div>
        )}

        {/* Call to action */}
        <div className="mt-3 text-xs" style={{ color: 'var(--premium-cyan)' }}>
          Tap to view both →
        </div>
      </div>
    </motion.div>
  )
}
