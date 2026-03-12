import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { useListStore } from '../../stores/useListStore'
import { Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Quote, ListPlus } from 'lucide-react'
import {
    BottomSheet,
    BottomSheetContent,
    BottomSheetDescription,
    BottomSheetFooter,
    BottomSheetHeader,
    BottomSheetTitle,
} from '../ui/bottom-sheet'
import type { ListType } from '../../types'

const TYPES: { id: ListType, label: string, icon: any }[] = [
    { id: 'film', label: 'Movies', icon: Film },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'tech', label: 'Tech', icon: Monitor },
    { id: 'book', label: 'Books', icon: Book },
    { id: 'place', label: 'Travel', icon: MapPin },
    { id: 'game', label: 'Games', icon: Gamepad2 },
    { id: 'event', label: 'Events', icon: Calendar },
    { id: 'quote', label: 'Phrases', icon: Quote },
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
        const listId = await createList({ title, type })
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
                    <div className="flex items-center gap-3 mb-2">
                        <ListPlus className="h-6 w-6" style={{ color: 'var(--brand-primary)' }} />
                        <BottomSheetTitle>Create Collection</BottomSheetTitle>
                    </div>
                    <BottomSheetDescription>
                        Start a new curated collection
                    </BottomSheetDescription>
                </BottomSheetHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--brand-primary)' }}>
                            List Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Scifi Movies 2024"
                            className="text-lg h-14 bg-[var(--glass-surface)] border-[var(--glass-surface-hover)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/10"
                            style={{ color: 'var(--brand-text-primary)' }}
                            autoFocus
                            autoComplete="off"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">Type</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {TYPES.map(t => {
                                const Icon = t.icon
                                const isSelected = type === t.id
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setType(t.id)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${isSelected
                                            ? 'bg-white text-black border-white'
                                            : 'bg-black border-[var(--glass-surface-hover)] text-[var(--brand-text-secondary)] hover:border-white/30'
                                            }`}
                                    >
                                        <Icon className="h-5 w-5 mb-1" />
                                        <span className="text-[10px] uppercase font-bold">{t.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <BottomSheetFooter>
                        <Button
                            type="submit"
                            disabled={!title.trim() || loading}
                            className="w-full h-14 font-black uppercase tracking-widest touch-manipulation"
                            style={{
                              background: 'rgba(59,130,246,0.15)',
                              border: '2px solid rgba(59,130,246,0.5)',
                              borderRadius: '4px',
                              boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                              color: 'var(--brand-primary)',
                            }}
                        >
                            {loading ? 'Creating...' : 'Create Collection'}
                        </Button>
                    </BottomSheetFooter>
                </form>
            </BottomSheetContent>
        </BottomSheet>
    )
}
