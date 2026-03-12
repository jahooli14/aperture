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
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
          li: ({ node, ...props }) => <li className="mb-0 leading-relaxed" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
