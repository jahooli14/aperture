import { useState } from 'react'
import { BookmarkPlus, ExternalLink, Clock, X, MoreVertical } from 'lucide-react'
import type { RSSFeedItem as RSSItem } from '../../types/rss'
import { format } from 'date-fns'
import { Button } from '../ui/button'

interface RSSFeedItemProps {
  item: RSSItem & { feed_title?: string }
  onSave: () => void
  onDismiss?: () => void
}

export function RSSFeedItem({ item, onSave, onDismiss }: RSSFeedItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Extract image from content/description if possible (simple regex)
  const getImageUrl = (html: string) => {
    const match = html.match(/<img[^>]+src="([^">]+)"/)
    return match ? match[1] : null
  }

  const imageUrl = item.enclosure?.url || (item.content ? getImageUrl(item.content) : null) || (item.description ? getImageUrl(item.description) : null)

  return (
    <div
      className="group block rounded-xl backdrop-blur-xl transition-all duration-300 break-inside-avoid border p-4 cursor-pointer relative mb-4"
      style={{
        borderColor: 'rgba(255, 255, 255, 0.1)',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}
      onMouseEnter={(e) => {
        setIsHovered(true)
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.4)'
      }}
      onMouseLeave={(e) => {
        setIsHovered(false)
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Row 1: Title & Actions */}
      <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 group/link"
        >
          <h3 className="text-lg font-bold leading-tight line-clamp-2 group-hover/link:text-blue-400 transition-colors" style={{ color: 'var(--premium-text-primary)' }}>
            {item.title}
          </h3>
          {item.feed_title && (
            <div className="text-xs truncate mt-1" style={{ color: 'var(--premium-text-tertiary)' }}>
              {item.feed_title}
            </div>
          )}
        </a>

        {/* Actions Menu */}
        <div className="flex items-center gap-1 shrink-0 -mr-2 -mt-1">
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onSave()
            }}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-white/10 text-blue-400"
            title="Save to Inbox"
          >
            <BookmarkPlus className="h-4 w-4" />
          </Button>
          {onDismiss && (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/10 text-gray-400 hover:text-red-400"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Image & Meta */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Thumbnail (Left) */}
        {imageUrl ? (
          <div className="flex-shrink-0">
            <img
              src={imageUrl}
              alt={item.title || 'Feed thumbnail'}
              className="w-16 h-16 rounded-lg object-cover bg-black/20"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <span className="text-2xl opacity-20">📰</span>
          </div>
        )}

        {/* Right Column: Meta */}
        <div className="flex-1 flex flex-col items-end justify-end h-16 text-right">
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
            {item.published_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(item.published_at), 'MMM d')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Description */}
      {item.description && (
        <div
          className="text-sm line-clamp-4 mb-1 leading-relaxed"
          style={{ color: 'var(--premium-text-secondary)' }}
          dangerouslySetInnerHTML={{
            __html: item.description.replace(/<[^>]+>/g, '').substring(0, 300) + (item.description.length > 300 ? '...' : '')
          }}
        />
      )}
    </div>
  )
}
