/**
 * Project Activity Stream Component
 * Displays chronological list of project notes and updates
 */

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Mic, FileText, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

interface ProjectNote {
  id: string
  bullets: string[]
  created_at: string
  note_type?: 'voice' | 'text'
}

interface ProjectActivityStreamProps {
  notes: ProjectNote[]
  onRefresh: () => void
}

export function ProjectActivityStream({ notes, onRefresh }: ProjectActivityStreamProps) {
  const [filter, setFilter] = useState<'all' | 'voice' | 'text'>('all')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  const toggleExpanded = (noteId: string) => {
    const newExpanded = new Set(expandedNotes)
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId)
    } else {
      newExpanded.add(noteId)
    }
    setExpandedNotes(newExpanded)
  }

  const filteredNotes = notes.filter((note) => {
    if (filter === 'all') return true
    return note.note_type === filter
  })

  return (
    <Card className="border-neutral-200">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">Recent Updates</h2>
          <button
            onClick={onRefresh}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-neutral-600" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {[
            { key: 'all' as const, label: 'All', count: notes.length },
            { key: 'voice' as const, label: 'Voice', count: notes.filter(n => n.note_type === 'voice').length },
            { key: 'text' as const, label: 'Text', count: notes.filter(n => n.note_type === 'text').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === tab.key
                  ? 'bg-blue-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {tab.label}
              <span className={`text-xs ${filter === tab.key ? 'opacity-75' : 'opacity-50'}`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        {/* Notes List */}
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center mb-3">
              <FileText className="h-12 w-12 text-neutral-300" />
            </div>
            <h3 className="text-base font-semibold text-neutral-700 mb-1">
              No updates yet
            </h3>
            <p className="text-sm text-neutral-500">
              Get started by adding your first note
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => {
              const isExpanded = expandedNotes.has(note.id)
              const showPreview = note.bullets.length > 0

              return (
                <div
                  key={note.id}
                  className="group relative bg-neutral-50 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        note.note_type === 'voice'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {note.note_type === 'voice' ? (
                          <Mic className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-neutral-900">
                            You added {note.note_type === 'voice' ? 'a voice note' : 'a note'}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    {showPreview && (
                      <div className="ml-11">
                        {isExpanded ? (
                          <ul className="space-y-1.5 text-sm text-neutral-700">
                            {note.bullets.map((bullet, index) => (
                              <li key={index} className="flex gap-2">
                                <span className="text-neutral-400 flex-shrink-0">•</span>
                                <span className="leading-relaxed">{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-neutral-600 line-clamp-2 leading-relaxed">
                            {note.bullets[0]}
                          </p>
                        )}

                        {note.bullets.length > 1 && (
                          <button
                            onClick={() => toggleExpanded(note.id)}
                            className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-900 hover:text-blue-700 transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                Show {note.bullets.length - 1} more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
