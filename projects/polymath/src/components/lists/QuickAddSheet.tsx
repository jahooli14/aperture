import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { useListStore } from '../../stores/useListStore'
import type { List } from '../../types'

interface QuickAddSheetProps {
    list: List
    isOpen: boolean
    onClose: () => void
    listRgb: string
}

export function QuickAddSheet({ list, isOpen, onClose, listRgb }: QuickAddSheetProps) {
    const [value, setValue] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const { addListItem } = useListStore()

    useEffect(() => {
        if (isOpen) {
            setValue('')
            setTimeout(() => inputRef.current?.focus(), 80)
        }
    }, [isOpen])

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!value.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            await addListItem({
                list_id: list.id,
                content: value.trim(),
                status: 'pending'
            })
            onClose()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl pb-safe"
                        style={{
                            backgroundColor: '#141f32',
                            boxShadow: `0 -20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)`
                        }}
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-white/15" />
                        </div>

                        <div className="px-5 pt-3 pb-8">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-0.5"
                                        style={{ color: `rgb(${listRgb})` }}>
                                        Quick Add
                                    </p>
                                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                                        {list.title}
                                    </h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSubmit} className="flex items-center gap-3">
                                <input
                                    ref={inputRef}
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    placeholder={`Add to ${list.title.toLowerCase()}...`}
                                    className="flex-1 bg-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none border border-white/8 focus:border-white/20 transition-colors uppercase tracking-tight font-medium"
                                    onKeyDown={e => {
                                        if (e.key === 'Escape') onClose()
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!value.trim() || isSubmitting}
                                    className="h-11 w-11 flex items-center justify-center rounded-xl transition-all disabled:opacity-40"
                                    style={{
                                        backgroundColor: `rgba(${listRgb}, 0.2)`,
                                        boxShadow: `inset 0 0 0 1px rgba(${listRgb}, 0.3)`
                                    }}
                                >
                                    <Send className="h-4 w-4" style={{ color: `rgb(${listRgb})` }} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
