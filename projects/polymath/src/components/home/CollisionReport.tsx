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
      className="p-4 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/5 cursor-pointer hover:border-purple-500/30 transition-all"
      onClick={() => navigate('/insights')}
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-medium text-purple-300 uppercase tracking-wider">Unexpected collision</span>
      </div>
      <p className="text-sm text-gray-200 leading-relaxed">
        Your {top.source_type} <span className="text-purple-300 font-medium">"{top.source_title}"</span>
        {' '}collided with {top.target_type} <span className="text-purple-300 font-medium">"{top.target_title}"</span>
      </p>
      {top.ai_reasoning && (
        <p className="text-xs text-gray-400 mt-1.5">{top.ai_reasoning}</p>
      )}
      <div className="flex items-center gap-1 mt-2 text-purple-400 text-xs">
        <span>Explore</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  )
}
