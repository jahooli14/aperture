import { useState } from 'react'
import { BookmarkPlus, X, MoreVertical } from 'lucide-react'
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

  return (
    <div
      className="group block rounded-xl backdrop-blur-xl transition-all duration-300 break-inside-avoid border p-4 cursor-pointer relative mb-3"
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
      {/* Title & Header */}
      <div className="flex items-start justify-between gap-3 mb-2 relative z-10">
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 group/link"
        >
          <h3 className="text-base font-bold leading-snug line-clamp-2 group-hover/link:text-blue-400 transition-colors mb-1" style={{ color: 'var(--premium-text-primary)' }}>
            {item.title}
          </h3>
          <div className="flex items-center gap-2 text-xs truncate" style={{ color: 'var(--premium-text-tertiary)' }}>
            {item.feed_title && (
              <span className="truncate max-w-[150px]">{item.feed_title}</span>
            )}
            {item.feed_title && item.published_at && <span>•</span>}
            {item.published_at && (
              <span className="flex items-center gap-1 shrink-0">
                {format(new Date(item.published_at), 'MMM d')}
              </span>
            )}
          </div>
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

      {/* Description */}
      {item.description && (
        <div
          className="text-sm line-clamp-3 leading-relaxed"
          style={{ color: 'var(--premium-text-secondary)' }}
          dangerouslySetInnerHTML={{
            __html: item.description.replace(/<[^>]+>/g, '').substring(0, 200) + (item.description.length > 200 ? '...' : '')
          }}
        />
      )}
    </div>
  )
}
