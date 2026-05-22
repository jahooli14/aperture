import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Layers, Link, ListPlus, X } from 'lucide-react'

interface CreateMenuModalProps {
    isOpen: boolean
    onClose: () => void
    onAction: (action: 'thought' | 'project' | 'article' | 'list') => void
}

// All actions share the brand cyan accent — icon + label do the work of
// distinguishing them. Per design system: cyan-only chrome.
const creationActions = [
    { id: 'thought', label: 'Thought',   description: 'Write down a thought',  icon: Brain },
    { id: 'project', label: 'Project',   description: 'Start something new',   icon: Layers },
    { id: 'list',    label: 'List Item', description: 'Add to one of your lists', icon: ListPlus },
    { id: 'article', label: 'Article',   description: 'Save a link to read later', icon: Link },
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
                            background: 'var(--brand-bg)',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '24px 24px 0 0',
                            paddingBottom: 'env(safe-area-inset-bottom, 20px)',
                        }}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                        </div>

                        {/* Header — editorial serif, mirrors the refined home cards. */}
                        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-5">
                            <div className="min-w-0 flex-1">
                                <h2
                                    className="text-2xl leading-tight"
                                    style={{
                                        color: 'var(--brand-text-primary)',
                                        fontFamily: 'var(--brand-font-body)',
                                        fontWeight: 500,
                                    }}
                                >
                                    What are you adding?
                                </h2>
                                <span
                                    className="text-[10px] uppercase tracking-[0.32em] font-semibold mt-1.5 inline-block"
                                    style={{ color: 'rgba(var(--brand-primary-rgb),0.7)' }}
                                >
                                    pick one
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="h-11 w-11 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                            >
                                <X className="h-5 w-5 text-white/80" />
                            </button>
                        </div>

                        {/* Row-stacked options — single column so list-item doesn't
                            orphan in a 2-col grid. Each row is full-width with icon left,
                            text right. */}
                        <div className="flex flex-col gap-2.5 px-4 pb-5">
                            {creationActions.map((action, i) => {
                                const Icon = action.icon
                                return (
                                    <motion.button
                                        key={action.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04, type: 'spring', damping: 24, stiffness: 420 }}
                                        onClick={() => {
                                            onAction(action.id as any)
                                            onClose()
                                        }}
                                        className="relative flex items-center gap-4 p-4 rounded-2xl text-left overflow-hidden active:scale-[0.99] transition-transform"
                                        style={{
                                            background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.08) 0%, rgba(15,24,41,0.55) 70%)',
                                            border: '1px solid rgba(var(--brand-primary-rgb),0.14)',
                                            boxShadow:
                                                '0 0 24px -10px rgba(var(--brand-primary-rgb),0.12),' +
                                                'inset 0 1px 0 rgba(255,255,255,0.04)',
                                        }}
                                    >
                                        {/* Top hairline glow — same editorial cue as the home cards. */}
                                        <span
                                            aria-hidden
                                            className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                                            style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
                                        />

                                        <div
                                            className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: 'rgba(var(--brand-primary-rgb), 0.10)',
                                                border: '1px solid rgba(var(--brand-primary-rgb), 0.28)',
                                            }}
                                        >
                                            <Icon className="h-5 w-5" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p
                                                className="text-[15px] leading-tight"
                                                style={{
                                                    color: 'var(--brand-text-primary)',
                                                    fontFamily: 'var(--brand-font-body)',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {action.label}
                                            </p>
                                            <p className="text-[11.5px] text-white/55 mt-0.5 leading-snug">
                                                {action.description}
                                            </p>
                                        </div>
                                    </motion.button>
                                )
                            })}
                        </div>

                        {/* Footer hint */}
                        <p className="meta-caps text-center pb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            Hold the FAB to dictate directly
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
