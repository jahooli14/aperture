/** One piece on a shelf: the photo, the link's artwork, or a plain tile for a recording. */

import { Link2, Music } from 'lucide-react'
import type { ProjectOutput } from '../../lib/projectOutputs'
import { pieceName } from '../../lib/projectOutputsOps'

export function MadeTile({ item, showNumber, onOpen }: { item: ProjectOutput; showNumber: boolean; onOpen: () => void }) {
  const art = item.kind === 'image' ? item.url : item.link_meta?.image
  const name = item.title || (item.kind !== 'image' ? pieceName(item) : '')
  return (
    <button onClick={onOpen} className="relative aspect-square rounded-xl overflow-hidden text-left" style={{ background: 'var(--glass-surface)' }} aria-label={pieceName(item)}>
      {art ? (
        <img src={art} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
          {item.kind === 'audio' ? <Music size={22} /> : <Link2 size={22} />}
        </span>
      )}
      {(name || showNumber) && (
        <span className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 text-[11px] leading-tight" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', color: '#fff' }}>
          {[showNumber && item.number ? `No. ${item.number}` : '', name].filter(Boolean).join(' · ')}
        </span>
      )}
    </button>
  )
}
