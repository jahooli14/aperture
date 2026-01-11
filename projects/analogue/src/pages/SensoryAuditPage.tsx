import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, Ear, Wind, Cookie, Hand, CheckCircle2, Circle } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { canEnterRupture } from '../lib/validation'
import type { Sense } from '../types/manuscript'

const SENSE_CONFIG: Record<Sense, { icon: typeof Eye; label: string; color: string }> = {
  sight: { icon: Eye, label: 'Sight', color: 'text-blue-400' },
  sound: { icon: Ear, label: 'Sound', color: 'text-purple-400' },
  smell: { icon: Wind, label: 'Smell', color: 'text-green-400' },
  taste: { icon: Cookie, label: 'Taste', color: 'text-orange-400' },
  touch: { icon: Hand, label: 'Touch', color: 'text-pink-400' }
}

const STRENGTH_BARS: Record<string, number> = {
  weak: 1,
  moderate: 2,
  strong: 3
}

export default function SensoryAuditPage() {
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

  const { sensoryAudit } = manuscript
  const ruptureCheck = canEnterRupture(sensoryAudit)

  return (
    <div className="flex-1 flex flex-col bg-ink-950 pt-safe">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-ink-800">
        <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>
        <div>
          <h1 className="text-lg font-medium text-ink-100">Sensory Audit</h1>
          <p className="text-xs text-ink-500">Recovery tracking for Sections 1 & 2</p>
        </div>
      </header>

      {/* Rupture gate status */}
      <div className={`mx-4 mt-4 p-4 rounded-lg border ${
        ruptureCheck.allowed
          ? 'bg-status-green/10 border-status-green/30'
          : 'bg-status-yellow/10 border-status-yellow/30'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          {ruptureCheck.allowed ? (
            <CheckCircle2 className="w-5 h-5 text-status-green" />
          ) : (
            <Circle className="w-5 h-5 text-status-yellow" />
          )}
          <span className={`text-sm font-medium ${
            ruptureCheck.allowed ? 'text-status-green' : 'text-status-yellow'
          }`}>
            {ruptureCheck.allowed
              ? 'Ready for The Rupture'
              : 'Rupture section locked'}
          </span>
        </div>
        {!ruptureCheck.allowed && (
          <p className="text-xs text-ink-400">
            Missing senses: {ruptureCheck.missingSenses.map(s => SENSE_CONFIG[s].label).join(', ')}
          </p>
        )}
      </div>

      {/* Sense cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
        {(Object.entries(SENSE_CONFIG) as [Sense, typeof SENSE_CONFIG.sight][]).map(([sense, config]) => {
          const status = sensoryAudit[sense]
          const Icon = config.icon
          const bars = STRENGTH_BARS[status.strength]

          return (
            <motion.div
              key={sense}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                status.activated
                  ? 'bg-ink-900/50 border-ink-700'
                  : 'bg-ink-950 border-ink-800 border-dashed'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  status.activated ? 'bg-ink-800' : 'bg-ink-900'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    status.activated ? config.color : 'text-ink-600'
                  }`} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      status.activated ? 'text-ink-100' : 'text-ink-500'
                    }`}>
                      {config.label}
                    </span>
                    {status.activated && (
                      <CheckCircle2 className="w-4 h-4 text-status-green" />
                    )}
                  </div>

                  {status.activated ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-ink-500">
                        {status.occurrences} occurrence{status.occurrences !== 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            className={`w-1.5 h-3 rounded-sm ${
                              i <= bars ? config.color.replace('text-', 'bg-') : 'bg-ink-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-ink-500 capitalize">
                        {status.strength}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-600 mt-1">
                      Not yet activated in prose
                    </p>
                  )}
                </div>
              </div>

              {status.activationSceneId && (
                <button
                  onClick={() => navigate(`/edit/${status.activationSceneId}`)}
                  className="mt-3 text-xs text-section-escape hover:underline"
                >
                  View first activation →
                </button>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
