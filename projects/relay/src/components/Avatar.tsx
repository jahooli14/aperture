import { authorColour, initials } from '../lib/format'

export function Avatar({
  name,
  turnOrder,
  size = 28,
  dim = false,
}: {
  name: string
  turnOrder: number
  size?: number
  dim?: boolean
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: authorColour(turnOrder),
        fontSize: Math.round(size * 0.4),
        opacity: dim ? 0.45 : 1,
      }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
