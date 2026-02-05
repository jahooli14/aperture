import { useMemo } from 'react'
import type { WordTag } from '../types/manuscript'

interface TaggedProseViewProps {
  prose: string
  wordTags: WordTag[]
  onTagClick: (tag: WordTag) => void
  activeFilters?: string[]
}

const TAG_COLORS: Record<string, string> = {
  glasses: 'bg-blue-400/30 border-b-2 border-blue-500 text-blue-100',
  door: 'bg-purple-400/30 border-b-2 border-purple-500 text-purple-100',
  drift: 'bg-cyan-400/30 border-b-2 border-cyan-500 text-cyan-100',
  postman: 'bg-green-400/30 border-b-2 border-green-500 text-green-100',
  villager: 'bg-orange-400/30 border-b-2 border-orange-500 text-orange-100',
  identity: 'bg-pink-400/30 border-b-2 border-pink-500 text-pink-100',
  recovery: 'bg-emerald-400/30 border-b-2 border-emerald-500 text-emerald-100',
  threshold: 'bg-red-400/30 border-b-2 border-red-500 text-red-100',
  mask: 'bg-violet-400/30 border-b-2 border-violet-500 text-violet-100',
  anchor: 'bg-amber-400/30 border-b-2 border-amber-500 text-amber-100',
}

export function TaggedProseView({ prose, wordTags, onTagClick, activeFilters = [] }: TaggedProseViewProps) {
  const segments = useMemo(() => {
    if (!wordTags.length) {
      return [{ text: prose, tag: null, wordTag: null }]
    }

    // Sort tags by start position
    const sortedTags = [...wordTags].sort((a, b) => a.start - b.start)

    // Filter tags if activeFilters is set
    const filteredTags = activeFilters.length > 0
      ? sortedTags.filter(tag => activeFilters.includes(tag.tag))
      : sortedTags

    const result: Array<{ text: string; tag: string | null; wordTag: WordTag | null }> = []
    let lastIndex = 0

    filteredTags.forEach(wordTag => {
      // Add untagged text before this tag
      if (wordTag.start > lastIndex) {
        result.push({
          text: prose.slice(lastIndex, wordTag.start),
          tag: null,
          wordTag: null
        })
      }

      // Add tagged text
      result.push({
        text: prose.slice(wordTag.start, wordTag.end),
        tag: wordTag.tag,
        wordTag
      })

      lastIndex = wordTag.end
    })

    // Add remaining untagged text
    if (lastIndex < prose.length) {
      result.push({
        text: prose.slice(lastIndex),
        tag: null,
        wordTag: null
      })
    }

    return result
  }, [prose, wordTags, activeFilters])

  return (
    <div className="prose-container max-w-none">
      {segments.map((segment, index) => {
        // Split by paragraph breaks
        const paragraphs = segment.text.split(/\n\n+/)

        return paragraphs.map((paragraph, pIndex) => {
          if (!paragraph.trim()) return null

          const lines = paragraph.split('\n')
          const key = `${index}-${pIndex}`

          return (
            <p
              key={key}
              className="text-ink-100 text-base leading-relaxed mb-4 first:mt-0"
              style={{ textIndent: pIndex > 0 || index > 0 ? '2em' : '0' }}
            >
              {lines.map((line, lIndex) => (
                <span key={`${key}-${lIndex}`}>
                  {segment.tag ? (
                    <mark
                      className={`${TAG_COLORS[segment.tag] || 'bg-gray-400/30 border-b-2 border-gray-500'} cursor-pointer rounded-sm px-0.5 -mx-0.5 active:scale-95 transition-transform`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (segment.wordTag) {
                          onTagClick(segment.wordTag)
                        }
                      }}
                    >
                      {line}
                    </mark>
                  ) : (
                    line
                  )}
                  {lIndex < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          )
        })
      })}
    </div>
  )
}
