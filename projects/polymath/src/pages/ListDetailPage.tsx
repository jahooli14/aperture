import React, { useEffect, useState, useRef, useMemo, memo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Send, Trash2, Mic, MicOff, Check, ChevronRight, Pencil, Star, SortAsc, ChevronDown, Copy, Brain, Link as LinkIcon, BookOpen, Loader2, RefreshCw, Settings2, ToggleLeft, ToggleRight, Search, X } from 'lucide-react'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    useDroppable,
    closestCenter,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useListStore } from '../stores/useListStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useReadingStore } from '../stores/useReadingStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { ItemInsightStrip } from '../components/ItemInsightStrip'
import { VoiceInput } from '../components/VoiceInput'
import { OptimizedImage } from '../components/ui/optimized-image'
import { ArticleCard } from '../components/reading/ArticleCard'
import type { ListItem, ListType, ListSettings } from '../types'
import { listHasStatus } from '../types'
import { useToast } from '../components/ui/toast'
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle } from '../components/ui/bottom-sheet'
import { ListIcon, ListColor } from '../lib/listTheme'

// ============================================================================
// Star Rating component
// ============================================================================

const StarRating = memo(({
    rating,
    onRate,
    size = 'sm',
    readonly = false
}: {
    rating?: number | null
    onRate?: (r: number) => void
    size?: 'sm' | 'md'
    readonly?: boolean
}) => {
    const [hovered, setHovered] = useState<number | null>(null)
    const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-5 w-5'

    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hovered ?? rating ?? 0) >= star
                return (
                    <button
                        key={star}
                        type="button"
                        disabled={readonly}
                        onClick={(e) => {
                            e.stopPropagation()
                            onRate?.(star)
                        }}
                        onMouseEnter={() => !readonly && setHovered(star)}
                        onMouseLeave={() => !readonly && setHovered(null)}
                        className={`transition-all ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                    >
                        <Star
                            className={iconSize}
                            style={{
                                fill: filled ? 'rgb(var(--brand-primary-rgb))' : 'transparent',
                                color: filled ? 'rgb(var(--brand-primary-rgb))' : 'rgba(255,255,255,0.15)',
                                transition: 'all 0.1s'
                            }}
                        />
                    </button>
                )
            })}
        </div>
    )
})

// ============================================================================
// Completion celebration overlay
// ============================================================================

const CompletionCelebration = ({
    item,
    listType,
    onRate,
    onClose
}: {
    item: ListItem
    listType: string
    onRate: (rating: number) => void
    onClose: () => void
}) => {
    const [step, setStep] = useState<'rating' | 'thought'>('rating')
    const [thoughtText, setThoughtText] = useState('')
    const [savingThought, setSavingThought] = useState(false)

    const handleRate = (star: number) => {
        onRate(star)
        setStep('thought')
    }

    const handleSaveThought = async () => {
        if (!thoughtText.trim()) { onClose(); return }
        setSavingThought(true)
        try {
            await fetch('/api/memories?capture=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: thoughtText.trim(),
                    source_reference: {
                        type: 'list_item',
                        id: item.id,
                        title: item.content,
                        list_type: listType,
                    }
                })
            })
        } catch { /* silent */ }
        onClose()
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
                initial={{ y: 60, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 60, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-sm rounded-3xl px-6 py-8 text-center"
                style={{
                    backgroundColor: 'var(--glass-surface)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 40px 80px rgba(0,0,0,0.6)'
                }}
            >
                <AnimatePresence mode="wait">
                    {step === 'rating' ? (
                        <motion.div key="rating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {/* Celebration burst */}
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: [0, 1.3, 1] }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="text-5xl mb-4"
                            >

                            </motion.div>

                            <h3 className="text-lg font-black text-[var(--brand-text-primary)] uppercase tracking-tight mb-1">
                                Marked as done!
                            </h3>
                            <p className="text-sm text-[var(--brand-text-primary)]/40 mb-6 font-mono truncate">{item.content}</p>

                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-text-primary)]/30 mb-3">
                                How was it?
                            </p>

                            <div className="flex items-center justify-center gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => handleRate(star)}
                                        className="p-2 rounded-xl transition-all hover:scale-110 hover:bg-brand-primary/10"
                                    >
                                        <Star className="h-7 w-7 text-brand-text-secondary/40 hover:text-brand-text-secondary hover:fill-amber-400 transition-all" />
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setStep('thought')}
                                className="text-[11px] font-bold text-[var(--brand-text-primary)]/30 uppercase tracking-widest hover:text-[var(--brand-text-primary)]/60 transition-colors"
                            >
                                Skip rating
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div key="thought" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <Brain className="h-8 w-8 mb-4 mx-auto" style={{ color: 'var(--brand-text-muted)' }} />
                            <h3 className="text-base font-black text-[var(--brand-text-primary)] uppercase tracking-tight mb-1">
                                Any thoughts?
                            </h3>
                            <p className="text-xs text-[var(--brand-text-primary)]/30 mb-5">
                                Capture a reaction, insight, or feeling
                            </p>
                            <textarea
                                autoFocus
                                value={thoughtText}
                                onChange={e => setThoughtText(e.target.value)}
                                placeholder={`What did you think of ${item.content}?`}
                                className="w-full rounded-2xl px-4 py-3 text-sm text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-primary)]/20 resize-none focus:outline-none mb-4"
                                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '80px' }}
                                rows={3}
                                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveThought() }}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveThought}
                                    disabled={savingThought}
                                    className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                                    style={{ background: 'rgba(var(--brand-primary-rgb),0.15)', border: '1px solid rgba(var(--brand-primary-rgb),0.3)', color: 'var(--brand-primary)' }}
                                >
                                    {savingThought ? 'Saving...' : thoughtText.trim() ? 'Save thought' : 'Done'}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2.5 rounded-xl text-[11px] font-bold text-[var(--brand-text-primary)]/30 uppercase tracking-widest hover:text-[var(--brand-text-primary)]/60 transition-colors"
                                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                    Skip
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    )
}

// ============================================================================
// Section labels per list type (pending -> active -> completed)
// ============================================================================

type SectionStatus = 'pending' | 'active' | 'completed'

const getStatusLabels = (listType: string): Record<SectionStatus, string> => {
    switch (listType) {
        case 'film':
        case 'movie':
        case 'show':
        case 'tv':
            return { pending: 'To Watch', active: 'Watching', completed: 'Watched' }
        case 'book':
            return { pending: 'To Read', active: 'Reading', completed: 'Read' }
        case 'article':
            return { pending: 'To Read', active: 'Reading', completed: 'Read' }
        case 'music':
            return { pending: 'To Listen', active: 'Listening', completed: 'Listened' }
        case 'game':
            return { pending: 'To Play', active: 'Playing', completed: 'Played' }
        case 'place':
            return { pending: 'To Visit', active: 'Visiting', completed: 'Visited' }
        default:
            return { pending: 'To Do', active: 'In Progress', completed: 'Done' }
    }
}

const SECTION_ORDER: SectionStatus[] = ['pending', 'active', 'completed']

const sectionForItem = (status: string): SectionStatus => {
    if (status === 'completed') return 'completed'
    if (status === 'active') return 'active'
    return 'pending'
}

// ============================================================================
// Sort options
// ============================================================================

type SortOption = 'manual' | 'added' | 'rating' | 'alpha'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'added', label: 'Date Added' },
    { value: 'rating', label: 'Rating' },
    { value: 'alpha', label: 'AZ' },
]

function sortItems(items: ListItem[], sort: SortOption): ListItem[] {
    const copy = [...items]
    switch (sort) {
        case 'manual':
            return copy.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        case 'added':
            return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        case 'rating':
            return copy.sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0))
        case 'alpha':
            return copy.sort((a, b) => a.content.localeCompare(b.content))
        default:
            return copy
    }
}

// ============================================================================
// COLOR_SCHEMES for quote cards
// ============================================================================

const COLOR_SCHEMES = [
    { primary: 'violet', gradient: 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20', rgb: '139, 92, 246' },
    { primary: 'cyan', gradient: 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20', rgb: '6, 182, 212' },
    { primary: 'rose', gradient: 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20', rgb: '244, 63, 94' },
    { primary: 'amber', gradient: 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20', rgb: '245, 158, 11' },
    { primary: 'emerald', gradient: 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20', rgb: '16, 185, 129' }
] as const

const getVariant = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return hash % 5
}

// ============================================================================
// Quote Card (special treatment for quote lists)
// ============================================================================

const QuoteCard = memo(({
    item,
    isExpanded,
    onItemClick,
    onDelete,
    onCopy
}: {
    item: ListItem
    isExpanded: boolean
    onItemClick: (id: string) => void
    onDelete: (id: string, listId: string) => void
    onCopy: (text: string) => void
}) => {
    const [isEditingAuthor, setIsEditingAuthor] = useState(false)
    const [authorValue, setAuthorValue] = useState(item.metadata?.specs?.Author || 'Me')
    const updateListItemMetadata = useListStore(state => state.updateListItemMetadata)

    const variant = useMemo(() => getVariant(item.id), [item.id])
    const isShort = item.content.length < 80
    const isMedium = item.content.length >= 80 && item.content.length < 150
    const colors = COLOR_SCHEMES[variant]

    const handleSaveAuthor = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (authorValue.trim()) {
            const updatedMetadata = {
                ...item.metadata,
                specs: {
                    ...item.metadata?.specs,
                    Author: authorValue.trim()
                }
            }
            await updateListItemMetadata(item.id, updatedMetadata)
        }
        setIsEditingAuthor(false)
    }

    const bgClasses: Record<number, string> = {
        0: 'from-zinc-900/90 via-brand-primary/20 to-zinc-900/90',
        1: 'from-zinc-900/90 via-brand-primary/20 to-zinc-900/90',
        2: 'from-zinc-900/90 via-brand-primary/20 to-zinc-900/90',
        3: 'from-zinc-900/90 via-brand-primary/20 to-zinc-900/90',
        4: 'from-zinc-900/90 via-brand-primary/20 to-zinc-900/90',
    }

    const attributionColors: Record<number, string> = {
        0: '167, 139, 250',
        1: '103, 232, 249',
        2: '251, 113, 133',
        3: '251, 191, 36',
        4: '52, 211, 153',
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => onItemClick(item.id)}
            className="group relative cursor-pointer"
        >
            <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bgClasses[variant]} backdrop-blur-xl border-2 p-8 sm:p-12 hover:border-white/30 transition-all duration-500`}
                style={{
                    borderColor: `rgba(${colors.rgb}, 0.2)`,
                    boxShadow: `0 20px 40px rgba(${colors.rgb}, 0.05)`
                }}>
                {/* Accent glow */}
                <div className={`absolute top-0 left-0 w-40 h-40 bg-gradient-to-br ${colors.gradient} rounded-full blur-3xl opacity-30`} />

                {variant === 0 && (
                    <div className="absolute top-6 left-6 text-6xl font-serif text-[var(--brand-text-primary)]/[0.03] select-none leading-none">"</div>
                )}
                {variant === 1 && (
                    <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-brand-primary/10 rounded-tr-3xl" />
                )}

                {/* The Quote */}
                <div className="relative z-10 pt-4 sm:pt-6">
                    <p className={`${isShort ? 'text-3xl sm:text-4xl md:text-5xl' : isMedium ? 'text-2xl sm:text-3xl md:text-4xl' : 'text-xl sm:text-2xl md:text-3xl'} text-[var(--brand-text-primary)]/95 leading-relaxed tracking-wide ${variant === 0 ? 'font-light' : variant === 1 ? 'font-normal' : variant === 2 ? 'font-light italic' : variant === 3 ? 'font-medium' : 'font-light'}`}
                        style={{
                            fontFamily: variant === 0 ? 'Georgia, serif' : variant === 1 ? 'Palatino, serif' : variant === 2 ? 'Garamond, serif' : variant === 3 ? 'Times New Roman, serif' : 'Georgia, serif',
                            textShadow: `0 2px 10px rgba(${colors.rgb}, 0.1)`
                        }}>
                        {item.content}
                    </p>

                    {/* Author attribution */}
                    <div className="mt-6 flex items-center gap-2 group/author">
                        {isEditingAuthor ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={authorValue}
                                    onChange={(e) => setAuthorValue(e.target.value)}
                                    className="rounded-xl px-3 py-1 text-sm text-[var(--brand-text-primary)]/90 focus:outline-none appearance-none"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}
                                    placeholder="Author name"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveAuthor(e as any)
                                        else if (e.key === 'Escape') {
                                            setIsEditingAuthor(false)
                                            setAuthorValue(item.metadata?.specs?.Author || 'Me')
                                        }
                                    }}
                                />
                                <button onClick={handleSaveAuthor} className="p-1.5 rounded-xl bg-[rgba(255,255,255,0.1)] hover:bg-white/20 transition-colors">
                                    <Check className="h-3.5 w-3.5 text-[var(--brand-text-primary)]/70" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className={`text-sm font-medium tracking-wider ${variant === 2 ? 'italic' : ''}`}
                                    style={{ color: `rgba(${attributionColors[variant]}, 0.7)` }}>
                                    {variant === 3 ? '~' : ''} {item.metadata?.specs?.Author || item.metadata?.specs?.Source || item.metadata?.subtitle || 'Me'}
                                </p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsEditingAuthor(true) }}
                                    className="p-1.5 rounded-xl bg-[var(--glass-surface)] active:bg-[rgba(255,255,255,0.1)] opacity-40 active:opacity-100 transition-all active:scale-95"
                                >
                                    <Pencil className="h-3 w-3 text-[var(--brand-text-primary)]/50" />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && item.metadata && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-8 pt-6 border-t border-[var(--glass-surface-hover)] space-y-4"
                        >
                            {item.metadata.description && (
                                <p className="text-base text-zinc-300/90 leading-relaxed italic">{item.metadata.description}</p>
                            )}
                            {item.metadata.tags && item.metadata.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {item.metadata.tags.map((tag: string) => (
                                        <span key={tag} className="text-xs bg-[rgba(255,255,255,0.1)] backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-zinc-300 font-medium tracking-wide">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Enriching indicator */}
                {item.enrichment_status === 'pending' && (
                    <div className="absolute bottom-6 right-16 flex items-center gap-2 text-xs"
                        style={{ color: `rgba(${attributionColors[variant]}, 0.8)` }}>
                        <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: `rgba(${colors.rgb}, 0.6)` }} />
                        <span className="font-medium">Enriching</span>
                    </div>
                )}

                {/* Actions row */}
                <div className="absolute top-6 right-6 flex items-center gap-2">
                    {/* Copy button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onCopy(item.content) }}
                        className="p-2.5 rounded-xl bg-zinc-900/50 backdrop-blur-sm border border-[var(--glass-surface-hover)] active:bg-[rgba(255,255,255,0.1)] text-brand-text-muted active:text-[var(--brand-text-primary)] opacity-50 transition-all active:scale-95"
                        aria-label="Copy quote"
                    >
                        <Copy className="h-4 w-4" />
                    </button>

                    {/* Delete */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.list_id) }}
                        className="p-2.5 rounded-xl bg-zinc-900/50 backdrop-blur-sm border active:bg-brand-primary/20 active:border-red-500/40 text-brand-text-muted active:text-brand-text-secondary opacity-50 transition-all active:scale-95"
                        style={{ borderColor: `rgba(${colors.rgb}, 0.2)` }}
                        aria-label="Delete phrase"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    )
})

