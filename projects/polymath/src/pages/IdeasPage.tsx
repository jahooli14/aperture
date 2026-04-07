import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../contexts/AuthContext'

interface Idea {
  id: string
  title: string
  description: string
  reasoning: string | null
  domain_pair: [string, string]
  frontier_mode: string
  status: 'pending' | 'approved' | 'spark' | 'rejected'
  prefilter_score: number | null
  novelty_score: number | null
  cross_domain_distance: number | null
  tractability_score: number | null
  opus_verdict: string | null
  rejection_reason: string | null
  rejection_category: string | null
  created_at: string
}

type FilterStatus = 'all' | 'approved' | 'spark' | 'pending' | 'rejected'

export function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('approved')
  const { user } = useAuthContext()

  useEffect(() => {
    if (user) loadIdeas()
  }, [filter, user])

  async function loadIdeas() {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from('ie_ideas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading ideas:', error)
    } else {
      setIdeas((data as Idea[]) || [])
    }

    setLoading(false)
  }

  const statusColors: Record<string, string> = {
    approved: 'bg-emerald-500/15 text-emerald-400',
    spark: 'bg-amber-500/15 text-amber-400',
    pending: 'bg-blue-500/15 text-blue-400',
    rejected: 'bg-red-500/15 text-red-400',
  }

  const filters: FilterStatus[] = ['all', 'approved', 'spark', 'pending', 'rejected']

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>
            Idea Engine
          </h1>
          <p style={{ color: 'var(--brand-text-secondary)' }}>
            Autonomous frontier exploration across knowledge domains
          </p>
        </div>

        <div className="mb-6 flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
                filter === f
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'premium-card hover:opacity-80'
              }`}
              style={filter !== f ? { color: 'var(--brand-text-secondary)' } : undefined}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--brand-text-secondary)' }}>
            Loading ideas...
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--brand-text-secondary)' }}>
            No {filter !== 'all' ? filter : ''} ideas yet.
          </div>
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <div key={idea.id} className="premium-card p-6">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-lg font-semibold flex-1" style={{ color: 'var(--brand-text)' }}>
                    {idea.title}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ml-3 ${statusColors[idea.status] || ''}`}>
                    {idea.status}
                  </span>
                </div>

                <div className="flex gap-4 text-xs mb-4" style={{ color: 'var(--brand-text-secondary)' }}>
                  <span>{idea.domain_pair.join(' × ')}</span>
                  <span>{idea.frontier_mode}</span>
                  {idea.prefilter_score != null && (
                    <span>Score: {(idea.prefilter_score * 100).toFixed(0)}%</span>
                  )}
                </div>

                <p className="text-sm mb-4" style={{ color: 'var(--brand-text-secondary)' }}>
                  {idea.description}
                </p>

                {idea.opus_verdict && (
                  <div className="rounded-lg p-3 mb-3 bg-blue-500/10">
                    <p className="text-sm text-blue-300">
                      <strong>Review:</strong> {idea.opus_verdict}
                    </p>
                  </div>
                )}

                {idea.status === 'rejected' && idea.rejection_reason && (
                  <div className="rounded-lg p-3 mb-3 bg-red-500/10">
                    <p className="text-sm text-red-300">
                      <strong>Rejected:</strong> {idea.rejection_reason}
                    </p>
                    {idea.rejection_category && (
                      <p className="text-xs text-red-400 mt-1">
                        Category: {idea.rejection_category}
                      </p>
                    )}
                  </div>
                )}

                {(idea.novelty_score != null || idea.cross_domain_distance != null || idea.tractability_score != null) && (
                  <div className="flex gap-6 text-xs pt-3 border-t border-white/10" style={{ color: 'var(--brand-text-secondary)' }}>
                    {idea.novelty_score != null && <span>Novelty: {idea.novelty_score.toFixed(2)}</span>}
                    {idea.cross_domain_distance != null && <span>Distance: {idea.cross_domain_distance.toFixed(2)}</span>}
                    {idea.tractability_score != null && <span>Tractability: {idea.tractability_score.toFixed(2)}</span>}
                  </div>
                )}

                <div className="mt-3 text-xs" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                  {new Date(idea.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default IdeasPage
