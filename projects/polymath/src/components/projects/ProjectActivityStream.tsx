/**
 * Project Activity Stream Component
 * Clean timeline feed of project notes and updates
 */

import { formatDistanceToNow } from 'date-fns'
import { Mic, FileText } from 'lucide-react'
import { MarkdownRenderer } from '../ui/MarkdownRenderer'

interface ProjectNote {
  id: string
  bullets: string[]
  created_at: string
  note_type?: 'voice' | 'text'
  image_urls?: string[]
}

interface ProjectActivityStreamProps {
  notes: ProjectNote[]
  onRefresh: () => void
}

export function ProjectActivityStream({ notes }: ProjectActivityStreamProps) {
  if (notes.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium uppercase tracking-widest opacity-30" style={{ color: 'var(--brand-primary)' }}>
          No updates yet
        </p>
        <p className="text-xs mt-1 opacity-20" style={{ color: 'var(--brand-text-secondary)' }}>
          Tap "Add Update" to log progress
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline spine */}
      <div
        className="absolute left-[7px] top-2 bottom-2 w-px"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      />

      <div className="space-y-6">
        {notes.map((note) => {
          const content = note.bullets.join('\n')

          return (
            <div key={note.id} className="relative flex gap-4 pl-6">
              {/* Timeline dot */}
              <div
                className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: note.note_type === 'voice' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
                  border: note.note_type === 'voice' ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {note.note_type === 'voice'
                  ? <Mic className="w-2 h-2" style={{ color: '#60a5fa' }} />
                  : <FileText className="w-2 h-2" style={{ color: 'rgba(255,255,255,0.3)' }} />
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>

                <MarkdownRenderer
                  content={content}
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--brand-primary)' }}
                />

                {/* Images */}
                {note.image_urls && note.image_urls.length > 0 && (
                  <div className={`mt-3 grid gap-2 ${note.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {note.image_urls.map((url, i) => (
                      <div
                        key={url}
                        className="rounded-xl overflow-hidden cursor-pointer"
                        style={{
                          aspectRatio: note.image_urls!.length === 1 ? '16/9' : '1/1',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                        }}
                        onClick={() => window.open(url, '_blank')}
                      >
                        <img
                          src={url}
                          alt={`Attachment ${i + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
