import { useState, useMemo } from 'react'
import { BookmarkPlus, X, Clock, ExternalLink } from 'lucide-react'
import type { RSSFeedItem as RSSItem } from '../../types/rss'
import { format } from 'date-fns'
import { Button } from '../ui/button'
import DOMPurify from 'dompurify'

interface RSSFeedItemProps {
  item: RSSItem & { feed_title?: string }
  onSave: () => void
  onRead: () => void
  onDismiss?: () => void
}

export function RSSFeedItem({ item, onSave, onRead, onDismiss }: RSSFeedItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)

  const sanitizedDescription = useMemo(() => {
    if (!item.description) return ''
    return DOMPurify.sanitize(item.description, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'i', 'b', 'ul', 'ol', 'li', 'a', 'img', 'blockquote'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    })
  }, [item.description])

  const hasLongDescription = sanitizedDescription.length > 300

  return (
    <div
      className="group block rounded-2xl backdrop-blur-xl transition-all duration-500 break-inside-avoid border p-5 cursor-pointer relative mb-4 overflow-hidden"
      onClick={onRead}
      style={{
        borderColor: isHovered ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)',
        background: isHovered
          ? 'linear-gradient(165deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)'
          : 'linear-gradient(165deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
        boxShadow: isHovered
          ? '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.05)'
          : '0 4px 12px rgba(0, 0, 0, 0.2)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <style>{`
        .rss-content {
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--premium-text-secondary);
        }
        .rss-content p {
          margin-bottom: 0.75rem;
        }
        .rss-content a {
          color: #3b82f6;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .rss-content img {
          border-radius: 0.5rem;
          margin: 1rem 0;
          max-width: 100%;
          height: auto;
        }
        .rss-content blockquote {
          border-left: 2px solid rgba(59, 130, 246, 0.5);
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: var(--premium-text-tertiary);
        }
      `}</style>

      {/* Header Info */}
      <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--premium-blue)' }}>
            {item.feed_title && <span className="truncate max-w-[150px]">{item.feed_title}</span>}
            {item.feed_title && item.published_at && <span className="opacity-30">•</span>}
            {item.published_at && (
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="h-2.5 w-2.5" />
                {format(new Date(item.published_at), 'MMM d')}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSave()
            }}
            className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-300"
            title="Save to Read Later"
          >
            <BookmarkPlus className="h-4 w-4" />
          </button>
          {onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              className="p-2 rounded-xl hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-all duration-300"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold leading-tight hover:text-blue-400 transition-colors mb-3" style={{ color: 'var(--premium-text-primary)' }}>
        {item.title}
      </h3>

      {/* Description Content */}
      {sanitizedDescription && (
        <div className="relative">
          <div
            className={`rss-content overflow-hidden transition-all duration-500 ${!showFullDescription && hasLongDescription ? 'max-h-32' : 'max-h-[1000px]'}`}
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />

          {!showFullDescription && hasLongDescription && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#121214] to-transparent flex items-end justify-center pb-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFullDescription(true)
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors py-1 px-4 mb-1"
              >
                Show More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer / Link */}
      <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-bold text-zinc-500 hover:text-blue-400 flex items-center gap-1 transition-colors uppercase tracking-wider"
          onClick={(e) => e.stopPropagation()}
        >
          View Original <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
