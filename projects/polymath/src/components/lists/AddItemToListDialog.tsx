import React, { useState, useEffect } from 'react'
import { Check, ChevronRight, ListPlus, Search, X } from 'lucide-react'
import { useListStore } from '../../stores/useListStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../ui/toast'

interface AddItemToListDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function AddItemToListDialog({ isOpen, onOpenChange }: AddItemToListDialogProps) {
    const { lists, fetchLists, addListItem } = useListStore()
    const { addToast } = useToast()
    const [selectedListId, setSelectedListId] = useState<string | null>(null)
    const [content, setContent] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchLists()
        }
    }, [isOpen, fetchLists])

    const filteredLists = lists.filter(l =>
        l.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!selectedListId || !content.trim()) return

        setIsSubmitting(true)
        try {
            await addListItem({
                list_id: selectedListId,
                content: content.trim(),
                status: 'pending'
            })
            addToast({
                title: "Success",
                description: "Item added to list",
                variant: "success"
            })
            setContent('')
            setSelectedListId(null)
            onOpenChange(false)
        } catch (error) {
            addToast({
                title: "Error",
                description: "Failed to add item",
                variant: "destructive"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectedList = lists.find(l => l.id === selectedListId)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-[#0A0A0B] border-white/10 p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                        <ListPlus className="h-6 w-6 text-sky-400" />
                        Add to List
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {!selectedListId ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="Search collections..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:ring-sky-500/50"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredLists.length > 0 ? (
                                    filteredLists.map((list) => (
                                        <button
                                            key={list.id}
                                            onClick={() => setSelectedListId(list.id)}
                                            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
                                                    <span className="text-lg">{list.icon || '📁'}</span>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-medium text-white">{list.title}</p>
                                                    <p className="text-xs text-zinc-500">{list.item_count || 0} items</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-zinc-500 text-sm">No lists found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                                <div className="h-10 w-10 rounded-lg bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                                    <span className="text-xl">{selectedList?.icon || '📁'}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-sky-400 uppercase tracking-widest">Target Collection</p>
                                    <p className="text-lg font-bold text-white">{selectedList?.title}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedListId(null)}
                                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">What are we adding?</label>
                                    <Input
                                        autoFocus
                                        placeholder="Enter item name..."
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:ring-sky-500/50 py-6 text-lg"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !content.trim()}
                                    className="w-full bg-white text-black hover:bg-zinc-200 h-12 rounded-xl font-bold flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? 'Adding...' : (
                                        <>
                                            <Check className="h-5 w-5" />
                                            Add to List
                                        </>
                                    )}
                                </Button>
                            </form>
                        </motion.div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
