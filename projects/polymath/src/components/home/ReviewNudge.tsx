/**
 * ReviewNudge — points home at the weekly drawer digest.
 *
 * The actual review machinery (heat scoring, evolve proposals, the
 * digest itself) already runs on the Projects page via DrawerDigestSheet
 * + ForYouToday. This is just the missing link: home never told you it
 * existed. Self-contained (own seam + header + banner) so it can drop
 * into the stack and disappear completely when there's nothing unread —
 * same "invisible when empty" contract as EverythingElseMini/ForYouToday.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { api } from '../../lib/apiClient'

interface Evolution {
  project_id: string
  project_title: string
  mode: 'shrink' | 'merge' | 'split' | 'reframe' | 'snapshot' | 'handoff'
  title: string
  proposal: string
  evidence: string
}

interface Digest {
  id: string
  generated_at: string
  evolutions: Evolution[]
  status: 'unread' | 'read' | 'acted'
}

export function ReviewNudge() {
  const navigate = useNavigate()
  const [digest, setDigest] = useState<Digest | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = (await api.get('projects?resource=digest')) as { digest: Digest | null } | null
        if (cancelled) return
        if (res?.digest && Array.isArray(res.digest.evolutions) && res.digest.evolutions.length > 0) {
          setDigest(res.digest)
        }
      } catch {
        // Silent failure — this nudge never interrupts the user.
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!digest) return null

  const count = digest.evolutions.length
  const first = digest.evolutions[0]

  return (
    <>
      <div className="section-seam" aria-hidden />
      <h2 className="section-header" style={{ margin: '0 0 10px' }}>worth a <span>look</span></h2>
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        onClick={() => navigate('/projects')}
        className="w-full p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all hover:scale-[1.005]"
        style={{
          background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.08), rgba(var(--brand-primary-rgb),0.04))',
          borderColor: 'rgba(var(--brand-primary-rgb),0.25)',
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
            {count} project{count === 1 ? '' : 's'} waiting on you
          </p>
          <p className="text-xs text-[var(--brand-text-primary)] leading-snug mt-1">
            Starts with {first.project_title} — {first.proposal}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--brand-text-muted)' }} />
      </motion.button>
    </>
  )
}
