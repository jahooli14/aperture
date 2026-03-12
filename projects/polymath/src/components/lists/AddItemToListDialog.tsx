import React, { useState, useEffect } from 'react'
import { Check, ChevronRight, ListPlus, Search, X } from 'lucide-react'
import { useListStore } from '../../stores/useListStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'
import { useToast } from '../ui/toast'
import {
    BottomSheet,
    BottomSheetContent,
    BottomSheetDescription,
    BottomSheetHeader,
    BottomSheetTitle,
    BottomSheetFooter,
} from '../ui/bottom-sheet'

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
            setSelectedListId(null)
            setContent('')
            setSearchQuery('')
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
        <BottomSheet open={isOpen} onOpenChange={onOpenChange}>
            <BottomSheetContent>
                <BottomSheetHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <ListPlus className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
                        <BottomSheetTitle>Add to List</BottomSheetTitle>
                    </div>
                    <BottomSheetDescription>
                        {selectedListId ? `Adding to ${selectedList?.title}` : 'Choose a collection'}
                    </BottomSheetDescription>
                </BottomSheetHeader>

                <div className="space-y-4 mt-6">
                    {!selectedListId ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                                <Input
                                    placeholder="Search collections..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/15"
                                    style={{ color: 'var(--premium-text-primary)' }}
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                {filteredLists.length > 0 ? (
                                    filteredLists.map((list) => (
                                        <button
                                            key={list.id}
                                            onClick={() => setSelectedListId(list.id)}
                                            className="flex items-center justify-between p-3 rounded-xl border transition-all group hover:bg-[rgba(255,255,255,0.05)]"
                                            style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                borderColor: 'rgba(255, 255, 255, 0.08)',
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="h-8 w-8 rounded-lg flex items-center justify-center border"
                                                    style={{
                                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                        borderColor: 'rgba(59, 130, 246, 0.2)',
                                                    }}
                                                >
                                                    <span className="text-lg">{list.icon || '📁'}</span>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>{list.title}</p>
                                                    <p className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>{list.item_count || 0} items</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 transition-colors" style={{ color: 'var(--premium-text-tertiary)' }} />
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>No lists found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                            className="space-y-4"
                        >
                            <div
                                className="flex items-center gap-3 p-3 rounded-xl border"
                                style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                    borderColor: 'rgba(59, 130, 246, 0.2)',
                                }}
                            >
                                <div
                                    className="h-10 w-10 rounded-lg flex items-center justify-center border"
                                    style={{
                                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                        borderColor: 'rgba(59, 130, 246, 0.25)',
                                    }}
                                >
                                    <span className="text-xl">{selectedList?.icon || '📁'}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--premium-blue)' }}>Target Collection</p>
                                    <p className="text-lg font-bold" style={{ color: 'var(--premium-text-primary)' }}>{selectedList?.title}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedListId(null)}
                                    className="p-2 transition-colors hover:bg-[rgba(255,255,255,0.1)] rounded-lg"
                                    style={{ color: 'var(--premium-text-tertiary)' }}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="font-bold text-xs uppercase tracking-widest text-[var(--brand-text-muted)]">What are we adding?</Label>
                                    <Input
                                        autoFocus
                                        placeholder="Enter item name..."
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] focus:border-blue-400 placeholder:text-[var(--brand-text-primary)]/15 py-6 text-lg"
                                        style={{ color: 'var(--premium-text-primary)' }}
                                    />
                                </div>

                                <BottomSheetFooter>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || !content.trim()}
                                        className="w-full h-12 font-bold flex items-center justify-center gap-2 touch-manipulation"
                                        style={{
                                          background: 'rgba(59,130,246,0.15)',
                                          border: '2px solid rgba(59,130,246,0.5)',
                                          borderRadius: '4px',
                                          boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                                          color: 'var(--premium-blue)',
                                        }}
                                    >
                                        {isSubmitting ? 'Adding...' : (
                                            <>
                                                <Check className="h-5 w-5" />
                                                Add to List
                                            </>
                                        )}
                                    </Button>
                                </BottomSheetFooter>
                            </form>
                        </motion.div>
                    )}
                </div>
            </BottomSheetContent>
        </BottomSheet>
    )
}
