import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useListStore } from '../../stores/useListStore'
import { Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Quote, FileText } from 'lucide-react'
import {
    BottomSheet,
    BottomSheetContent,
    BottomSheetFooter,
    BottomSheetHeader,
    BottomSheetTitle,
} from '../ui/bottom-sheet'
import type { ListType } from '../../types'

const TYPES: { id: ListType, label: string, icon: React.ElementType }[] = [
    { id: 'film', label: 'Movies', icon: Film },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'tech', label: 'Tech', icon: Monitor },
    { id: 'book', label: 'Books', icon: Book },
    { id: 'place', label: 'Travel', icon: MapPin },
    { id: 'game', label: 'Games', icon: Gamepad2 },
    { id: 'event', label: 'Events', icon: Calendar },
    { id: 'quote', label: 'Phrases', icon: Quote },
    { id: 'article', label: 'Articles', icon: FileText },
    { id: 'generic', label: 'General', icon: Box },
]

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CreateListDialog({ open, onOpenChange }: Props) {
    const [title, setTitle] = useState('')
    const [type, setType] = useState<ListType>('generic')
    const { createList } = useListStore()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setLoading(true)
        setError('')
        const listId = await createList({ title: title.trim(), type })
        setLoading(false)

        if (!listId) {
            setError('Failed to create list. Please try again.')
            return
        }

        onOpenChange(false)
        setTitle('')
        setType('generic')
    }

    return (
        <BottomSheet open={open} onOpenChange={onOpenChange}>
            <BottomSheetContent>
                <BottomSheetHeader>
                    <BottomSheetTitle>New collection</BottomSheetTitle>
                </BottomSheetHeader>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2.5 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <Input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Collection name…"
                        className="h-12 text-base bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-white/30 placeholder:text-white/20"
                        autoFocus
                        autoComplete="off"
                    />

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {TYPES.map(t => {
                            const Icon = t.icon
                            const isSelected = type === t.id
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setType(t.id)}
                                    className={`flex flex-col items-center gap-1.5 py-3 min-h-[64px] rounded-xl border transition-all text-[11px] font-bold uppercase tracking-wide ${
                                        isSelected
                                            ? 'bg-white text-black border-white'
                                            : 'border-white/15 text-white/70 hover:border-white/30 hover:text-white'
                                    }`}
                                >
                                    <Icon className="h-5 w-5" />
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>

                    <BottomSheetFooter>
                        <Button
                            type="submit"
                            disabled={!title.trim() || loading}
                            className="w-full h-12 bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl"
                        >
                            {loading ? 'Creating…' : 'Create collection'}
                        </Button>
                    </BottomSheetFooter>
                </form>
            </BottomSheetContent>
        </BottomSheet>
    )
}
