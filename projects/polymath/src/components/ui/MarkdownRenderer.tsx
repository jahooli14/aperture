import ReactMarkdown from 'react-markdown'
import { cn } from '../../lib/utils'
import '../../styles/rich-text.css'

interface MarkdownRendererProps {
  content: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Renders markdown with the same typography as the RichTextEditor, so what you
 * write looks identical to what gets rendered back. Layout (spacing, lists,
 * headings, quotes, code, images) is driven by `.markdown-renderer` in
 * rich-text.css; the overrides below only add behaviour (lazy images, safe
 * links, unicode-bullet handling).
 */
export function MarkdownRenderer({ content, className, style }: MarkdownRendererProps) {
  return (
    <div className={cn('markdown-renderer max-w-none', className)} style={style}>
      <ReactMarkdown
        components={{
          img: ({ node, ...props }) => <img {...props} loading="lazy" />,
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          p: ({ node, ...props }) => {
            // Handle unicode bullets (• or ·) — children may be string or array
            const children = props.children
            const first = Array.isArray(children) ? children[0] : children
            const text = typeof first === 'string' ? first : null
            if (text && (text.startsWith('•') || text.startsWith('·'))) {
              const rest = text.replace(/^[•·]\s*/, '')
              return (
                <p className="flex items-start gap-2">
                  <span className="shrink-0 select-none" style={{ color: 'var(--brand-primary)' }}>•</span>
                  <span>{rest}{Array.isArray(children) ? children.slice(1) : null}</span>
                </p>
              )
            }
            return <p {...props} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
