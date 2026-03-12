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

  const top = collisions[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="attention-card p-4 cursor-pointer transition-all"
      style={{ borderColor: 'var(--brand-primary)' }}
      onClick={() => navigate('/insights')}
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-brand-primary" />
        <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">Unexpected collision</span>
      </div>
      <p className="text-sm text-brand-text-primary leading-relaxed">
        Your {top.source_type} <span className="text-brand-primary font-medium">"{top.source_title}"</span>
        {' '}collided with {top.target_type} <span className="text-brand-primary font-medium">"{top.target_title}"</span>
      </p>
      {top.ai_reasoning && (
        <p className="text-xs text-[var(--brand-text-secondary)] mt-1.5">{top.ai_reasoning}</p>
      )}
      <div className="flex items-center gap-1 mt-2 text-brand-primary text-xs">
        <span>Explore</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  )
}
