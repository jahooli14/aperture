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
  const [expanded, setExpanded] = useState(false)

  const sanitizedDescription = useMemo(() => {
    if (!item.description) return ''
    return DOMPurify.sanitize(item.description, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'i', 'b', 'ul', 'ol', 'li', 'a', 'img', 'blockquote'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    })
  }, [item.description])

  return (
    <div
      className="group block rounded-lg transition-all duration-200 break-inside-avoid cursor-pointer relative mb-2 overflow-hidden"
      onClick={() => setExpanded(!expanded)}
      style={{
        background: expanded ? '#111113' : 'transparent',
        border: expanded ? '2px solid rgba(59,130,246,0.4)' : '2px solid var(--glass-surface-hover)',
        boxShadow: expanded ? '3px 3px 0 rgba(59,130,246,0.1)' : '3px 3px 0 rgba(0,0,0,0.6)',
      }}
    >
      <style>{`
        .rss-content {
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--brand-text-secondary);
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
          color: var(--brand-text-muted);
        }
      `}</style>

      {/* Main Row: Header + Title + Actions */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Feed Info & Title Container */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-primary)" }}>
              {item.feed_title && <span className="truncate max-w-[150px]">{item.feed_title}</span>}
              {item.feed_title && item.published_at && <span className="opacity-30"></span>}
              {item.published_at && (
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="h-2.5 w-2.5" />
                  {format(new Date(item.published_at), 'MMM d')}
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold leading-snug group-hover:text-brand-primary transition-colors" style={{ color: "var(--brand-primary)" }}>
              {item.title}
            </h3>
          </div>

          {/* Action Buttons (Always Visible) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSave()
              }}
              className="p-1.5 rounded-lg text-brand-primary transition-all duration-200"
              style={{ background: 'rgba(59,130,246,0.12)', border: '1.5px solid rgba(59,130,246,0.3)', boxShadow: '2px 2px 0 rgba(0,0,0,0.5)' }}
              title="Save to Read Later"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
            </button>
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDismiss()
                }}
                className="p-1.5 rounded-lg transition-all duration-200"
                style={{ color: "var(--brand-primary)" }}
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <div className={`grid transition-all duration-300 ease-out px-3 ${expanded ? 'grid-rows-[1fr] pb-3 opacity-100' : 'grid-rows-[0fr] pb-0 opacity-0'}`}>
        <div className="overflow-hidden">
          {/* Action to Open */}
          <div className="flex gap-2 mb-3 mt-1">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onRead()
              }}
              className="w-full bg-brand-primary hover:bg-brand-primary text-[var(--brand-text-primary)] h-8 text-xs"
            >
              Read Article
            </Button>
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                window.open(item.link, '_blank')
              }}
              className="bg-transparent border-[var(--glass-surface-hover)] text-brand-text-muted hover:text-[var(--brand-text-primary)] h-8 text-xs px-3"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Description Preview */}
          {sanitizedDescription && (
            <div
              className="rss-content text-xs opacity-80 max-h-48 overflow-y-auto pr-2 custom-scrollbar"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
              onClick={(e) => e.stopPropagation()} // Allow selecting text
            />
          )}
        </div>
      </div>
    </div>
  )
}
