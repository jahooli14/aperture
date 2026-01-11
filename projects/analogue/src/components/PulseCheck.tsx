import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, User, Ear, Activity, Check } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { SceneNode, IdentityType, Sense, AwarenessLevel, FootnoteTone } from '../types/manuscript'

interface PulseCheckProps {
  scene: SceneNode
  onComplete: () => void
}

type Step = 'identity' | 'sensory' | 'awareness' | 'footnote'

const STEPS: Step[] = ['identity', 'sensory', 'awareness', 'footnote']

export default function PulseCheck({ scene, onComplete }: PulseCheckProps) {
  const { updateScene } = useManuscriptStore()
  const [step, setStep] = useState<Step>('identity')
  const [identity, setIdentity] = useState<IdentityType | null>(scene.identityType)
  const [sensory, setSensory] = useState<Sense | null>(scene.sensoryFocus)
  const [awareness, setAwareness] = useState<AwarenessLevel | null>(scene.awarenessLevel)
  const [footnote, setFootnote] = useState<FootnoteTone | null>(scene.footnoteTone)

  const stepIndex = STEPS.indexOf(step)

  const handleNext = () => {
    const nextIndex = stepIndex + 1
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex])
    } else {
      handleComplete()
    }
  }

  const handleComplete = async () => {
    await updateScene(scene.id, {
      identityType: identity,
      sensoryFocus: sensory,
      awarenessLevel: awareness,
      footnoteTone: footnote,
      pulseCheckCompletedAt: new Date().toISOString()
    })
    onComplete()
  }

  const canProceed = () => {
    switch (step) {
      case 'identity':
        return identity !== null
      case 'sensory':
        return true // Optional
      case 'awareness':
        return awareness !== null
      case 'footnote':
        return true // Can skip if no footnotes planned
      default:
        return false
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-black/60"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full bg-ink-900 rounded-t-2xl border-t border-ink-700 pt-safe"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-800">
          <div>
            <h2 className="text-lg font-medium text-ink-100">Pulse Check</h2>
            <p className="text-xs text-ink-500">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
          </div>
          <button
            onClick={onComplete}
            className="p-2 text-ink-400 hover:text-ink-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-ink-800">
          <motion.div
            className="h-full bg-section-departure"
            initial={{ width: 0 }}
            animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4 min-h-[300px]">
          {step === 'identity' && (
            <StepIdentity value={identity} onChange={setIdentity} />
          )}
          {step === 'sensory' && (
            <StepSensory value={sensory} onChange={setSensory} />
          )}
          {step === 'awareness' && (
            <StepAwareness value={awareness} onChange={setAwareness} />
          )}
          {step === 'footnote' && (
            <StepFootnote value={footnote} onChange={setFootnote} awareness={awareness} />
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-ink-800 pb-safe">
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="w-full py-3 bg-section-departure rounded-lg text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {stepIndex === STEPS.length - 1 ? (
              <>
                <Check className="w-4 h-4" />
                Complete
              </>
            ) : (
              'Next'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StepIdentity({
  value,
  onChange
}: {
  value: IdentityType | null
  onChange: (v: IdentityType) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-section-departure" />
        <h3 className="text-sm font-medium text-ink-200">Scene Identity</h3>
      </div>
      <p className="text-xs text-ink-500 mb-4">
        Is this an Alex/Identity scene or a Villager/Mental Issue scene?
      </p>

      <div className="space-y-2">
        <button
          onClick={() => onChange('alex')}
          className={`w-full p-4 rounded-lg border text-left transition-colors ${
            value === 'alex'
              ? 'bg-section-departure/20 border-section-departure text-ink-100'
              : 'bg-ink-900 border-ink-700 text-ink-400'
          }`}
        >
          <div className="font-medium">Alex / Identity</div>
          <div className="text-xs mt-1 opacity-70">
            Al (Doctor) or Lexi (Villager persona) - the split identity
          </div>
        </button>

        <button
          onClick={() => onChange('villager-issue')}
          className={`w-full p-4 rounded-lg border text-left transition-colors ${
            value === 'villager-issue'
              ? 'bg-section-escape/20 border-section-escape text-ink-100'
              : 'bg-ink-900 border-ink-700 text-ink-400'
          }`}
        >
          <div className="font-medium">Villager / Mental Issue</div>
          <div className="text-xs mt-1 opacity-70">
            A villager representing a mental health theme
          </div>
        </button>
      </div>
    </div>
  )
}

function StepSensory({
  value,
  onChange
}: {
  value: Sense | null
  onChange: (v: Sense | null) => void
}) {
  const SENSES: { id: Sense; label: string; emoji: string }[] = [
    { id: 'sight', label: 'Sight', emoji: '👁️' },
    { id: 'sound', label: 'Sound', emoji: '👂' },
    { id: 'smell', label: 'Smell', emoji: '👃' },
    { id: 'taste', label: 'Taste', emoji: '👅' },
    { id: 'touch', label: 'Touch', emoji: '✋' }
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Ear className="w-5 h-5 text-section-escape" />
        <h3 className="text-sm font-medium text-ink-200">Sensory Focus</h3>
      </div>
      <p className="text-xs text-ink-500 mb-4">
        Which sense is being recovered in this scene? (Optional)
      </p>

      <div className="grid grid-cols-3 gap-2">
        {SENSES.map(sense => (
          <button
            key={sense.id}
            onClick={() => onChange(value === sense.id ? null : sense.id)}
            className={`p-3 rounded-lg border text-center transition-colors ${
              value === sense.id
                ? 'bg-section-escape/20 border-section-escape text-ink-100'
                : 'bg-ink-900 border-ink-700 text-ink-400'
            }`}
          >
            <div className="text-xl mb-1">{sense.emoji}</div>
            <div className="text-xs">{sense.label}</div>
          </button>
        ))}
      </div>

      <button
        onClick={() => onChange(null)}
        className="w-full mt-3 py-2 text-xs text-ink-500"
      >
        Skip - no sensory focus
      </button>
    </div>
  )
}

function StepAwareness({
  value,
  onChange
}: {
  value: AwarenessLevel | null
  onChange: (v: AwarenessLevel) => void
}) {
  const LEVELS: { id: AwarenessLevel; label: string; description: string }[] = [
    { id: 'high-drift', label: 'High Drift', description: 'Very fragmented, stream of consciousness' },
    { id: 'moderate-drift', label: 'Moderate Drift', description: 'Some disconnection, occasional clarity' },
    { id: 'emerging', label: 'Emerging', description: 'Awareness beginning to surface' },
    { id: 'cohesive', label: 'Cohesive', description: 'Clear prose, grounded perspective' },
    { id: 'fully-present', label: 'Fully Present', description: 'Complete clarity and presence' }
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-section-alignment" />
        <h3 className="text-sm font-medium text-ink-200">Awareness Level</h3>
      </div>
      <p className="text-xs text-ink-500 mb-4">
        Where is the prose on the Drift-to-Cohesion scale?
      </p>

      <div className="space-y-2">
        {LEVELS.map(level => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              value === level.id
                ? 'bg-section-alignment/20 border-section-alignment text-ink-100'
                : 'bg-ink-900 border-ink-700 text-ink-400'
            }`}
          >
            <div className="text-sm font-medium">{level.label}</div>
            <div className="text-xs mt-0.5 opacity-70">{level.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepFootnote({
  value,
  onChange,
  awareness
}: {
  value: FootnoteTone | null
  onChange: (v: FootnoteTone) => void
  awareness: AwarenessLevel | null
}) {
  const needsAcerbic = awareness === 'high-drift' || awareness === 'moderate-drift'

  const TONES: { id: FootnoteTone; label: string; description: string }[] = [
    { id: 'high-acerbic', label: 'High Acerbic', description: 'Sharp, biting, highly critical inner voice' },
    { id: 'moderate', label: 'Moderate', description: 'Pointed but not overwhelming' },
    { id: 'gentle', label: 'Gentle', description: 'Softer self-reflection' },
    { id: 'absent', label: 'Absent', description: 'No footnotes in this scene' }
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-section-rupture" />
        <h3 className="text-sm font-medium text-ink-200">Footnote Tone</h3>
      </div>

      {needsAcerbic && (
        <div className="p-3 mb-4 bg-status-yellow/10 border border-status-yellow/30 rounded-lg">
          <p className="text-xs text-status-yellow">
            ⚠️ Quality Signal: High drift requires acerbic footnotes to signal intentional style
          </p>
        </div>
      )}

      <p className="text-xs text-ink-500 mb-4">
        What's the tone of the subconscious/meta voice?
      </p>

      <div className="space-y-2">
        {TONES.map(tone => (
          <button
            key={tone.id}
            onClick={() => onChange(tone.id)}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              value === tone.id
                ? 'bg-section-rupture/20 border-section-rupture text-ink-100'
                : 'bg-ink-900 border-ink-700 text-ink-400'
            } ${
              needsAcerbic && tone.id !== 'high-acerbic'
                ? 'opacity-50'
                : ''
            }`}
          >
            <div className="text-sm font-medium">{tone.label}</div>
            <div className="text-xs mt-0.5 opacity-70">{tone.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
