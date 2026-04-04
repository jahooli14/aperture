import { useState, useEffect } from 'react'
import { Zap, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

interface Collision {
  id: string
  source_title: string
  target_title: string
  source_type: string
  target_type: string
  similarity: number
  ai_reasoning: string
}

export function CollisionReport() {
  const [collisions, setCollisions] = useState<Collision[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/connections?action=weekly-collisions')
      .then(r => r.ok ? r.json() : { collisions: [] })
      .then(d => setCollisions(d.collisions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || collisions.length === 0) return null

  const shown = collisions.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-brand-primary" />
        <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">
          {shown.length === 1 ? 'Unexpected collision' : `${shown.length} collisions`}
        </span>
      </div>
      {shown.map((c) => (
        <div
          key={c.id}
          className="attention-card p-3 cursor-pointer transition-all"
          style={{ borderColor: 'var(--brand-primary)' }}
          onClick={() => navigate('/insights')}
        >
          <p className="text-sm text-brand-text-primary leading-relaxed">
            Your {c.source_type} <span className="text-brand-primary font-medium">"{c.source_title}"</span>
            {' '}collided with {c.target_type} <span className="text-brand-primary font-medium">"{c.target_title}"</span>
          </p>
          {c.ai_reasoning && (
            <p className="text-xs text-[var(--brand-text-secondary)] mt-1 line-clamp-1">{c.ai_reasoning}</p>
          )}
        </div>
      ))}
      <div
        className="flex items-center gap-1 text-brand-primary text-xs cursor-pointer hover:opacity-80 pl-1"
        onClick={() => navigate('/insights')}
      >
        <span>Explore all</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  )
}
