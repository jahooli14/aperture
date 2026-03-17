import ReactMarkdown from 'react-markdown'
import { cn } from '../../lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Premium Markdown Renderer
 * Standardizes bullet points and typography across the app
 */
export function MarkdownRenderer({ content, className, style }: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-renderer prose prose-invert prose-sm max-w-none", className)} style={style}>
      <ReactMarkdown 
        components={{
          // Override default styling for list items to ensure proper hanging indents
          ul: ({ node, ...props }) => <ul className="list-outside pl-6 mb-4 space-y-2 marker:text-brand-primary" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-2 marker:text-brand-primary" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1 leading-relaxed pl-1" {...props} />,
          p: ({ node, ...props }) => {
            // Handle unicode bullets (• or ·) — children may be string or array
            const children = props.children
            const first = Array.isArray(children) ? children[0] : children
            const text = typeof first === 'string' ? first : null
            if (text && (text.startsWith('•') || text.startsWith('·'))) {
              const rest = text.replace(/^[•·]\s*/, '')
              return (
                <p className="mb-2 last:mb-0 leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 select-none" style={{ color: 'var(--brand-primary)' }}>•</span>
                  <span>{rest}{Array.isArray(children) ? children.slice(1) : null}</span>
                </p>
              )
            }
            return <p className="mb-3 last:mb-0 leading-relaxed" {...props} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
