import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useListStore } from '../../stores/useListStore'
import { Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Quote } from 'lucide-react'
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Create Collection</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">List Title</label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Scifi Movies 2024"
                            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Type</label>
                        <div className="grid grid-cols-4 gap-2">
                            {TYPES.map(t => {
                                const Icon = t.icon
                                const isSelected = type === t.id
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setType(t.id)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${isSelected
                                                ? 'bg-white text-black border-white'
                                                : 'bg-zinc-800/50 text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-white'
                                            }`}
                                    >
                                        <Icon className="h-5 w-5 mb-1" />
                                        <span className="text-[10px] uppercase font-bold">{t.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} className="hover:bg-white/10 hover:text-white">
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!title.trim() || loading}
                            className="bg-white text-black hover:bg-zinc-200"
                        >
                            Create Collection
                        </Button>
                    </div>

                </form>
            </DialogContent>
        </Dialog>
    )
}
