import { Avatar } from './Avatar'
import { authorColour, timeAgo } from '../lib/format'
import type { Line, Member } from '../lib/types'

/**
 * Two ways to look at the same thing.
 *
 * `thread` is who said what and when — the view you write in.
 * `read` drops all attribution and runs the lines together as prose. That's
 * the whole reason to leave a chat app: seeing the story rather than the chat.
 */
export type ViewMode = 'thread' | 'read'

export function LineList({
  lines,
  members,
  mode,
  currentUserId,
}: {
  lines: Line[]
  members: Member[]
  mode: ViewMode
  currentUserId: string
}) {
  const orderByUser = new Map(members.map((m) => [m.user_id, m.turn_order]))

  if (lines.length === 0) {
    return (
      <p className="px-1 py-10 text-center font-story text-muted">
        Nothing written yet. The first line is the hardest.
      </p>
    )
  }

  if (mode === 'read') {
    return (
      <div className="prose-story space-y-4 px-1 py-4">
        {lines.map((line) => (
          <div key={line.id} id={`line-${line.position}`}>
            {line.chapter_title && (
              <h2 className="pb-2 pt-6 text-center font-story text-xl">{line.chapter_title}</h2>
            )}
            <p>{line.body}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ol className="space-y-5 px-1 py-4">
      {lines.map((line) => {
        const turnOrder = orderByUser.get(line.author_id) ?? 0
        return (
          <li key={line.id} id={`line-${line.position}`}>
            {line.chapter_title && (
              <h2 className="mb-4 mt-8 border-y border-rule py-3 text-center font-story text-xl">
                {line.chapter_title}
              </h2>
            )}
            <div className="flex items-center gap-2 pb-1.5">
              <Avatar name={line.display_name} turnOrder={turnOrder} size={20} />
              <span className="text-xs font-medium">
                {line.author_id === currentUserId ? 'You' : line.display_name}
              </span>
              <span className="text-xs text-muted">{timeAgo(line.created_at)}</span>
            </div>
            <div
              className="prose-story border-l-2 pl-3.5"
              style={{ borderColor: authorColour(turnOrder) }}
            >
              <p>{line.body}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
