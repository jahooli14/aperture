import { authorColour, gapLabel, timeAgo } from '../lib/format'
import type { IndexEntry, Line, Member } from '../lib/types'

export type ViewMode = 'thread' | 'read'

/**
 * Two views of the same thing.
 *
 * `thread` is the manuscript: turns alternate sides with a rule and a faint
 * wash in the writer's colour, so the exchange reads at a glance without
 * anyone's name being read. `read` drops all of that and lets it run as prose.
 *
 * Long silences are named where they happen. A story written over months has
 * gaps in it, and they belong to it.
 */
export function LineList({
  lines,
  members,
  mode,
  currentUserId,
  landedOn,
  highlight,
  indexNames,
  onMark,
  onEdit,
  onOpenName,
}: {
  lines: Line[]
  members: Member[]
  mode: ViewMode
  currentUserId: string
  landedOn?: number | null
  /** Search term, marked in the text where it appears. */
  highlight?: string
  /** Names the index knows about, made tappable in the prose. */
  indexNames?: IndexEntry[]
  onMark?: (line: Line) => void
  onEdit?: (line: Line) => void
  onOpenName?: (entry: IndexEntry) => void
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
        const onSecondSide = turnOrder % 2 === 1

        const previous = lines[index - 1]
        const opensRun = !previous || previous.author_id !== line.author_id || Boolean(line.chapter_title)
        const gap = previous ? gapLabel(previous.created_at, line.created_at) : null

        return (
          <li key={line.id}>
            {gap && !line.chapter_title && (
              <div className="gap-marker">
                <span className="gap-rule" />
                <span className="gap-label">{gap}</span>
                <span className="gap-rule" />
              </div>
            )}

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
                      {line.edited_at ? ' · edited' : ''}
                    </span>
                  </div>
                )}
                <div className="prose-story">
                  <p>
                    <LineBody
                      body={line.body}
                      highlight={highlight}
                      indexNames={indexNames}
                      onOpenName={onOpenName}
                    />
                  </p>
                </div>
                {!line.pending && (
                  <LineActions line={line} mine={mine} onMark={onMark} onEdit={onEdit} />
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const EDIT_WINDOW_MS = 5 * 60_000

function LineActions({
  line,
  mine,
  onMark,
  onEdit,
}: {
  line: Line
  mine: boolean
  onMark?: (line: Line) => void
  onEdit?: (line: Line) => void
}) {
  const editable = mine && Date.now() - Date.parse(line.created_at) < EDIT_WINDOW_MS
  const marks = line.marks ?? 0
  if (!onMark && !editable) return null

  return (
    <div className="mt-1 flex items-center gap-3">
      {onMark && !mine && (
        <button
          onClick={() => onMark(line)}
          className="line-mark"
          aria-pressed={Boolean(line.marked_by_me)}
          aria-label={line.marked_by_me ? 'Unmark this line' : 'Mark this line as a good one'}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path
              d="M12 4l2.2 5.3 5.8.5-4.4 3.8 1.3 5.6L12 16.3 7.1 19.2l1.3-5.6L4 9.8l5.8-.5z"
              fill={line.marked_by_me ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          {marks > 0 && <span className="tabular-nums">{marks}</span>}
        </button>
      )}
      {onMark && mine && marks > 0 && (
        <span className="line-mark is-static" aria-label={`${marks} mark${marks === 1 ? '' : 's'}`}>
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path
              d="M12 4l2.2 5.3 5.8.5-4.4 3.8 1.3 5.6L12 16.3 7.1 19.2l1.3-5.6L4 9.8l5.8-.5z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span className="tabular-nums">{marks}</span>
        </span>
      )}
      {editable && onEdit && (
        <button onClick={() => onEdit(line)} className="line-mark">
          Edit
        </button>
      )}
    </div>
  )
}

/**
 * The prose itself, with search hits marked and names the index knows made
 * tappable. Both are done by splitting the text, never by injecting HTML.
 */
function LineBody({
  body,
  highlight,
  indexNames,
  onOpenName,
}: {
  body: string
  highlight?: string
  indexNames?: IndexEntry[]
  onOpenName?: (entry: IndexEntry) => void
}) {
  const needle = highlight?.trim()
  if (needle && needle.length >= 2) {
    return <>{splitOn(body, needle).map((part, i) =>
      part.hit ? <mark key={i} className="search-hit">{part.text}</mark> : <span key={i}>{part.text}</span>
    )}</>
  }

  if (indexNames && indexNames.length > 0 && onOpenName) {
    const entry = indexNames.find((candidate) => splitOn(body, candidate.name).some((p) => p.hit))
    if (entry) {
      return <>{splitOn(body, entry.name).map((part, i) =>
        part.hit ? (
          <button key={i} className="named" onClick={() => onOpenName(entry)}>
            {part.text}
          </button>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}</>
    }
  }

  return <>{body}</>
}

/** Case-insensitive split around every occurrence of `needle`. */
function splitOn(body: string, needle: string): { text: string; hit: boolean }[] {
  const lower = body.toLowerCase()
  const target = needle.toLowerCase()
  if (!target) return [{ text: body, hit: false }]

  const parts: { text: string; hit: boolean }[] = []
  let cursor = 0
  let at = lower.indexOf(target)
  while (at !== -1) {
    if (at > cursor) parts.push({ text: body.slice(cursor, at), hit: false })
    parts.push({ text: body.slice(at, at + target.length), hit: true })
    cursor = at + target.length
    at = lower.indexOf(target, cursor)
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor), hit: false })
  return parts
}
