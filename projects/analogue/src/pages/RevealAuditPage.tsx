import { useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Circle, AlertTriangle, Ghost, Home } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'

export default function RevealAuditPage() {
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

  // Build ghost checklist - all villagers/issues that need echoing
  const ghostChecklist = useMemo(() => {
    // Get all unique villagers from reverberations
    const villagers = reverberationLibrary
      .filter(r => r.speaker === 'villager' && r.villagerName)
      .reduce((acc, r) => {
        const name = r.villagerName!
        if (!acc[name]) {
          acc[name] = {
            name,
            reverberations: [],
            allEchoed: true
          }
        }
        acc[name].reverberations.push(r)
        if (!r.linkedRevealSceneId) {
          acc[name].allEchoed = false
        }
        return acc
      }, {} as Record<string, { name: string; reverberations: typeof reverberationLibrary; allEchoed: boolean }>)

    return Object.values(villagers)
  }, [reverberationLibrary])

  // Check Al/Lexi symmetry
  const alReverbs = reverberationLibrary.filter(r => r.speaker === 'al')
  const lexiReverbs = reverberationLibrary.filter(r => r.speaker === 'lexi')
  const alEchoed = alReverbs.filter(r => r.linkedRevealSceneId).length
  const lexiEchoed = lexiReverbs.filter(r => r.linkedRevealSceneId).length

  const allVillagersEchoed = ghostChecklist.every(v => v.allEchoed)
  const alexFullyEchoed = alEchoed === alReverbs.length && lexiEchoed === lexiReverbs.length

  const readyForReveal = allVillagersEchoed && alexFullyEchoed

  return (
    <div className="flex-1 flex flex-col bg-ink-950 pt-safe">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-ink-800">
        <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>
        <div>
          <h1 className="text-lg font-medium text-ink-100">Reveal Audit</h1>
          <p className="text-xs text-ink-500">The Big House doorstep validation</p>
        </div>
      </header>

      {/* Final validation status */}
      <div className={`mx-4 mt-4 p-4 rounded-lg border ${
        readyForReveal
          ? 'bg-status-green/10 border-status-green/30'
          : 'bg-status-yellow/10 border-status-yellow/30'
      }`}>
        <div className="flex items-center gap-3">
          {readyForReveal ? (
            <>
              <CheckCircle2 className="w-6 h-6 text-status-green" />
              <div>
                <p className="text-sm font-medium text-status-green">
                  Ready for: "I think you know."
                </p>
                <p className="text-xs text-ink-400 mt-0.5">
                  All reverberations echoed on the doorstep
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-6 h-6 text-status-yellow" />
              <div>
                <p className="text-sm font-medium text-status-yellow">
                  Symmetry incomplete
                </p>
                <p className="text-xs text-ink-400 mt-0.5">
                  Some wisdom hasn't been echoed in the Reveal
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ghost checklist */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe">
        {/* The House section */}
        <div className="flex items-center gap-2 pb-2 border-b border-ink-800">
          <Home className="w-4 h-4 text-section-reveal" />
          <span className="text-sm font-medium text-ink-300">
            The Big House Doorstep
          </span>
        </div>

        {/* Alex (Al + Lexi) status */}
        <div className={`p-4 rounded-lg border ${
          alexFullyEchoed
            ? 'bg-section-alignment/10 border-section-alignment/30'
            : 'bg-ink-900 border-ink-800'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {alexFullyEchoed ? (
              <CheckCircle2 className="w-4 h-4 text-status-green" />
            ) : (
              <Circle className="w-4 h-4 text-ink-500" />
            )}
            <span className="text-sm font-medium text-ink-200">
              Alex Identity (Al + Lexi)
            </span>
          </div>
          <div className="flex gap-4 text-xs">
            <span className={alEchoed === alReverbs.length ? 'text-status-green' : 'text-ink-500'}>
              Al: {alEchoed}/{alReverbs.length}
            </span>
            <span className={lexiEchoed === lexiReverbs.length ? 'text-status-green' : 'text-ink-500'}>
              Lexi: {lexiEchoed}/{lexiReverbs.length}
            </span>
          </div>
        </div>

        {/* Ghost entries for each villager */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-ink-800">
          <Ghost className="w-4 h-4 text-ink-500" />
          <span className="text-sm font-medium text-ink-300">
            Villager Echoes
          </span>
        </div>

        {ghostChecklist.length > 0 ? (
          ghostChecklist.map(villager => (
            <motion.div
              key={villager.name}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                villager.allEchoed
                  ? 'bg-status-green/10 border-status-green/30'
                  : 'bg-ink-900 border-ink-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {villager.allEchoed ? (
                  <CheckCircle2 className="w-4 h-4 text-status-green" />
                ) : (
                  <Circle className="w-4 h-4 text-ink-500" />
                )}
                <span className="text-sm font-medium text-ink-200">
                  {villager.name}
                </span>
              </div>

              <div className="space-y-1.5 pl-6">
                {villager.reverberations.map(reverb => (
                  <div key={reverb.id} className="flex items-start gap-2">
                    {reverb.linkedRevealSceneId ? (
                      <CheckCircle2 className="w-3 h-3 text-status-green mt-0.5" />
                    ) : (
                      <Circle className="w-3 h-3 text-ink-600 mt-0.5" />
                    )}
                    <span className="text-xs text-ink-400 italic">
                      "{reverb.text.slice(0, 50)}..."
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8">
            <Ghost className="w-8 h-8 text-ink-700 mx-auto mb-3" />
            <p className="text-sm text-ink-500">No villager wisdom tagged</p>
            <p className="text-xs text-ink-600 mt-1">
              Tag wisdom from villagers in your scenes
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
