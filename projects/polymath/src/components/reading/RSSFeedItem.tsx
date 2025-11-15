/**
 * RSS Feed Item Component
 * Displays an RSS feed item with save button
 */

import { useState } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { BookmarkPlus, ExternalLink, Clock, X } from 'lucide-react'
import type { RSSFeedItem as RSSItem } from '../../types/rss'
import { haptic } from '../../utils/haptics'

interface RSSFeedItemProps {
  item: RSSItem & { feed_title?: string }
  onSave: () => void
  onDismiss?: () => void
}

export function RSSFeedItem({ item, onSave, onDismiss }: RSSFeedItemProps) {
  const [exitX, setExitX] = useState(0)

  // Motion values for swipe gesture
  const x = useMotionValue(0)
  const saveIndicatorOpacity = useTransform(x, [0, 100], [0, 1])
  const dismissIndicatorOpacity = useTransform(x, [-100, 0], [1, 0])
  const backgroundColor = useTransform(
    x,
    [-150, 0, 150],
    ['rgba(239, 68, 68, 0.3)', 'rgba(20, 27, 38, 0.4)', 'rgba(59, 130, 246, 0.3)']
  )

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x
    const velocity = info.velocity.x

    // Swipe right = Save to reading queue
    if (offset > 100 || velocity > 500) {
      haptic.success()
      setExitX(1000)
      setTimeout(() => {
        onSave()
      }, 200)
    }
    // Swipe left = Dismiss
    else if ((offset < -100 || velocity < -500) && onDismiss) {
      haptic.light()
      setExitX(-1000)
      setTimeout(() => {
        onDismiss()
      }, 200)
    }
  }
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const truncateDescription = (text: string | null, maxLength = 200) => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength).trim() + '...'
  }

  return (
    <motion.div
      style={{ x }}
      drag="x"
      dragConstraints={{ left: -200, right: 200 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      animate={exitX !== 0 ? { x: exitX, opacity: 0 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative"
    >
      {/* Save Indicator (Swipe Right) */}
      <motion.div
        style={{ opacity: saveIndicatorOpacity }}
        className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none z-10 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <BookmarkPlus className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
          <span className="text-xl font-bold" style={{ color: 'var(--premium-blue)' }}>SAVE</span>
        </div>
      </motion.div>

      {/* Dismiss Indicator (Swipe Left) */}
      <motion.div
        style={{ opacity: dismissIndicatorOpacity }}
        className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none z-10 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-red-500">DISMISS</span>
          <X className="h-6 w-6 text-red-500" />
        </div>
      </motion.div>

      <motion.div style={{ backgroundColor }}>
        <div
          className="premium-card p-4 hover:bg-white/5 transition-all group"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Feed Title */}
          {item.feed_title && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--premium-blue)'
              }}>
                {item.feed_title}
              </span>
              {item.published_at && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                  <Clock className="h-3 w-3" />
                  {formatDate(item.published_at)}
                </span>
              )}
            </div>
          )}

          {/* Article Title */}
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-2 group/link"
          >
            <h3 className="font-semibold text-base premium-text-platinum group-hover/link:text-blue-400 transition-colors flex items-center gap-2">
              {item.title}
              <ExternalLink className="h-4 w-4 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </h3>
          </a>

          {/* Description */}
          {item.description && (
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
              {truncateDescription(item.description)}
            </p>
          )}

          {/* Author */}
          {item.author && (
            <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              By {item.author}
            </p>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={onSave}
          className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all hover:scale-110 active:scale-95"
          style={{
            borderColor: 'rgba(59, 130, 246, 0.3)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--premium-blue)'
          }}
          aria-label="Save to reading queue"
          title="Save to reading queue"
        >
          <BookmarkPlus className="h-5 w-5" />
        </button>
      </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
