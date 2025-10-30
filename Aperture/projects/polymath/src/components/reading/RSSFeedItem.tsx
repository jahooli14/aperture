/**
 * RSS Feed Item Component
 * Displays an RSS feed item with save button
 */

import { BookmarkPlus, ExternalLink, Clock } from 'lucide-react'
import type { RSSFeedItem as RSSItem } from '../../types/rss'

interface RSSFeedItemProps {
  item: RSSItem & { feed_title?: string }
  onSave: () => void
}

export function RSSFeedItem({ item, onSave }: RSSFeedItemProps) {
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
  )
}