// ============================================================================
// Helpers for type-aware metadata display
// ============================================================================

const INTERNAL_SPEC_KEYS = new Set(['type', 'lastModified', 'source', 'Type'])

function getMetaLine(item: ListItem, listType: string): string[] {
    const m = item.metadata
    if (!m) return []
    const parts: string[] = []

    switch (listType) {
        case 'film': case 'movie': case 'tv': case 'show':
            if (m.specs?.Year || m.year) parts.push(m.specs?.Year || m.year)
            if (m.specs?.Runtime) parts.push(m.specs.Runtime)
            if (m.director) parts.push(`dir. ${m.director}`)
            if (m.specs?.Rating) parts.push(`${m.specs.Rating}`)
            break
        case 'book':
            if (m.author) parts.push(m.author)
            if (m.specs?.Year || m.year) parts.push(m.specs?.Year || m.year)
            if (m.specs?.pages) parts.push(`${m.specs.pages}pp`)
            if (m.specs?.publisher) parts.push(m.specs.publisher)
            break
        case 'music':
            if (m.subtitle && !m.subtitle.startsWith('Director')) parts.push(m.subtitle)
            if (m.specs?.Year) parts.push(m.specs.Year)
            if (m.genre || m.specs?.Genre) parts.push(m.genre || m.specs?.Genre)
            break
        case 'game':
            if (m.specs?.Year) parts.push(m.specs.Year)
            if (m.specs?.Developer) parts.push(m.specs.Developer)
            if (m.specs?.Platform) parts.push(m.specs.Platform)
            break
        case 'place':
            if (m.specs?.Region) parts.push(m.specs.Region)
            if (m.specs?.Country) parts.push(m.specs.Country)
            break
        case 'event':
            if (m.specs?.Date) parts.push(m.specs.Date)
            if (m.specs?.Location) parts.push(m.specs.Location)
            break
        default:
            // tech, software, generic: first 3 non-internal spec values
            Object.entries(m.specs || {})
                .filter(([k]) => !INTERNAL_SPEC_KEYS.has(k))
                .slice(0, 3)
                .forEach(([, v]) => v && parts.push(String(v)))
    }
    return parts.filter(Boolean)
}

