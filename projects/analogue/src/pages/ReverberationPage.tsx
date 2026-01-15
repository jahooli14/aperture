import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Quote, Link2, CheckCircle2, Circle, User } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'

export default function ReverberationPage() {
  const navigate = useNavigate()
  const { manuscript } = useManuscriptStore()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!manuscript) {
        navigate('/', { replace: true })
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [manuscript, navigate])

  if (!manuscript) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-ink-600 border-t-ink-300 rounded-full animate-spin" />
      </div>
    )
  }

  const { reverberationLibrary } = manuscript
  const linkedCount = reverberationLibrary.filter(r => r.linkedRevealSceneId).length
  const totalCount = reverberationLibrary.length

  // Group by speaker
  const byAl = reverberationLibrary.filter(r => r.speaker === 'al')
  const byLexi = reverberationLibrary.filter(r => r.speaker === 'lexi')
  const byVillager = reverberationLibrary.filter(r => r.speaker === 'villager')

  return (
    <div className="flex-1 flex flex-col bg-ink-950 pt-safe">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-ink-800">
        <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>
        <div>
          <h1 className="text-lg font-medium text-ink-100">Reverberation Library</h1>
          <p className="text-xs text-ink-500">Core wisdom for the Reveal</p>
        </div>
      </header>

      {/* Progress */}
      <div className="mx-4 mt-4 p-4 bg-ink-900 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-ink-300">Echo Progress</span>
          <span className="text-sm text-ink-100">
            {linkedCount} / {totalCount}
          </span>
        </div>
        <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: totalCount > 0 ? `${(linkedCount / totalCount) * 100}%` : 0 }}
            className="h-full bg-section-reveal rounded-full"
          />
        </div>
        <p className="text-xs text-ink-500 mt-2">
          Tag wisdom in scenes, then link them to the Reveal for symmetry validation.
        </p>
      </div>

      {/* Wisdom entries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-safe">
        {/* Al (Doctor) */}
        {byAl.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-section-departure" />
              <span className="text-sm font-medium text-ink-300">
                Al (Doctor)
              </span>
              <span className="text-xs text-ink-500">
                {byAl.length} entries
              </span>
            </div>
            <div className="space-y-2">
              {byAl.map(reverb => (
                <ReverbCard key={reverb.id} reverb={reverb} navigate={navigate} />
              ))}
            </div>
          </div>
        )}

        {/* Lexi (Villager persona) */}
        {byLexi.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-section-escape" />
              <span className="text-sm font-medium text-ink-300">
                Lexi (Villager)
              </span>
              <span className="text-xs text-ink-500">
                {byLexi.length} entries
              </span>
            </div>
            <div className="space-y-2">
              {byLexi.map(reverb => (
                <ReverbCard key={reverb.id} reverb={reverb} navigate={navigate} />
              ))}
            </div>
          </div>
        )}

        {/* Other Villagers */}
        {byVillager.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-ink-400" />
              <span className="text-sm font-medium text-ink-300">
                Villagers
              </span>
              <span className="text-xs text-ink-500">
                {byVillager.length} entries
              </span>
            </div>
            <div className="space-y-2">
              {byVillager.map(reverb => (
                <ReverbCard key={reverb.id} reverb={reverb} navigate={navigate} />
              ))}
            </div>
          </div>
        )}

        {reverberationLibrary.length === 0 && (
          <div className="text-center py-12">
            <Quote className="w-8 h-8 text-ink-700 mx-auto mb-3" />
            <p className="text-sm text-ink-500">No wisdom tagged yet</p>
            <p className="text-xs text-ink-600 mt-1">
              Select text in the editor and tap "Tag Wisdom"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ReverbCard({
  reverb,
  navigate
}: {
  reverb: { id: string; text: string; sceneId: string; linkedRevealSceneId?: string | null; villagerName?: string }
  navigate: (path: string) => void
}) {
  const isLinked = Boolean(reverb.linkedRevealSceneId)

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg border ${
        isLinked
          ? 'bg-section-reveal/10 border-section-reveal/30'
          : 'bg-ink-900 border-ink-800'
      }`}
    >
      <div className="flex items-start gap-2">
        <Quote className="w-4 h-4 text-ink-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink-200 italic">
            "{reverb.text}"
          </p>
          {reverb.villagerName && (
            <p className="text-xs text-ink-500 mt-1">— {reverb.villagerName}</p>
          )}
        </div>
        {isLinked ? (
          <CheckCircle2 className="w-4 h-4 text-section-reveal shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-ink-600 shrink-0" />
        )}
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-ink-800">
        <button
          onClick={() => navigate(`/edit/${reverb.sceneId}`)}
          className="text-xs text-ink-500 hover:text-ink-300"
        >
          View source
        </button>
        {isLinked && (
          <button
            onClick={() => navigate(`/edit/${reverb.linkedRevealSceneId}`)}
            className="flex items-center gap-1 text-xs text-section-reveal"
          >
            <Link2 className="w-3 h-3" />
            View echo
          </button>
        )}
      </div>
    </motion.div>
  )
}
