import { authorColour, timeAgo } from '../lib/format'
import type { Line, Member } from '../lib/types'

/**
 * Two views of the same thing.
 *
 * `thread` is the manuscript: every line numbered in the margin and tinted to
 * whoever wrote it. The numbers are what the index points at, and they make
 * the thing feel like a document rather than a chat.
 *
 * `read` drops all attribution and lets it run as prose. That is the reason
 * to leave a chat app.
 */
export type ViewMode = 'thread' | 'read'

export function LineList({
  lines,
  members,
  mode,
  currentUserId,
  landedOn,
}: {
  lines: Line[]
  members: Member[]
  mode: ViewMode
  currentUserId: string
  /** Line jumped to from the index — briefly marked so it can be found. */
  landedOn?: number | null
}) {
  const orderByUser = new Map(members.map((m) => [m.user_id, m.turn_order]))

  if (lines.length === 0) {
    return (
      <p className="prose-story py-16 text-center italic" style={{ color: 'rgb(var(--faint))' }}>
        Nothing written yet. The first line is the hardest.
      </p>
    )
  }

  if (mode === 'read') {
    // Paragraphs have to be siblings for the spacing and first-line indent to
    // apply, so lines are grouped into chapters and each chapter is one block
    // of prose rather than a stack of separately wrapped lines.
    const chapters: { title: string | null; lines: Line[] }[] = []
    for (const line of lines) {
      if (line.chapter_title || chapters.length === 0) {
        chapters.push({ title: line.chapter_title, lines: [line] })
      } else {
        chapters[chapters.length - 1].lines.push(line)
      }
    }

    return (
      <div className="py-6">
        {chapters.map((chapter, chapterIndex) => (
          <section key={chapter.lines[0].id}>
            {chapter.title && (
              <div className="chapter-open">
                <span className="chapter-rule" />
                <h2 className="chapter-name">{chapter.title}</h2>
                <span className="chapter-rule" />
              </div>
            )}
            <div className="prose-story reading">
              {chapter.lines.map((line, index) => (
                <p
                  key={line.id}
                  id={`line-${line.position}`}
                  className={index === 0 && (chapter.title || chapterIndex === 0) ? 'dropcap' : undefined}
                >
                  {line.body}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-4 py-5">
      {lines.map((line, index) => {
        const turnOrder = orderByUser.get(line.author_id) ?? 0
        const colour = authorColour(turnOrder)
        const mine = line.author_id === currentUserId

        // Whose turn this is decides which side of the page it sits on. Two
        // writers land on alternating sides, so the exchange is visible
        // before you've read a word.
        const onSecondSide = turnOrder % 2 === 1

        // In open mode the same person can go twice; don't repeat their name.
        const previous = lines[index - 1]
        const opensRun = !previous || previous.author_id !== line.author_id || Boolean(line.chapter_title)

        return (
          <li key={line.id}>
            {line.chapter_title && (
              <div className="chapter-open">
                <span className="chapter-rule" />
                <h2 className="chapter-name">{line.chapter_title}</h2>
                <span className="chapter-rule" />
              </div>
            )}

            <div
              id={`line-${line.position}`}
              className={`line-row${landedOn === line.position ? ' landed' : ''}`}
              style={line.pending ? { opacity: 0.55 } : undefined}
            >
              <span className="line-num" style={{ color: colour }}>
                {line.position}
              </span>
              <div
                className={`turn turn-tint${onSecondSide ? ' turn-b' : ''}`}
                style={{
                  borderColor: colour,
                  background: `color-mix(in srgb, ${colour} 6%, transparent)`,
                }}
              >
                {opensRun && (
                  <div className="flex items-baseline gap-2 pb-0.5 pt-0.5">
                    <span className="line-who" style={{ color: colour }}>
                      {mine ? 'You' : line.display_name}
                    </span>
                    <span className="text-[0.66rem] text-faint">
                      {line.pending ? 'Sending…' : timeAgo(line.created_at)}
                    </span>
                  </div>
                )}
                <div className="prose-story">
                  <p>{line.body}</p>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
