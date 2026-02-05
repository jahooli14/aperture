import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Tag as TagIcon, ChevronRight } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { WordTag } from '../types/manuscript'

interface TagGroup {
  tag: string
  instances: Array<{
    wordTag: WordTag
    sceneTitle: string
    sceneSection: string
  }>
}

export default function TagOverview() {
  const navigate = useNavigate()
  const { manuscript } = useManuscriptStore()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const tagColors: Record<string, string> = {
    glasses: 'bg-blue-500/20 border-blue-500/40 text-blue-600',
    door: 'bg-purple-500/20 border-purple-500/40 text-purple-600',
    drift: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-600',
    postman: 'bg-green-500/20 border-green-500/40 text-green-600',
    villager: 'bg-orange-500/20 border-orange-500/40 text-orange-600',
    identity: 'bg-pink-500/20 border-pink-500/40 text-pink-600',
    recovery: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600',
    threshold: 'bg-red-500/20 border-red-500/40 text-red-600',
    mask: 'bg-violet-500/20 border-violet-500/40 text-violet-600',
    anchor: 'bg-amber-500/20 border-amber-500/40 text-amber-600',
  }

  const getTagColor = (tag: string) => {
    return tagColors[tag] || 'bg-gray-500/20 border-gray-500/40 text-gray-600'
  }

  // Group all word tags by tag name
  const tagGroups = useMemo(() => {
    if (!manuscript) return []

    const groups = new Map<string, TagGroup>()

    manuscript.scenes.forEach(scene => {
      scene.wordTags?.forEach(wordTag => {
        if (!groups.has(wordTag.tag)) {
          groups.set(wordTag.tag, {
            tag: wordTag.tag,
            instances: []
          })
        }

        groups.get(wordTag.tag)!.instances.push({
          wordTag,
          sceneTitle: scene.title,
          sceneSection: scene.section
        })
      })
    })

    // Sort by tag name
    return Array.from(groups.values()).sort((a, b) => a.tag.localeCompare(b.tag))
  }, [manuscript])

  if (!manuscript) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ink-950">
        <div className="w-6 h-6 border-2 border-ink-600 border-t-ink-300 rounded-full animate-spin" />
      </div>
    )
  }

  const totalTags = tagGroups.reduce((sum, group) => sum + group.instances.length, 0)
  const selectedGroup = selectedTag ? tagGroups.find(g => g.tag === selectedTag) : null

  return (
    <div className="flex-1 flex flex-col bg-ink-950 text-ink-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-ink-800">
        <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-ink-50">Tag Overview</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {totalTags} tagged words across {manuscript.scenes.length} scenes
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tagGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
            <TagIcon className="w-12 h-12 text-ink-700 mb-3" />
            <h2 className="text-lg font-medium text-ink-300 mb-1">No Tags Yet</h2>
            <p className="text-sm text-ink-500 max-w-sm">
              Start tagging words in your scenes to track motifs and themes throughout your manuscript.
            </p>
          </div>
        ) : selectedGroup ? (
          // Detail view for selected tag
          <div className="p-4">
            <button
              onClick={() => setSelectedTag(null)}
              className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-200 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all tags
            </button>

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 mb-6 ${getTagColor(selectedGroup.tag)}`}>
              <TagIcon className="w-5 h-5" />
              <span className="font-semibold capitalize text-lg">{selectedGroup.tag}</span>
              <span className="text-sm opacity-70">({selectedGroup.instances.length} instances)</span>
            </div>

            <div className="space-y-3">
              {selectedGroup.instances.map((instance) => (
                <button
                  key={instance.wordTag.id}
                  onClick={() => navigate(`/edit/${instance.wordTag.sceneId}`)}
                  className="w-full text-left p-4 bg-ink-900/50 hover:bg-ink-800/50 border border-ink-800 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-300 mb-1">
                        {instance.sceneTitle}
                      </div>
                      <div className="text-xs text-ink-500 mb-2">
                        Section: <span className="capitalize">{instance.sceneSection}</span>
                      </div>
                      <div className="text-base text-ink-100 italic">
                        "{instance.wordTag.text}"
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-ink-600 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // List view of all tags
          <div className="p-4 space-y-3">
            {tagGroups.map(group => (
              <button
                key={group.tag}
                onClick={() => setSelectedTag(group.tag)}
                className="w-full text-left p-4 bg-ink-900/50 hover:bg-ink-800/50 border border-ink-800 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`px-3 py-1.5 rounded-md border ${getTagColor(group.tag)}`}>
                      <span className="font-medium capitalize">{group.tag}</span>
                    </div>
                    <div className="text-sm text-ink-400">
                      {group.instances.length} instance{group.instances.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink-600 flex-shrink-0" />
                </div>

                {/* Preview of first few instances */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.instances.slice(0, 3).map((instance) => (
                    <span
                      key={instance.wordTag.id}
                      className="text-xs text-ink-500 italic"
                    >
                      "{instance.wordTag.text.slice(0, 30)}{instance.wordTag.text.length > 30 ? '...' : ''}"
                    </span>
                  ))}
                  {group.instances.length > 3 && (
                    <span className="text-xs text-ink-600">
                      +{group.instances.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
