import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Layers, BookmarkPlus, ListPlus, X } from 'lucide-react'
import { cn } from '../lib/utils'

interface CreateMenuModalProps {
    isOpen: boolean
    onClose: () => void
    onAction: (action: 'thought' | 'project' | 'article' | 'list') => void
}

const creationActions = [
    {
        id: 'thought',
        label: 'Thought',
        description: 'Write down a thought',
        icon: Brain,
        accent: '139, 92, 246',
    },
    {
        id: 'project',
        label: 'Project',
        description: 'Start something new',
        icon: Layers,
        accent: '59, 130, 246',
    },
    {
        id: 'article',
        label: 'Short Read',
        description: 'Save a link to read later',
        icon: BookmarkPlus,
        accent: '16, 185, 129',
    },
    {
        id: 'list',
        label: 'List Item',
        description: 'Add to one of your lists',
        icon: ListPlus,
        accent: '245, 158, 11',
    },
] as const

export function CreateMenuModal({ isOpen, onClose, onAction }: CreateMenuModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[25000] flex items-end">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 36, stiffness: 520, mass: 0.45 }}
                        className="relative w-full z-10 overflow-hidden"
                        style={{
                            background: 'linear-gradient(to top, #0d0d10, #111116)',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '24px 24px 0 0',
                            paddingBottom: 'env(safe-area-inset-bottom, 20px)',
                        }}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-5">
                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-black uppercase tracking-tighter text-white">
                                    Create New
                                </h2>
                                <p className="text-xs text-white/60 font-medium mt-0.5">What would you like to add?</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="h-11 w-11 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
                            >
                                <X className="h-5 w-5 text-white/80" />
                            </button>
                        </div>

                        {/* 2×2 Action Grid */}
                        <div className="grid grid-cols-2 gap-3 px-4 pb-5">
                            {creationActions.map((action, i) => {
                                const Icon = action.icon
                                const rgb = action.accent
                                return (
                                    <motion.button
                                        key={action.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.02, type: 'spring', damping: 24, stiffness: 420 }}
                                        onClick={() => {
                                            onAction(action.id as any)
                                            onClose()
                                        }}
                                        className="relative flex flex-col items-start gap-3 p-4 rounded-2xl text-left overflow-hidden active:scale-[0.97] transition-transform min-h-[110px]"
                                        style={{
                                            background: `rgba(${rgb}, 0.12)`,
                                            border: `1px solid rgba(${rgb}, 0.3)`,
                                            boxShadow: `0 4px 16px rgba(${rgb}, 0.08)`,
                                        }}
                                    >
                                        {/* Icon */}
                                        <div
                                            className="h-11 w-11 rounded-xl flex items-center justify-center"
                                            style={{ background: `rgba(${rgb}, 0.2)`, border: `1px solid rgba(${rgb}, 0.3)` }}
                                        >
                                            <Icon className="h-5 w-5" style={{ color: `rgb(${rgb})` }} />
                                        </div>

                                        {/* Text */}
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-tight text-white leading-tight">
                                                {action.label}
                                            </p>
                                            <p className="text-[12px] text-white/70 mt-0.5 leading-snug">
                                                {action.description}
                                            </p>
                                        </div>

                                        {/* Corner glow */}
                                        <div
                                            className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-40 pointer-events-none"
                                            style={{
                                                background: `radial-gradient(circle at top right, rgba(${rgb}, 0.6), transparent 70%)`,
                                            }}
                                        />
                                    </motion.button>
                                )
                            })}
                        </div>

                        {/* Footer hint */}
                        <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 pb-4">
                            Hold the FAB to dictate directly
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