// ============================================================================
// Standard item card
// ============================================================================

const StandardItemCard = memo(({
    item,
    listType,
    isExpanded,
    onItemClick,
    onDelete,
    onStatusChange,
    onRate,
    onMarkDone,
    rgb,
    hasThought,
    hasStatus = true,
    coverOverride,
}: {
    item: ListItem
    listType: string
    isExpanded: boolean
    onItemClick: (id: string) => void
    onDelete: (id: string, listId: string) => void
    onStatusChange?: (id: string, status: 'active' | 'completed' | 'pending') => void
    onRate: (id: string, rating: number) => void
    onMarkDone: (item: ListItem) => void
    rgb: string
    hasThought?: boolean
    hasStatus?: boolean
    coverOverride?: string
}) => {
    const hasImage = coverOverride || item.metadata?.image
    const imageUrl = coverOverride || item.metadata?.image
    const isPosterType = listType === 'book' || listType === 'film' || listType === 'movie' || listType === 'show' || listType === 'tv'
    const isCompleted = item.status === 'completed'

    // Status cycle: pending -> active -> completed -> pending
    const handleStatusCycle = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (item.status === 'pending' || item.status === 'abandoned') {
            onStatusChange?.(item.id, 'active')
        } else if (item.status === 'active') {
            onMarkDone(item)
        } else if (item.status === 'completed') {
            onStatusChange?.(item.id, 'pending')
        }
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => onItemClick(item.id)}
            className="group relative overflow-hidden rounded-xl cursor-pointer hover:scale-[1.02] transition-all duration-300 break-inside-avoid"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
        >
            {/* Image or gradient background */}
            {hasImage ? (
                <div className={`relative ${isPosterType ? 'aspect-[2/3]' : 'aspect-square'} overflow-hidden`}>
                    <OptimizedImage
                        src={imageUrl!}
                        alt={item.content}
                        className="w-full h-full"
                        aspectRatio={isPosterType ? '2/3' : '1/1'}
                        priority={false}
                        sizes="(max-width: 768px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                    {isCompleted && (
                        <div className="absolute inset-0 bg-black/40" />
                    )}
                </div>
            ) : (
                <div className="relative aspect-square overflow-hidden"
                    style={{ background: `linear-gradient(145deg, #0f172a, #1e293b)` }}
                >
                    {/* Subtle colour wash from list type */}
                    <div className="absolute inset-0"
                        style={{ background: `radial-gradient(ellipse at 30% 30%, rgba(${rgb}, 0.18) 0%, transparent 70%)` }}
                    />
                    {/* Faint grid texture */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: `linear-gradient(rgba(${rgb}, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(${rgb}, 1) 1px, transparent 1px)`,
                        backgroundSize: '32px 32px'
                    }} />
                    {/* Ghost icon watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]">
                        <ListIcon type={listType as ListType} className="h-24 w-24" style={{ color: `rgb(${rgb})` }} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                </div>
            )}

            {/* Content overlay */}
            <div className="absolute inset-0 p-3 flex flex-col justify-end">
                <h3 className={`text-[var(--brand-text-primary)] font-bold leading-tight uppercase tracking-tight drop-shadow-lg text-xs mb-2 ${isCompleted ? 'line-through opacity-50' : ''}`}>
                    {item.content}
                </h3>
                {/* Status pill — always visible, tap to cycle (only when status tracking is on) */}
                {hasStatus && (() => {
                    const labels = getStatusLabels(listType)
                    const label = item.status === 'abandoned' ? labels['pending'] : labels[item.status as 'pending' | 'active' | 'completed'] ?? labels['pending']
                    const pillColor = isCompleted ? '16, 185, 129' : item.status === 'active' ? rgb : '255, 255, 255'
                    const pillBg = isCompleted ? 'rgba(16,185,129,0.15)' : item.status === 'active' ? `rgba(${rgb}, 0.15)` : 'rgba(255,255,255,0.08)'
                    const pillBorder = isCompleted ? 'rgba(16,185,129,0.4)' : item.status === 'active' ? `rgba(${rgb}, 0.4)` : 'rgba(255,255,255,0.2)'
                    return (
                        <button
                            onClick={handleStatusCycle}
                            className="self-start flex items-center gap-1.5 px-2.5 py-2 rounded-full active:scale-95 transition-all min-h-[44px]"
                            style={{
                                background: pillBg,
                                border: `1px solid ${pillBorder}`,
                                color: `rgb(${pillColor})`,
                                fontSize: '9px',
                                fontWeight: 900,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {isCompleted ? <Check className="w-2.5 h-2.5 flex-shrink-0" /> : <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />}
                            {label}
                        </button>
                    )
                })()}
                {/* Rating stars */}
                {(item.user_rating || isExpanded) && (
                    <div className="mb-1 mt-1">
                        <StarRating
                            rating={item.user_rating}
                            onRate={(r) => onRate(item.id, r)}
                            size="sm"
                        />
                    </div>
                )}

                {/* Key metadata on expanded */}
                {isExpanded && (
                    <div className="space-y-1.5 backdrop-blur-sm bg-black/30 p-2 rounded-lg border border-[var(--glass-surface-hover)] mt-1">
                        {/* Type-aware meta line */}
                        {(() => {
                            const line = getMetaLine(item, listType)
                            return line.length > 0 ? (
                                <p className="text-[9px] text-brand-text-muted font-medium tracking-wide leading-relaxed">
                                    {line.join(' · ')}
                                </p>
                            ) : null
                        })()}
                        {/* Description */}
                        {item.metadata?.description && (
                            <p className="text-brand-text-muted text-[10px] leading-relaxed line-clamp-2">{item.metadata.description}</p>
                        )}
                        {/* Tags — filtered */}
                        {item.metadata?.tags && item.metadata.tags.length > 0 && (() => {
                            const cleanTags = (item.metadata.tags as string[])
                                .filter(t => t.length >= 4 && !INTERNAL_SPEC_KEYS.has(t))
                                .slice(0, 3)
                            return cleanTags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {cleanTags.map((tag: string) => (
                                        <span key={tag} className="text-[8px] bg-brand-primary/20 border border-brand-primary/30 px-1.5 py-0.5 rounded-xl text-brand-primary font-medium">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            ) : null
                        })()}
                        {/* Details link */}
                        {item.metadata?.link && (
                            <a
                                href={item.metadata.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-bold text-brand-primary hover:text-[var(--brand-text-primary)] transition-colors uppercase tracking-widest flex items-center gap-1 mt-0.5"
                                onClick={e => e.stopPropagation()}
                            >
                                Details
                            </a>
                        )}
                    </div>
                )}

                {/* Enriching status */}
                {!isExpanded && item.enrichment_status === 'pending' && (
                    <div className="flex items-center gap-1 text-[9px] text-brand-primary font-bold animate-pulse">
                        <div className="h-1 w-1 rounded-full bg-brand-primary" />
                        Enriching...
                    </div>
                )}

                {/* Thought captured indicator */}
                {hasThought && (
                    <div
                        className="flex items-center gap-1 mt-1"
                        title="You captured a thought about this"
                    >
                        <Brain className="w-2.5 h-2.5" style={{ color: 'rgba(251,191,36,0.7)' }} />
                        <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(251,191,36,0.6)' }}>thought captured</span>
                    </div>
                )}
            </div>

            {/* Quick actions on hover or when expanded */}
            <div className={`absolute top-2 right-2 flex gap-1 transition-transform duration-300 ${isExpanded ? 'translate-y-0' : 'translate-y-[-120%] group-hover:translate-y-0'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.list_id) }}
                    className="p-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary text-brand-text-secondary/50 hover:text-[var(--brand-text-primary)] backdrop-blur-md border border-red-500/20 transition-all"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            </div>
        </motion.div>
    )
})

// ============================================================================
// Masonry Grid
// ============================================================================

function SectionBlock({
    status,
    label,
    count,
    rgb,
    children,
}: {
    status: SectionStatus
    label: string
    count: number
    rgb: string
    children: React.ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `section-${status}` })
    return (
        <section ref={setNodeRef}>
            <div
                className="flex items-center gap-2 mb-3 transition-colors"
                style={{ color: isOver ? `rgb(${rgb})` : undefined }}
            >
                <span className="text-[11px] font-black uppercase tracking-widest text-brand-text-muted">{label}</span>
                <span className="text-[10px] font-bold text-zinc-600">{count}</span>
                <div className="flex-1 h-px bg-[var(--glass-surface)]" />
            </div>
            {children}
        </section>
    )
}

function EmptySectionDropzone({ status, label, rgb }: { status: SectionStatus; label: string; rgb: string }) {
    const { setNodeRef, isOver } = useDroppable({ id: `section-${status}-empty` })
    return (
        <div
            ref={setNodeRef}
            className="rounded-xl border border-dashed py-8 text-center text-[11px] font-bold uppercase tracking-widest transition-all"
            style={{
                borderColor: isOver ? `rgba(${rgb}, 0.5)` : 'rgba(255,255,255,0.08)',
                color: isOver ? `rgb(${rgb})` : 'rgba(255,255,255,0.25)',
                backgroundColor: isOver ? `rgba(${rgb}, 0.05)` : 'transparent',
            }}
        >
            Drop here to mark as {label}
        </div>
    )
}

function SortableQuote({
    item,
    isExpanded,
    onItemClick,
    onDelete,
}: {
    item: ListItem
    isExpanded: boolean
    onItemClick: (id: string) => void
    onDelete: (id: string, listId: string) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    }
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <QuoteCard
                item={item}
                isExpanded={isExpanded}
                onItemClick={onItemClick}
                onDelete={onDelete}
                onCopy={(text) => { navigator.clipboard?.writeText(text).catch(() => {}) }}
            />
        </div>
    )
}

// Sortable wrapper: applies dnd-kit transforms and long-press activation listeners.
// Children's clicks/buttons still fire because sensors require a delay/distance
// before activating a drag.
const SortableItemCard = memo((props: React.ComponentProps<typeof StandardItemCard>) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id })
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    }
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <StandardItemCard {...props} />
        </div>
    )
})

function MasonryListGrid({
    items,
    listType,
    expandedItemId,
    onItemClick,
    onDelete,
    onStatusChange,
    onRate,
    onMarkDone,
    rgb,
    thoughtCapturedIds,
    hasStatus = true,
    coverOverrides = {},
}: {
    items: ListItem[]
    listType: string
    expandedItemId: string | null
    onItemClick: (id: string) => void
    onDelete: (id: string, listId: string) => void
    onStatusChange?: (id: string, status: 'active' | 'completed' | 'pending') => void
    onRate: (id: string, rating: number) => void
    onMarkDone: (item: ListItem) => void
    rgb: string
    thoughtCapturedIds?: Set<string>
    hasStatus?: boolean
    coverOverrides?: Record<string, string>
}) {
    const [columns, setColumns] = useState(2)

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth
            if (w < 400) setColumns(1)
            else if (w < 768) setColumns(2)
            else setColumns(3)
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    const distributedColumns = useMemo(() => {
        const cols: ListItem[][] = Array.from({ length: columns }, () => [])
        items.forEach((item, i) => { cols[i % columns].push(item) })
        return cols
    }, [items, columns])

    return (
        <div className="flex gap-3 items-start w-full">
            {distributedColumns.map((colItems, colIndex) => (
                <div key={colIndex} className="flex-1 flex flex-col gap-3 min-w-0">
                    {colItems.map((item) => (
                        <SortableItemCard
                            key={item.id}
                            item={item}
                            listType={listType}
                            isExpanded={expandedItemId === item.id}
                            onItemClick={onItemClick}
                            onDelete={onDelete}
                            onStatusChange={onStatusChange}
                            onRate={onRate}
                            onMarkDone={onMarkDone}
                            rgb={rgb}
                            hasThought={thoughtCapturedIds?.has(item.id)}
                            hasStatus={hasStatus}
                            coverOverride={coverOverrides[item.id]}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

// ============================================================================
// Article List Mode — renders when list.type === 'article'
// Shows the reading queue with full reading infrastructure
// ============================================================================

interface ArticleListModeProps {
    list: { id: string; title: string; type: ListType; description?: string | null }
    navigate: ReturnType<typeof useNavigate>
}

function ArticleListMode({ list, navigate }: ArticleListModeProps) {
    const { articles, loading, fetchArticles, saveArticle } = useReadingStore()
    const { addToast } = useToast()
    const [urlInput, setUrlInput] = useState('')
    const [saving, setSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const processedSharesRef = useRef<Set<string>>(new Set())

    // Show unread + in-progress articles (not archived)
    const readingArticles = useMemo(
        () => articles.filter(a => a.status !== 'archived').sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        [articles]
    )

    useEffect(() => {
        fetchArticles(undefined, true)
    }, [])

    // Listen for pwa-share events when user is already on this page
    useEffect(() => {
        const handlePWAShare = async (event: CustomEvent) => {
            const sharedUrl = event.detail?.shared
            if (!sharedUrl || processedSharesRef.current.has(sharedUrl)) return
            processedSharesRef.current.add(sharedUrl)

            try {
                addToast({ title: 'Saving shared article...', description: 'Extracting content from ' + new URL(sharedUrl).hostname, variant: 'default' })
                await saveArticle({ url: sharedUrl })
                await fetchArticles(undefined, true)
                addToast({ title: 'Article saved!', description: 'Extracting content in background...', variant: 'success' })
            } catch {
                addToast({ title: 'Failed to save', description: 'Could not save the article. Try again.', variant: 'destructive' })
            }
        }

        window.addEventListener('pwa-share', handlePWAShare as unknown as EventListener)
        return () => window.removeEventListener('pwa-share', handlePWAShare as unknown as EventListener)
    }, [saveArticle, fetchArticles, addToast])

    const handleAddUrl = async (e: React.FormEvent) => {
        e.preventDefault()
        const url = urlInput.trim()
        if (!url) return
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            addToast({ title: 'Invalid URL', description: 'Please enter a full URL starting with https://', variant: 'destructive' })
            return
        }
        setSaving(true)
        setUrlInput('')
        try {
            await saveArticle({ url })
            await fetchArticles(undefined, true)
            addToast({ title: 'Saved!', description: 'Article added to your reading queue.', variant: 'success' })
        } catch {
            addToast({ title: 'Failed to save', description: 'Could not save the article. Try again.', variant: 'destructive' })
        } finally {
            setSaving(false)
            inputRef.current?.focus()
        }
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="pt-24 px-4 sm:px-6 lg:px-8 pb-4">
                <Button variant="ghost" onClick={() => navigate('/lists')} className="text-brand-text-muted mb-4 pl-0 hover:text-[var(--brand-text-primary)] hover:bg-transparent">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Collections
                </Button>

                <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: 'rgba(251,191,36,0.1)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.2)' }}>
                        <BookOpen className="h-3.5 w-3.5" style={{ color: 'rgb(251,191,36)' }} />
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgb(251,191,36)' }}>
                            Short Reads
                        </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs font-mono text-brand-text-muted"
                        style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface)' }}>
                        {readingArticles.length} {readingArticles.length === 1 ? 'article' : 'articles'}
                    </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-3xl font-bold text-[var(--brand-text-primary)] uppercase tracking-tight italic">{list.title}</h1>
                    <button
                        onClick={() => fetchArticles(undefined, true)}
                        className="h-9 w-9 rounded-full flex items-center justify-center transition-all text-brand-text-muted hover:text-[var(--brand-text-primary)]"
                        style={{ border: '1px solid var(--glass-surface-hover)' }}
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
                {list.description && <p className="text-brand-text-muted text-sm max-w-xl mb-4">{list.description}</p>}

                {/* URL Add Input */}
                <div className="mt-4 mb-8 max-w-2xl">
                    <motion.div
                        className="backdrop-blur-2xl bg-zinc-900/60 rounded-2xl p-2 flex items-center gap-2 shadow-2xl"
                        style={{ boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.15), 0 25px 50px rgba(0,0,0,0.5)' }}
                    >
                        <form onSubmit={handleAddUrl} className="flex-1 flex px-3 items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-zinc-500 shrink-0" />
                            <Input
                                ref={inputRef}
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                                placeholder="Paste a URL to save for reading..."
                                className="border-0 bg-transparent focus-visible:ring-0 text-base text-[var(--brand-text-primary)] placeholder:text-zinc-600 h-12"
                                type="url"
                                autoComplete="off"
                            />
                            <Button
                                type="submit"
                                disabled={!urlInput.trim() || saving}
                                className="rounded-xl bg-white text-black hover:bg-zinc-200 h-10 px-4 gap-2 font-bold shrink-0 transition-all uppercase text-xs tracking-widest"
                            >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><span>Save</span><Send className="h-3 w-3" /></>}
                            </Button>
                        </form>
                    </motion.div>
                </div>
            </div>

            {/* Articles List */}
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-48 max-w-3xl">
                {loading && readingArticles.length === 0 ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="shimmer h-28 rounded-2xl" />
                        ))}
                    </div>
                ) : readingArticles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 text-zinc-600">
                        <BookOpen className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-brand-text-muted font-medium text-lg mb-1">Your queue is empty.</p>
                        <p className="text-sm text-brand-text-muted opacity-60">Paste a URL above to start reading.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {readingArticles.map(article => (
                            <ArticleCard
                                key={article.id}
                                article={article}
                                onClick={() => navigate(`/reading/${article.id}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// Main Page
// ============================================================================

export default function ListDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { lists, loading, fetchListItems, addListItem, fetchLists, deleteListItem, reorderItems, updateListItemStatus, updateListItemMetadata, updateListSettings, updateList } = useListStore()
    // Pull items for this specific list directly from the persistent cache
    // map. This makes switching lists instantaneous and survives page reloads
    // (Google-Keep-style): if we've ever seen this list before, its items
    // render on the first paint with zero loading flicker.
    const cachedItems = useListStore(state => (id ? state.itemsByListId[id] : undefined))
    const { memories } = useMemoryStore()
    const { addToast } = useToast()

    const list = lists.find(l => l.id === id)

    // Set of list-item IDs that have at least one captured thought
    const thoughtCapturedIds = useMemo(() => {
        const ids = new Set<string>()
        memories.forEach(m => {
            if (m.source_reference?.type === 'list_item' && m.source_reference.id) {
                ids.add(m.source_reference.id)
            }
        })
        return ids
    }, [memories])

    const displayItems = cachedItems ?? []
    const hasCachedItems = displayItems.length > 0

    const [inputText, setInputText] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)

    const [isVoiceMode, setIsVoiceMode] = useState(false)
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
    const [sortOption, setSortOption] = useState<SortOption>('manual')
    const [activeDragId, setActiveDragId] = useState<string | null>(null)
    const [showSortMenu, setShowSortMenu] = useState(false)
    const [showListSettings, setShowListSettings] = useState(false)
    const [celebrationItem, setCelebrationItem] = useState<ListItem | null>(null)
    const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({})
    const inputRef = useRef<HTMLInputElement>(null)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    const rgb = list ? ListColor(list.type) : '148, 163, 184'
    const hasStatus = list ? listHasStatus(list) : false

    // Merge type defaults with per-list custom labels
    const statusLabels = useMemo(() => {
        const defaults = list ? getStatusLabels(list.type) : getStatusLabels('generic')
        const custom = list?.settings?.status_labels ?? {}
        return {
            pending: custom.pending ?? defaults.pending,
            active: custom.active ?? defaults.active,
            completed: custom.completed ?? defaults.completed,
        }
    }, [list?.type, list?.settings?.status_labels])

    const handleDeleteItem = useCallback(async (itemId: string, listId: string) => {
        const item = displayItems.find(i => i.id === itemId)
        const confirmed = await confirm({
            title: `Remove "${item?.content || 'this item'}"?`,
            description: 'This item will be permanently removed from the list.',
            confirmText: 'Remove',
            variant: 'destructive',
        })
        if (confirmed) {
            deleteListItem(itemId, listId)
        }
    }, [confirm, deleteListItem, displayItems])

    useEffect(() => {
        if (!lists.length) fetchLists()
    }, [])

    useEffect(() => {
        if (id) {
            fetchListItems(id)
            window.scrollTo(0, 0)
        }
    }, [id])

    // Fetch Open Library covers for book items that have no image
    useEffect(() => {
        if (!list || list.type !== 'book') return
        const missing = displayItems.filter(item =>
            !item.metadata?.image && item.enrichment_status === 'completed' && !coverOverrides[item.id]
        )
        if (missing.length === 0) return

        Promise.all(missing.map(async (item) => {
            try {
                const res = await fetch(
                    `https://openlibrary.org/search.json?title=${encodeURIComponent(item.content)}&limit=1&fields=cover_i`,
                    { signal: AbortSignal.timeout(8000) }
                )
                if (!res.ok) return null
                const data = await res.json()
                const coverId = data.docs?.[0]?.cover_i
                if (!coverId) return null
                return [item.id, `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`] as [string, string]
            } catch {
                return null
            }
        })).then(results => {
            const overrides: Record<string, string> = {}
            results.forEach(r => { if (r) overrides[r[0]] = r[1] })
            if (Object.keys(overrides).length > 0) {
                setCoverOverrides(prev => ({ ...prev, ...overrides }))
            }
        })
    }, [displayItems, list?.type])

    // Close sort menu on outside click
    useEffect(() => {
        if (!showSortMenu) return
        const handler = () => setShowSortMenu(false)
        document.addEventListener('click', handler)
        return () => document.removeEventListener('click', handler)
    }, [showSortMenu])

    // Search-filter + baseline sort
    const filteredItems = useMemo(() => {
        let items = displayItems
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            items = items.filter(i =>
                i.content.toLowerCase().includes(q) ||
                i.metadata?.description?.toLowerCase().includes(q) ||
                i.metadata?.subtitle?.toLowerCase().includes(q)
            )
        }
        return sortItems(items, sortOption)
    }, [displayItems, sortOption, searchQuery])

    // Group items into sections by status. Only used when the list has status tracking.
    const sections = useMemo(() => {
        const map: Record<SectionStatus, ListItem[]> = { pending: [], active: [], completed: [] }
        filteredItems.forEach(item => {
            map[sectionForItem(item.status)].push(item)
        })
        return map
    }, [filteredItems])

    const inferredStatus = 'pending' as const

    const handleAddItem = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!inputText.trim() || !id) return

        const content = inputText
        setInputText('')
        inputRef.current?.focus()

        await addListItem({
            list_id: id,
            content,
            status: inferredStatus
        })
    }

    const handleVoiceTranscript = async (text: string) => {
        if (!text.trim() || !id) return
        setIsVoiceMode(false)
        await addListItem({ list_id: id, content: text.trim(), status: inferredStatus })
    }

    const handleStatusChange = useCallback((itemId: string, status: 'active' | 'completed' | 'pending') => {
        updateListItemStatus(itemId, status as any)
    }, [updateListItemStatus])

    // Long-press to pick up on touch; small drag threshold on mouse to preserve clicks.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    )

    const handleDragStart = useCallback((e: DragStartEvent) => {
        setActiveDragId(String(e.active.id))
    }, [])

    const handleDragEnd = useCallback(async (e: DragEndEvent) => {
        setActiveDragId(null)
        if (!id) return
        const { active, over } = e
        if (!over) return
        const activeId = String(active.id)
        const overId = String(over.id)
        if (activeId === overId) return

        const activeItem = displayItems.find(i => i.id === activeId)
        if (!activeItem) return

        // Determine target section — either explicit droppable section id, or infer from target item.
        let targetSection: SectionStatus | null = null
        if (overId.startsWith('section-')) {
            const rest = overId.slice('section-'.length)
            const parsed = rest.replace(/-empty$/, '') as SectionStatus
            if (parsed === 'pending' || parsed === 'active' || parsed === 'completed') {
                targetSection = parsed
            }
        } else {
            const overItem = displayItems.find(i => i.id === overId)
            if (overItem) targetSection = sectionForItem(overItem.status)
        }
        if (!targetSection) return

        // If user reorders manually, switch sort view to manual so the change is visible.
        if (sortOption !== 'manual') setSortOption('manual')

        const sourceSection = sectionForItem(activeItem.status)

        // Cross-section drop → update status first (optimistic via store)
        if (hasStatus && sourceSection !== targetSection) {
            const newStatus: ListItem['status'] = targetSection === 'completed' ? 'completed' : targetSection === 'active' ? 'active' : 'pending'
            await updateListItemStatus(activeId, newStatus)
        }

        // Build the new flat order by inserting active at the overId position within the target section.
        // Work against the currently displayed order (sort-applied).
        const sorted = sortItems(displayItems, sortOption)
        const sectionMap: Record<SectionStatus, ListItem[]> = { pending: [], active: [], completed: [] }
        sorted.forEach(i => {
            const sec = i.id === activeId ? targetSection! : sectionForItem(i.status)
            if (i.id !== activeId) sectionMap[sec].push(i)
        })

        // Find insert index within target section
        const targetIds = sectionMap[targetSection].map(i => i.id)
        let insertAt = targetIds.length
        if (!overId.startsWith('section-')) {
            const idx = targetIds.indexOf(overId)
            if (idx >= 0) insertAt = idx
        }
        sectionMap[targetSection].splice(insertAt, 0, activeItem)

        const flatIds = [
            ...sectionMap.pending,
            ...sectionMap.active,
            ...sectionMap.completed,
        ].map(i => i.id)

        await reorderItems(id, flatIds)
    }, [id, displayItems, hasStatus, sortOption, reorderItems, updateListItemStatus])

    // Mark done -> show celebration
    const handleMarkDone = useCallback((item: ListItem) => {
        updateListItemStatus(item.id, 'completed')
        setCelebrationItem(item)
    }, [updateListItemStatus])

    // Rate an item
    const handleRate = useCallback(async (itemId: string, rating: number) => {
        const item = displayItems.find(i => i.id === itemId)
        if (!item) return
        await updateListItemMetadata(itemId, { ...item.metadata, user_rating: rating })
    }, [displayItems, updateListItemMetadata])

    // Rate from celebration
    const handleCelebrationRate = useCallback(async (rating: number) => {
        if (!celebrationItem) return
        await handleRate(celebrationItem.id, rating)
        setCelebrationItem(null)
        addToast({
            title: 'Rated!',
            description: `Marked ${celebrationItem.content}  ${rating}`,
            variant: 'success'
        })
    }, [celebrationItem, handleRate, addToast])

    const sectionCounts = useMemo(() => ({
        pending: sections.pending.length,
        active: sections.active.length,
        completed: sections.completed.length,
    }), [sections])

    if (!list) {
        return (
            <div className="min-h-screen bg-black pt-24 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="shimmer h-8 w-32 rounded-xl mb-8" />
                    <div className="shimmer h-12 w-64 rounded-lg mb-6" />
                    <div className="flex flex-wrap gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="shimmer h-48 rounded-2xl" style={{ width: 'calc(50% - 6px)' }} />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Article-type lists get the full reading experience
    if (list.type === 'article') {
        return <ArticleListMode list={list} navigate={navigate} />
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="pt-24 px-4 sm:px-6 lg:px-8 pb-4">
                <Button variant="ghost" onClick={() => navigate('/lists')} className="text-brand-text-muted mb-4 pl-0 hover:text-[var(--brand-text-primary)] hover:bg-transparent">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Collections
                </Button>

                {/* List type header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{
                            backgroundColor: `rgba(${rgb}, 0.1)`,
                            boxShadow: `inset 0 0 0 1px rgba(${rgb}, 0.2)`
                        }}>
                        <ListIcon type={list.type} className="h-3.5 w-3.5" style={{ color: `rgb(${rgb})` }} />
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: `rgb(${rgb})` }}>
                            {list.type}
                        </span>
                    </div>
                    {/* Item count badge */}
                    <div className="px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs font-mono text-brand-text-muted"
                        style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface)' }}>
                        {displayItems.length} {displayItems.length === 1 ? 'item' : 'items'}
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-[var(--brand-text-primary)] mb-1 uppercase tracking-tight italic">{list.title}</h1>
                    <div className="flex items-center gap-2">
                        {/* Sort picker */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowSortMenu(v => !v) }}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all"
                                style={{
                                    borderColor: sortOption !== 'added' ? `rgba(${rgb}, 0.4)` : 'var(--glass-surface-hover)',
                                    color: sortOption !== 'added' ? `rgb(${rgb})` : 'var(--brand-text-muted)',
                                }}
                            >
                                <SortAsc className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {SORT_OPTIONS.find(o => o.value === sortOption)?.label ?? 'Sort'}
                                </span>
                                <ChevronDown className="h-3 w-3" />
                            </button>
                            <AnimatePresence>
                                {showSortMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        onClick={e => e.stopPropagation()}
                                        className="absolute right-0 top-full mt-2 z-20 rounded-2xl py-2 min-w-[160px]"
                                        style={{
                                            backgroundColor: 'var(--glass-surface)',
                                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 20px 40px rgba(0,0,0,0.5)'
                                        }}
                                    >
                                        {SORT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setSortOption(opt.value); setShowSortMenu(false) }}
                                                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--glass-surface)] flex items-center justify-between"
                                                style={{ color: sortOption === opt.value ? `rgb(${rgb})` : 'rgba(255,255,255,0.6)' }}
                                            >
                                                <span className="text-[11px] font-bold uppercase tracking-widest">{opt.label}</span>
                                                {sortOption === opt.value && <Check className="h-3 w-3" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* List settings */}
                        <button
                            onClick={() => setShowListSettings(true)}
                            className="flex items-center justify-center w-7 h-7 rounded-full border transition-all border-[var(--glass-surface-hover)] text-brand-text-muted hover:text-[var(--brand-text-primary)] hover:border-white/20"
                        >
                            <Settings2 className="h-3 w-3" />
                        </button>
                    </div>
                </div>
                {list.description && <p className="text-brand-text-muted max-w-xl mb-2">{list.description}</p>}

                {/* Add Input */}
                <div className="mt-4 mb-5 max-w-2xl">
                        <AnimatePresence mode="wait">
                            {isVoiceMode ? (
                                <motion.div
                                    key="voice-mode"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="backdrop-blur-2xl bg-zinc-900/90 rounded-2xl p-4 shadow-2xl"
                                    style={{ boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.25), 0 25px 50px rgba(0,0,0,0.5)' }}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-brand-primary font-medium">Voice Quick-Add</span>
                                        <button onClick={() => setIsVoiceMode(false)} className="text-brand-text-muted hover:text-[var(--brand-text-primary)] transition-colors">
                                            <MicOff className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <VoiceInput onTranscript={handleVoiceTranscript} autoSubmit={true} autoStart={true} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="text-mode"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="backdrop-blur-2xl bg-zinc-900/60 rounded-2xl p-2 flex items-center gap-2 shadow-2xl transition-all font-mono"
                                    style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover), 0 25px 50px rgba(0,0,0,0.5)' }}
                                >
                                    <form onSubmit={handleAddItem} className="flex-1 flex px-3 text-[var(--brand-text-primary)] items-center gap-2">
                                        <Input
                                            ref={inputRef}
                                            value={inputText}
                                            onChange={e => setInputText(e.target.value)}
                                            placeholder={`Add to ${list.title.toLowerCase()}...`}
                                            className="border-0 bg-transparent focus-visible:ring-0 text-lg text-[var(--brand-text-primary)] placeholder:text-zinc-600 h-12 uppercase tracking-tight"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-2 px-1">
                                            <Button
                                                type="button"
                                                onClick={() => setIsVoiceMode(true)}
                                                className="rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-brand-text-muted hover:text-brand-primary h-10 w-10 p-0 shrink-0 transition-all"
                                                style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface)' }}
                                            >
                                                <Mic className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={!inputText.trim()}
                                                className="rounded-xl bg-white text-black hover:bg-zinc-200 h-10 px-4 gap-2 font-bold shrink-0 transition-all uppercase text-xs tracking-widest"
                                            >
                                                <span>Add</span>
                                                <Send className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
            </div>

            {/* Search bar - show toggle when 10+ items, or when user has activated it */}
            {displayItems.length > 0 && (
                <div className="px-4 sm:px-6 lg:px-8 max-w-5xl">
                    {(showSearch || displayItems.length >= 10) && (
                        <div className="relative mb-4">
                            <div className="flex items-center gap-2 bg-zinc-900/60 backdrop-blur-xl rounded-xl px-3 py-2"
                                style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)' }}>
                                <Search className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search items..."
                                    className="flex-1 bg-transparent text-sm text-[var(--brand-text-primary)] placeholder:text-zinc-600 focus:outline-none uppercase tracking-tight font-medium"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="h-5 w-5 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-[var(--brand-text-primary)] transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {displayItems.length < 10 && !showSearch && (
                        <button
                            onClick={() => setShowSearch(true)}
                            className="mb-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--glass-surface-hover)] text-brand-text-muted hover:text-[var(--brand-text-primary)] hover:border-white/20 transition-all"
                        >
                            <Search className="h-3 w-3" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Search</span>
                        </button>
                    )}
                </div>
            )}

            {/* Items Grid — sections per status, with long-press reorder */}
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-48 max-w-5xl">
                {filteredItems.length === 0 && loading && !hasCachedItems ? (
                    <div className="flex flex-wrap gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="shimmer h-48 rounded-2xl" style={{ width: 'calc(50% - 6px)' }} />
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 text-zinc-600">
                        <p className="text-brand-text-muted font-medium text-lg mb-1">
                            {searchQuery.trim() ? 'No matches.' : 'Nothing in here yet.'}
                        </p>
                        {!searchQuery.trim() && (
                            <p className="text-sm text-brand-text-muted opacity-60">Start adding things above.</p>
                        )}
                    </div>
                ) : list.type === 'quote' ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={filteredItems.map(i => i.id)} strategy={rectSortingStrategy}>
                            <div className="flex flex-col gap-8 max-w-3xl mx-auto">
                                {filteredItems.map((item) => (
                                    <SortableQuote
                                        key={item.id}
                                        item={item}
                                        isExpanded={expandedItemId === item.id}
                                        onItemClick={(itemId) => setExpandedItemId(expandedItemId === itemId ? null : itemId)}
                                        onDelete={handleDeleteItem}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                        <DragOverlay dropAnimation={null} />
                    </DndContext>
                ) : !hasStatus ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={filteredItems.map(i => i.id)} strategy={rectSortingStrategy}>
                            <MasonryListGrid
                                items={filteredItems}
                                listType={list.type}
                                expandedItemId={expandedItemId}
                                onItemClick={(itemId) => setExpandedItemId(expandedItemId === itemId ? null : itemId)}
                                onDelete={handleDeleteItem}
                                onStatusChange={handleStatusChange}
                                onRate={handleRate}
                                onMarkDone={handleMarkDone}
                                rgb={rgb}
                                thoughtCapturedIds={thoughtCapturedIds}
                                hasStatus={hasStatus}
                                coverOverrides={coverOverrides}
                            />
                        </SortableContext>
                        <DragOverlay dropAnimation={null} />
                    </DndContext>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex flex-col gap-10">
                            {SECTION_ORDER.map(status => {
                                const sectionItems = sections[status]
                                if (sectionItems.length === 0 && status !== 'pending') return null
                                return (
                                    <SectionBlock
                                        key={status}
                                        status={status}
                                        label={statusLabels[status]}
                                        count={sectionCounts[status]}
                                        rgb={rgb}
                                    >
                                        <SortableContext items={sectionItems.map(i => i.id)} strategy={rectSortingStrategy}>
                                            {sectionItems.length > 0 ? (
                                                <MasonryListGrid
                                                    items={sectionItems}
                                                    listType={list.type}
                                                    expandedItemId={expandedItemId}
                                                    onItemClick={(itemId) => setExpandedItemId(expandedItemId === itemId ? null : itemId)}
                                                    onDelete={handleDeleteItem}
                                                    onStatusChange={handleStatusChange}
                                                    onRate={handleRate}
                                                    onMarkDone={handleMarkDone}
                                                    rgb={rgb}
                                                    thoughtCapturedIds={thoughtCapturedIds}
                                                    hasStatus={hasStatus}
                                                    coverOverrides={coverOverrides}
                                                />
                                            ) : (
                                                <EmptySectionDropzone status={status} label={statusLabels[status]} rgb={rgb} />
                                            )}
                                        </SortableContext>
                                    </SectionBlock>
                                )
                            })}
                        </div>
                        <DragOverlay dropAnimation={null}>
                            {activeDragId ? (() => {
                                const item = displayItems.find(i => i.id === activeDragId)
                                return item ? (
                                    <div className="rotate-1 scale-105 opacity-90">
                                        <StandardItemCard
                                            item={item}
                                            listType={list.type}
                                            isExpanded={false}
                                            onItemClick={() => {}}
                                            onDelete={() => {}}
                                            onRate={() => {}}
                                            onMarkDone={() => {}}
                                            rgb={rgb}
                                            hasStatus={hasStatus}
                                            coverOverride={coverOverrides[item.id]}
                                        />
                                    </div>
                                ) : null
                            })() : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {confirmDialog}

            {/* List Settings Panel */}
            <BottomSheet open={showListSettings} onOpenChange={setShowListSettings}>
                <BottomSheetContent>
                    <BottomSheetHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <Settings2 className="h-5 w-5" style={{ color: `rgb(${rgb})` }} />
                            <BottomSheetTitle>Collection Settings</BottomSheetTitle>
                        </div>
                    </BottomSheetHeader>
                    <div className="mt-6 space-y-6">
                        {/* Editable title and description */}
                        <div>
                            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest mb-3">Collection Info</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-1 block">Title</label>
                                    <input
                                        type="text"
                                        defaultValue={list?.title || ''}
                                        key={`title-${list?.id}`}
                                        onBlur={(e) => {
                                            const val = e.target.value.trim()
                                            if (val && val !== list?.title && list) {
                                                updateList(list.id, { title: val })
                                            }
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                        className="w-full bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-lg px-3 py-2 text-sm text-[var(--brand-text-primary)] focus:outline-none focus:border-white/30 transition-colors uppercase tracking-tight font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-1 block">Description</label>
                                    <textarea
                                        defaultValue={list?.description || ''}
                                        key={`desc-${list?.id}`}
                                        onBlur={(e) => {
                                            const val = e.target.value.trim()
                                            if (list && val !== (list.description || '')) {
                                                updateList(list.id, { description: val || undefined })
                                            }
                                        }}
                                        rows={2}
                                        className="w-full bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-lg px-3 py-2 text-sm text-[var(--brand-text-primary)] focus:outline-none focus:border-white/30 transition-colors resize-none"
                                        placeholder="Add a description..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status tracking toggle */}
                        <div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-[var(--brand-text-primary)] uppercase tracking-widest">Progress Tracking</p>
                                    <p className="text-xs text-brand-text-muted mt-0.5">
                                        {hasStatus ? 'Items have a status you can advance' : 'Collection only — no status on items'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (list) updateListSettings(list.id, { status_enabled: !hasStatus })
                                    }}
                                    className="transition-colors"
                                    style={{ color: hasStatus ? `rgb(${rgb})` : 'rgba(255,255,255,0.25)' }}
                                >
                                    {hasStatus
                                        ? <ToggleRight className="h-8 w-8" />
                                        : <ToggleLeft className="h-8 w-8" />
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Custom status labels — only shown when status is enabled */}
                        {hasStatus && (
                            <div>
                                <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest mb-3">Status Labels</p>
                                <div className="space-y-2">
                                    {(['pending', 'active', 'completed'] as const).map(key => (
                                        <div key={key} className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted w-20 flex-shrink-0">
                                                {key === 'pending' ? 'Backlog' : key === 'active' ? 'In Progress' : 'Done'}
                                            </span>
                                            <input
                                                type="text"
                                                defaultValue={statusLabels[key]}
                                                key={`${list?.id}-${key}`}
                                                onBlur={(e) => {
                                                    const val = e.target.value.trim()
                                                    if (val && val !== statusLabels[key] && list) {
                                                        updateListSettings(list.id, {
                                                            status_labels: {
                                                                ...list.settings?.status_labels,
                                                                [key]: val
                                                            }
                                                        })
                                                    }
                                                }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                                className="flex-1 bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-lg px-3 py-2 text-sm text-[var(--brand-text-primary)] focus:outline-none focus:border-white/30 transition-colors"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-brand-text-muted mt-3 opacity-60">Tap a label to edit. Press Enter or tap away to save.</p>
                            </div>
                        )}
                    </div>
                </BottomSheetContent>
            </BottomSheet>

            {/* Completion celebration */}
            <AnimatePresence>
                {celebrationItem && (
                    <CompletionCelebration
                        item={celebrationItem}
                        listType={list?.type || 'generic'}
                        onRate={handleCelebrationRate}
                        onClose={() => setCelebrationItem(null)}
                    />
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-48">
                <div className="mt-12 pt-12 border-t border-[var(--glass-surface)] pb-20">
                    <ItemInsightStrip title={list.title} itemId={list.id} itemType="list" />
                </div>
            </div>
        </div>
    )
}
