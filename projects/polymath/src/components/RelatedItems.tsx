/**
 * Related Items Component
 * Shows contextual connections from the knowledge graph
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Layers, FolderKanban, FileText, Sparkles } from 'lucide-react'
import { Card, CardContent } from './ui/card'

interface RelatedItem {
  id: string
  type: 'thought' | 'project' | 'article'
  title: string
  snippet?: string
  url?: string
  relevance?: number
}

interface RelatedItemsProps {
  sourceId: string
  sourceType: 'thought' | 'project' | 'article'
  sourceText?: string
  limit?: number
}

export function RelatedItems({ sourceId, sourceType, sourceText, limit = 5 }: RelatedItemsProps) {
  const [items, setItems] = useState<RelatedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRelatedItems()
  }, [sourceId])

  const loadRelatedItems = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/connections?action=find-related&id=${sourceId}&type=${sourceType}`)
      const data = await response.json()

      if (data.related) {
        setItems(data.related.slice(0, limit))
      }
    } catch (error) {
      console.error('[RelatedItems] Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="pro-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-blue-900" />
            <h3 className="font-semibold text-neutral-900">Related</h3>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-neutral-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <Card className="pro-card">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-blue-900" />
          <h3 className="font-semibold text-neutral-900">Related</h3>
          <span className="text-xs text-neutral-500">({items.length})</span>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <RelatedItemCard key={item.id} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RelatedItemCard({ item }: { item: RelatedItem }) {
  const Icon = item.type === 'thought' ? Layers : item.type === 'project' ? FolderKanban : FileText

  const getLink = () => {
    if (item.type === 'thought') return `/memories`
    if (item.type === 'project') return `/projects/${item.id}`
    if (item.type === 'article') return `/reading/${item.id}`
    return '#'
  }

  const Content = (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all group">
      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
        <Icon className="h-4 w-4 text-blue-900" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm text-neutral-900 truncate">
            {item.title}
          </h4>
          {item.type === 'article' && item.url && (
            <ExternalLink className="h-3 w-3 text-neutral-400 flex-shrink-0" />
          )}
        </div>

        {item.snippet && (
          <p className="text-xs text-neutral-600 line-clamp-2 mt-1">
            {item.snippet}
          </p>
        )}

        {item.relevance && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 bg-neutral-200 rounded-full overflow-hidden max-w-[100px]">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-900"
                style={{ width: `${item.relevance * 100}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500">{Math.round(item.relevance * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  )

  if (item.type === 'article' && item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        {Content}
      </a>
    )
  }

  return (
    <Link to={getLink()}>
      {Content}
    </Link>
  )
}
