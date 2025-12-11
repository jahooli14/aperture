import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, ArrowRight, Loader2, Link2 } from 'lucide-react'


interface SerendipityDialogProps {
  isOpen: boolean
  onClose: () => void
  data: {
    source: { title: string, type: string }
    target: { title: string, type: string }
    bridge: string
    metaphor: string
  } | null
  loading: boolean
  onRefresh: () => void
}

export function SerendipityDialog({ isOpen, onClose, data, loading, onRefresh }: SerendipityDialogProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-2xl rounded-2xl p-8 shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Serendipity Engine</h2>
              <p className="text-gray-400 text-sm">Bridging the structural holes in your mind</p>
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
              <p className="text-purple-300/80 animate-pulse">Traversing the vector space...</p>
            </div>
          ) : data && data.source && data.target ? (
            <div className="space-y-8">
              {/* The Bridge Visualization */}
              <div className="flex items-center justify-between relative">
                {/* Source */}
                <div className="flex-1 bg-white/5 p-4 rounded-xl border border-white/10">
                  <span className="text-xs uppercase tracking-wider text-gray-500 mb-1 block">{data.source.type}</span>
                  <h3 className="text-lg font-medium text-white line-clamp-2">{data.source.title}</h3>
                </div>

                {/* Connection Line */}
                <div className="mx-4 flex-shrink-0 flex flex-col items-center">
                  <div className="w-16 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent mb-2" />
                  <Link2 className="h-5 w-5 text-purple-400" />
                  <div className="w-16 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent mt-2" />
                </div>

                {/* Target */}
                <div className="flex-1 bg-white/5 p-4 rounded-xl border border-white/10 text-right">
                  <span className="text-xs uppercase tracking-wider text-gray-500 mb-1 block">{data.target.type}</span>
                  <h3 className="text-lg font-medium text-white line-clamp-2">{data.target.title}</h3>
                </div>
              </div>

              {/* The Bisociation */}
              <div className="text-center px-4 py-6 bg-purple-900/10 rounded-2xl border border-purple-500/20">
                <p className="text-xs uppercase tracking-widest text-purple-400 mb-3">The Metaphor</p>
                <h3 className="text-2xl font-serif italic text-purple-100 mb-4">"{data.metaphor}"</h3>
                <p className="text-gray-300 leading-relaxed">{data.bridge}</p>
              </div>

              {/* Actions */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={onRefresh}
                  className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-2 border border-white/10"
                >
                  <Zap className="h-4 w-4" />
                  Find Another Bridge
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No structural holes found. Your knowledge graph is too dense! (Or try again)
              <button onClick={onRefresh} className="block mx-auto mt-4 text-purple-400 hover:underline">Retry</button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
