import { useState } from 'react'
import { api } from '../lib/api'
import { Avatar } from './Avatar'
import type { Member, Story } from '../lib/types'

export function InviteSheet({
  story,
  members,
  isOwner,
  onClose,
}: {
  story: Story
  members: Member[]
  isOwner: boolean
  onClose: () => void
}) {
  const [invite, setInvite] = useState<{ code: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const spaces = story.max_members - members.length
  const link = invite ? `${window.location.origin}/join/${invite.code}` : ''

  async function mint() {
    setBusy(true)
    setError(null)
    try {
      const { invite: created } = await api.createInvite(story.id)
      setInvite(created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make an invite')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    const text = `Write a story with me: ${link}`
    if (navigator.share) {
      await navigator.share({ title: story.title, text, url: link }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center">
      <div className="sheet w-full max-w-reading overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="display text-xl font-semibold">Writers</h2>
            <p className="text-sm text-muted">
              {members.length} of {story.max_members}
            </p>
          </div>
          <button className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>

        <ul className="mb-5 space-y-2">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center gap-2.5 text-sm">
              <Avatar name={member.display_name} turnOrder={member.turn_order} size={26} />
              <span className="flex-1">{member.display_name}</span>
              {member.role === 'owner' && <span className="text-xs text-muted">started it</span>}
            </li>
          ))}
        </ul>

        {!isOwner ? (
          <p className="text-sm text-muted">Ask whoever started it to send an invite.</p>
        ) : spaces <= 0 ? (
          <p className="text-sm text-muted">This story is full.</p>
        ) : invite ? (
          <div>
            <p className="label">Invite code</p>
            <p className="mb-3 text-center font-mono text-2xl tracking-[0.3em]">{invite.code}</p>
            <button className="btn-primary w-full" onClick={share}>
              {copied ? 'Link copied' : 'Share the link'}
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              One use, valid for two weeks.
            </p>
          </div>
        ) : (
          <button className="btn-primary w-full" onClick={mint} disabled={busy}>
            {busy ? 'Making one…' : 'Invite someone'}
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      </div>
    </div>
  )
}
