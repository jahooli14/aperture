import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Layers, BookmarkPlus, ListPlus, X, Sparkles } from 'lucide-react'
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
        description: 'Capture a quick spark or insight',
        icon: Brain,
        color: 'from-purple-500 to-indigo-600',
        iconColor: 'text-purple-400',
        delay: 0.1
    },
    {
        id: 'project',
        label: 'Project',
        description: 'Launch a new focus area',
        icon: Layers,
        color: 'from-blue-500 to-cyan-600',
        iconColor: 'text-blue-400',
        delay: 0.15
    },
    {
        id: 'article',
        label: 'Article',
        description: 'Save content for later reading',
        icon: BookmarkPlus,
        color: 'from-emerald-500 to-teal-600',
        iconColor: 'text-emerald-400',
        delay: 0.2
    },
    {
        id: 'list',
        label: 'Item to List',
        description: 'Curate your growing collections',
        icon: ListPlus,
        color: 'from-amber-500 to-orange-600',
        iconColor: 'text-amber-400',
        delay: 0.25
    }
]

export function CreateMenuModal({ isOpen, onClose, onAction }: CreateMenuModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[25000] flex items-center justify-center p-4 md:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/50 shadow-2xl"
                    >
                        {/* Ambient Background Glows */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent opacity-50" />
                        <div className="absolute -top-24 -left-24 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full" />
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full" />

                        <div className="relative p-8 md:p-12">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-3xl font-black italic text-white flex items-center gap-3 tracking-tighter uppercase">
                                        <Sparkles className="h-6 w-6 text-sky-400" />
                                        Forge New
                                    </h2>
                                    <p className="text-zinc-500 text-sm font-medium mt-1">Select an entity to bring into existence.</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/5 group"
                                >
                                    <X className="h-6 w-6 text-zinc-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {creationActions.map((action) => (
                                    <motion.button
                                        key={action.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: action.delay }}
                                        onClick={() => {
                                            onAction(action.id as any)
                                            onClose()
                                        }}
                                        className="relative group flex items-center gap-5 p-5 rounded-3xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left overflow-hidden"
                                    >
                                        {/* Hover Gradient Background */}
                                        <div className={cn(
                                            "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500",
                                            action.color
                                        )} />

                                        <div className={cn(
                                            "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border border-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                                            "bg-zinc-800"
                                        )}>
                                            <action.icon className={cn("h-7 w-7", action.iconColor)} />
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xl font-bold text-white group-hover:text-sky-400 transition-colors uppercase tracking-tight">
                                                    {action.label}
                                                </span>
                                            </div>
                                            <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                                                {action.description}
                                            </p>
                                        </div>

                                        {/* Corner Accent */}
                                        <div className={cn(
                                            "absolute top-0 right-0 h-12 w-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                                            `bg-gradient-to-bl from-white/10 to-transparent pointer-events-none`
                                        )} />
                                    </motion.button>
                                ))}
                            </div>

                            <div className="mt-12 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                                    Hold the button to dictate directly
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
