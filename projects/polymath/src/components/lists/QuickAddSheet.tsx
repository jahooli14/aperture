import React, { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { BottomSheet, BottomSheetContent } from '../ui/bottom-sheet'
import { useListStore } from '../../stores/useListStore'
import { useToast } from '../ui/toast'
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
    const { addToast } = useToast()

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
            addToast({
                title: `Added to ${list.title}`,
                variant: 'success'
            })
            onClose()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <BottomSheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <BottomSheetContent>
                {/* Header */}
                <div className="mb-5 pr-12">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-0.5"
                        style={{ color: `rgb(${listRgb})` }}>
                        Quick Add
                    </p>
                    <h3 className="text-base font-black text-[var(--brand-text-primary)] uppercase tracking-tight">
                        {list.title}
                    </h3>
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex items-center gap-3">
                    <input
                        ref={inputRef}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={`Add to ${list.title.toLowerCase()}...`}
                        className="flex-1 bg-[var(--glass-surface)] rounded-xl px-4 py-3 text-[var(--brand-text-primary)] text-sm placeholder-white/20 outline-none border border-white/8 focus:border-white/20 transition-colors uppercase tracking-tight font-medium"
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
            </BottomSheetContent>
        </BottomSheet>
    )
}
