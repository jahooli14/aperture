import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Quote, User } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { SceneNode } from '../types/manuscript'

interface ReverbTagModalProps {
  scene: SceneNode
  selectedText: string
  onClose: () => void
}

type Speaker = 'al' | 'lexi' | 'villager'

export default function ReverbTagModal({ scene, selectedText, onClose }: ReverbTagModalProps) {
  const { addReverberation } = useManuscriptStore()
  const [speaker, setSpeaker] = useState<Speaker>('villager')
  const [villagerName, setVillagerName] = useState('')

  const handleSave = async () => {
    await addReverberation({
      sceneId: scene.id,
      text: selectedText,
      speaker,
      villagerName: speaker === 'villager' ? villagerName || 'Unknown Villager' : undefined,
      linkedRevealSceneId: null
    })
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        onClick={e => e.stopPropagation()}
        className="w-full bg-ink-900 rounded-t-2xl border-t border-ink-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-800">
          <div className="flex items-center gap-2">
            <Quote className="w-5 h-5 text-section-reveal" />
            <h2 className="text-lg font-medium text-ink-100">Tag Wisdom</h2>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Selected text preview */}
          <div className="p-3 bg-ink-950 rounded-lg border border-ink-800">
            <p className="text-sm text-ink-300 italic">"{selectedText}"</p>
          </div>

          {/* Speaker selection */}
          <div>
            <label className="block text-xs text-ink-500 mb-2">Who speaks this wisdom?</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSpeaker('al')}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  speaker === 'al'
                    ? 'bg-section-departure/20 border-section-departure text-ink-100'
                    : 'bg-ink-950 border-ink-800 text-ink-400'
                }`}
              >
                <User className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs">Al</div>
                <div className="text-[10px] text-ink-500">Doctor</div>
              </button>

              <button
                onClick={() => setSpeaker('lexi')}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  speaker === 'lexi'
                    ? 'bg-section-escape/20 border-section-escape text-ink-100'
                    : 'bg-ink-950 border-ink-800 text-ink-400'
                }`}
              >
                <User className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs">Lexi</div>
                <div className="text-[10px] text-ink-500">Villager</div>
              </button>

              <button
                onClick={() => setSpeaker('villager')}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  speaker === 'villager'
                    ? 'bg-ink-700 border-ink-600 text-ink-100'
                    : 'bg-ink-950 border-ink-800 text-ink-400'
                }`}
              >
                <User className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs">Other</div>
                <div className="text-[10px] text-ink-500">Villager</div>
              </button>
            </div>
          </div>

          {/* Villager name input */}
          {speaker === 'villager' && (
            <div>
              <label className="block text-xs text-ink-500 mb-2">Villager name</label>
              <input
                type="text"
                value={villagerName}
                onChange={e => setVillagerName(e.target.value)}
                placeholder="e.g., The Baker, Martha, etc."
                className="w-full p-3 bg-ink-950 border border-ink-800 rounded-lg text-ink-100 placeholder:text-ink-600"
              />
            </div>
          )}

          {/* Info about reverberations */}
          <div className="p-3 bg-section-reveal/10 border border-section-reveal/30 rounded-lg">
            <p className="text-xs text-ink-400">
              This wisdom will be saved to your Reverberation Library. You can link it to the Reveal scene later for symmetry validation.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-ink-800 pb-safe">
          <button
            onClick={handleSave}
            className="w-full py-3 bg-section-reveal rounded-lg text-white font-medium"
          >
            Save to Library
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
