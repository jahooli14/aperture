import React, { useEffect, useState, useRef, useMemo, memo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft, Send, Trash2, Mic, MicOff, ListOrdered, Check, GripVertical,
    Film, Music, Book, MapPin, Box, Quote, Pencil, Monitor, Gamepad2, Calendar,
    Star, SortAsc, ChevronDown, Copy
} from 'lucide-react'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { VoiceInput } from '../components/VoiceInput'
import { OptimizedImage } from '../components/ui/optimized-image'
import { Reorder } from 'framer-motion'
import type { ListItem, ListType } from '../types'
import { useToast } from '../components/ui/toast'

// ============================================================================
// Color / Icon helpers (duplicated from ListsPage to keep files self-contained)
// ============================================================================

const ListColor = (type: ListType) => {
    switch (type) {
        case 'film': return '239, 68, 68'
        case 'music': return '236, 72, 153'
        case 'tech': return '59, 130, 246'
        case 'book': return '245, 158, 11'
        case 'place': return '16, 185, 129'
        case 'game': return '139, 92, 246'
        case 'quote': return '167, 139, 250'
        case 'event': return '251, 146, 60'
        case 'software': return '34, 211, 238'
        default: return '148, 163, 184'
    }
}

const ListIcon = ({ type, className, style }: { type: ListType, className?: string, style?: React.CSSProperties }) => {
    switch (type) {
        case 'film': return <Film className={className} style={style} />
        case 'music': return <Music className={className} style={style} />
        case 'tech': return <Monitor className={className} style={style} />
        case 'book': return <Book className={className} style={style} />
        case 'place': return <MapPin className={className} style={style} />
        case 'game': return <Gamepad2 className={className} style={style} />
        case 'software': return <Box className={className} style={style} />
        case 'event': return <Calendar className={className} style={style} />
        case 'quote': return <Quote className={className} style={style} />
        default: return <Box className={className} style={style} />
    }
}

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
                                fill: filled ? '#f59e0b' : 'transparent',
                                color: filled ? '#f59e0b' : 'rgba(255,255,255,0.15)',
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
    onRate,
    onClose
}: {
    item: ListItem
    onRate: (rating: number) => void
    onClose: () => void
}) => {
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
                    backgroundColor: '#141f32',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 40px 80px rgba(0,0,0,0.6)'
                }}
            >
                {/* Celebration burst */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="text-5xl mb-4"
                >
                    ✓
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
                            onClick={() => onRate(star)}
                            className="p-2 rounded-xl transition-all hover:scale-110 hover:bg-amber-500/10"
                        >
                            <Star className="h-7 w-7 text-amber-400/40 hover:text-amber-400 hover:fill-amber-400 transition-all" />
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="text-[11px] font-bold text-[var(--brand-text-primary)]/30 uppercase tracking-widest hover:text-[var(--brand-text-primary)]/60 transition-colors"
                >
                    Skip rating
                </button>
            </motion.div>
        </motion.div>
    )
}

// ============================================================================
// Status tab labels per list type
// ============================================================================

type StatusFilter = 'all' | 'pending' | 'active' | 'completed'

const getStatusLabels = (listType: string): Record<StatusFilter, string> => {
    switch (listType) {
        case 'film':
        case 'movie':
        case 'show':
        case 'tv':
            return { all: 'All', pending: 'Want to Watch', active: 'Watching', completed: 'Watched' }
        case 'book':
            return { all: 'All', pending: 'Want to Read', active: 'Reading', completed: 'Read' }
        case 'music':
            return { all: 'All', pending: 'Want to Listen', active: 'Listening', completed: 'Listened' }
        case 'game':
            return { all: 'All', pending: 'Want to Play', active: 'Playing', completed: 'Played' }
        case 'place':
            return { all: 'All', pending: 'Want to Visit', active: 'Been Once', completed: 'Visited' }
        default:
            return { all: 'All', pending: 'Pending', active: 'In Progress', completed: 'Done' }
    }
}

// ============================================================================
// Sort options
// ============================================================================

type SortOption = 'added' | 'rating' | 'status' | 'alpha'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'added', label: 'Date Added' },
    { value: 'rating', label: 'Rating' },
    { value: 'status', label: 'Status' },
    { value: 'alpha', label: 'A–Z' },
]

function sortItems(items: ListItem[], sort: SortOption): ListItem[] {
    const copy = [...items]
    switch (sort) {
        case 'added':
            return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        case 'rating':
            return copy.sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0))
        case 'status': {
            const order: Record<string, number> = { active: 0, pending: 1, completed: 2, abandoned: 3 }
            return copy.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4))
        }
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
    { primary: 'violet', gradient: 'from-violet-500/20 via-fuchsia-500/10 to-purple-500/20', rgb: '139, 92, 246' },
    { primary: 'cyan', gradient: 'from-cyan-500/20 via-blue-500/10 to-sky-500/20', rgb: '6, 182, 212' },
    { primary: 'rose', gradient: 'from-rose-500/20 via-pink-500/10 to-red-500/20', rgb: '244, 63, 94' },
    { primary: 'amber', gradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/20', rgb: '245, 158, 11' },
    { primary: 'emerald', gradient: 'from-emerald-500/20 via-teal-500/10 to-green-500/20', rgb: '16, 185, 129' }
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
        0: 'from-zinc-900/90 via-purple-950/20 to-zinc-900/90',
        1: 'from-zinc-900/90 via-cyan-950/20 to-zinc-900/90',
        2: 'from-zinc-900/90 via-rose-950/20 to-zinc-900/90',
        3: 'from-zinc-900/90 via-amber-950/20 to-zinc-900/90',
        4: 'from-zinc-900/90 via-emerald-950/20 to-zinc-900/90',
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
                    <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-cyan-500/10 rounded-tr-3xl" />
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
                                    className="rounded px-3 py-1 text-sm text-[var(--brand-text-primary)]/90 focus:outline-none appearance-none"
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
                                <button onClick={handleSaveAuthor} className="p-1.5 rounded bg-[rgba(255,255,255,0.1)] hover:bg-white/20 transition-colors">
                                    <Check className="h-3.5 w-3.5 text-[var(--brand-text-primary)]/70" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className={`text-sm font-medium tracking-wider ${variant === 2 ? 'italic' : ''}`}
                                    style={{ color: `rgba(${attributionColors[variant]}, 0.7)` }}>
                                    {variant === 3 ? '~' : '—'} {item.metadata?.specs?.Author || item.metadata?.specs?.Source || item.metadata?.subtitle || 'Me'}
                                </p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsEditingAuthor(true) }}
                                    className="p-1.5 rounded bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] opacity-0 group-hover/author:opacity-100 transition-all"
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
                            className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.08)] space-y-4"
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
                        className="p-2.5 rounded-xl bg-zinc-900/50 backdrop-blur-sm border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.1)] text-zinc-500 hover:text-[var(--brand-text-primary)] opacity-0 group-hover:opacity-100 transition-all duration-300"
                        aria-label="Copy quote"
                    >
                        <Copy className="h-4 w-4" />
                    </button>

                    {/* Delete */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.list_id) }}
                        className="p-2.5 rounded-xl bg-zinc-900/50 backdrop-blur-sm border hover:bg-red-500/20 hover:border-red-500/40 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300"
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
    rgb
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
}) => {
    const hasImage = item.metadata?.image
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

    // Status ring color
    const statusColor = item.status === 'completed'
        ? '16, 185, 129'
        : item.status === 'active'
            ? rgb
            : '255, 255, 255'

    const statusOpacity = item.status === 'pending' ? '0.2' : '0.7'

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
                        src={item.metadata.image}
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
                <div className="relative aspect-square bg-zinc-900 border border-[rgba(255,255,255,0.05)] overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-10"
                        style={{ background: `linear-gradient(135deg, rgb(${rgb}), transparent)` }}
                    />
                    <div className="relative z-10 flex flex-col items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                        <div className="h-8 w-8 rounded-full border border-white/20 flex items-center justify-center">
                            <ListIcon type={listType as ListType} className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
            )}

            {/* Content overlay */}
            <div className="absolute inset-0 p-3 flex flex-col justify-end">
                {/* Status toggle circle */}
                <div className="flex items-start gap-2 mb-1">
                    <button
                        onClick={handleStatusCycle}
                        className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
                        style={{
                            borderColor: `rgba(${statusColor}, ${statusOpacity})`,
                            backgroundColor: isCompleted ? `rgba(${statusColor}, 0.2)` : 'transparent'
                        }}
                    >
                        {isCompleted && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                        {item.status === 'active' && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `rgb(${rgb})` }} />
                        )}
                    </button>
                    <h3 className={`text-[var(--brand-text-primary)] font-bold leading-tight group-hover:text-sky-400 transition-colors uppercase tracking-tight drop-shadow-lg text-xs mb-1 ${isCompleted ? 'line-through opacity-50' : ''}`}>
                        {item.content}
                    </h3>
                </div>

                {/* Rating stars */}
                {(item.user_rating || isExpanded) && (
                    <div className="mb-1 pl-6">
                        <StarRating
                            rating={item.user_rating}
                            onRate={(r) => onRate(item.id, r)}
                            size="sm"
                        />
                    </div>
                )}

                {/* Key metadata on expanded */}
                {isExpanded && (
                    <div className="pl-6 space-y-1 backdrop-blur-sm bg-black/30 p-2 rounded-lg border border-[rgba(255,255,255,0.08)]">
                        {item.metadata?.subtitle && (
                            <p className="text-zinc-300 text-[10px] italic leading-relaxed">{item.metadata.subtitle}</p>
                        )}
                        {item.metadata?.description && (
                            <p className="text-zinc-400 text-[10px] leading-relaxed line-clamp-3">{item.metadata.description}</p>
                        )}
                        {item.metadata?.specs && (
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(item.metadata.specs).slice(0, 3).map(([key, value]) => (
                                    <div key={key} className="flex items-baseline gap-1">
                                        <span className="text-[8px] uppercase font-bold text-zinc-500">{key}:</span>
                                        <span className="text-[9px] text-zinc-300">{value as string}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Show year / author / director from metadata root */}
                        {(item.metadata?.year || item.metadata?.author || item.metadata?.director || item.metadata?.genre) && (
                            <div className="flex flex-wrap gap-2">
                                {item.metadata.year && (
                                    <span className="text-[9px] text-zinc-400">{item.metadata.year}</span>
                                )}
                                {item.metadata.author && (
                                    <span className="text-[9px] text-zinc-400">{item.metadata.author}</span>
                                )}
                                {item.metadata.director && (
                                    <span className="text-[9px] text-zinc-400">dir. {item.metadata.director}</span>
                                )}
                                {item.metadata.genre && (
                                    <span className="text-[9px] bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded text-zinc-400">{item.metadata.genre}</span>
                                )}
                            </div>
                        )}
                        {item.metadata?.tags && item.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {item.metadata.tags.slice(0, 3).map((tag: string) => (
                                    <span key={tag} className="text-[8px] bg-sky-500/20 border border-sky-500/30 px-1.5 py-0.5 rounded text-sky-300 font-medium">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        {item.metadata?.link && (
                            <a
                                href={item.metadata.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-bold text-sky-400 hover:text-[var(--brand-text-primary)] transition-colors uppercase tracking-widest flex items-center gap-1 mt-1"
                                onClick={e => e.stopPropagation()}
                            >
                                Details →
                            </a>
                        )}
                    </div>
                )}

                {/* Enriching status */}
                {!isExpanded && item.enrichment_status === 'pending' && (
                    <div className="flex items-center gap-1 text-[9px] text-sky-400 font-bold animate-pulse pl-6">
                        <div className="h-1 w-1 rounded-full bg-sky-400" />
                        Enriching...
                    </div>
                )}
            </div>

            {/* Quick actions on hover */}
            <div className="absolute top-2 right-2 flex gap-1 transform translate-y-[-120%] group-hover:translate-y-0 transition-transform duration-300">
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.list_id) }}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500/50 hover:text-[var(--brand-text-primary)] backdrop-blur-md border border-red-500/20 transition-all"
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

function MasonryListGrid({
    items,
    listType,
    expandedItemId,
    onItemClick,
    onDelete,
    onStatusChange,
    onRate,
    onMarkDone,
    rgb
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
}) {
    const [columns, setColumns] = useState(2)

    useEffect(() => {
        const update = () => { if (window.innerWidth >= 1024) setColumns(3); else setColumns(2) }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    const distributedColumns = useMemo(() => {
        const cols: ListItem[][] = Array.from({ length: columns }, () => [])
        items.forEach((item, i) => { cols[i % columns].push(item) })
        return cols
    }, [items, columns])

    const isQuoteType = listType === 'quote'

    if (isQuoteType) {
        return (
            <div className="flex flex-col gap-8 max-w-3xl mx-auto">
                {items.map((item) => (
                    <QuoteCard
                        key={item.id}
                        item={item}
                        isExpanded={expandedItemId === item.id}
                        onItemClick={onItemClick}
                        onDelete={onDelete}
                        onCopy={(text) => {
                            navigator.clipboard?.writeText(text).catch(() => {})
                        }}
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="flex gap-3 items-start w-full">
            {distributedColumns.map((colItems, colIndex) => (
                <div key={colIndex} className="flex-1 flex flex-col gap-3 min-w-0">
                    {colItems.map((item) => (
                        <StandardItemCard
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
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

// ============================================================================
// Main Page
// ============================================================================

export default function ListDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { lists, currentListItems, currentListId, loading, fetchListItems, addListItem, fetchLists, deleteListItem, reorderItems, updateListItemStatus, updateListItemMetadata } = useListStore()
    const { addToast } = useToast()

    const list = lists.find(l => l.id === id)

    const isCorrectList = currentListId === id
    const displayItems = isCorrectList ? currentListItems : []

    const [inputText, setInputText] = useState('')
    const [connectionCount, setConnectionCount] = useState(0)
    const [isLoadingConnections, setIsLoadingConnections] = useState(true)
    const [isVoiceMode, setIsVoiceMode] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [sortOption, setSortOption] = useState<SortOption>('added')
    const [showSortMenu, setShowSortMenu] = useState(false)
    const [celebrationItem, setCelebrationItem] = useState<ListItem | null>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    const rgb = list ? ListColor(list.type) : '148, 163, 184'
    const statusLabels = list ? getStatusLabels(list.type) : getStatusLabels('generic')

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

    // Close sort menu on outside click
    useEffect(() => {
        if (!showSortMenu) return
        const handler = () => setShowSortMenu(false)
        document.addEventListener('click', handler)
        return () => document.removeEventListener('click', handler)
    }, [showSortMenu])

    // Filter + sort items
    const filteredItems = useMemo(() => {
        let items = displayItems
        if (statusFilter !== 'all') {
            items = items.filter(i => i.status === statusFilter)
        }
        return sortItems(items, sortOption)
    }, [displayItems, statusFilter, sortOption])

    const handleAddItem = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!inputText.trim() || !id) return

        const content = inputText
        setInputText('')
        inputRef.current?.focus()

        await addListItem({
            list_id: id,
            content,
            status: 'pending'
        })
    }

    const handleVoiceTranscript = async (text: string) => {
        if (!text.trim() || !id) return
        setIsVoiceMode(false)
        await addListItem({ list_id: id, content: text.trim(), status: 'pending' })
    }

    const handleReorder = async (newItems: ListItem[]) => {
        if (!id) return
        await reorderItems(id, newItems.map(item => item.id))
    }

    const handleStatusChange = useCallback((itemId: string, status: 'active' | 'completed' | 'pending') => {
        updateListItemStatus(itemId, status as any)
    }, [updateListItemStatus])

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
            description: `Marked ${celebrationItem.content} — ${rating}★`,
            variant: 'success'
        })
    }, [celebrationItem, handleRate, addToast])

    // Count per status tab
    const counts = useMemo(() => ({
        all: displayItems.length,
        pending: displayItems.filter(i => i.status === 'pending').length,
        active: displayItems.filter(i => i.status === 'active').length,
        completed: displayItems.filter(i => i.status === 'completed').length,
    }), [displayItems])

    if (!list) {
        return (
            <div className="min-h-screen bg-black pt-24 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="shimmer h-8 w-32 rounded mb-8" />
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

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="pt-24 px-4 sm:px-6 lg:px-8 pb-4">
                <Button variant="ghost" onClick={() => navigate('/lists')} className="text-zinc-400 mb-4 pl-0 hover:text-[var(--brand-text-primary)] hover:bg-transparent">
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
                    <div className="px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs font-mono text-zinc-400"
                        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
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
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[rgba(255,255,255,0.08)] text-zinc-500 hover:text-[var(--brand-text-primary)] hover:border-white/20 transition-all"
                            >
                                <SortAsc className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Sort</span>
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
                                            backgroundColor: '#1a2540',
                                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 20px 40px rgba(0,0,0,0.5)'
                                        }}
                                    >
                                        {SORT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setSortOption(opt.value); setShowSortMenu(false) }}
                                                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)] flex items-center justify-between"
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

                        {/* Reorder toggle */}
                        <button
                            onClick={() => setIsReordering(!isReordering)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${isReordering ? 'bg-sky-500 border-sky-400 text-[var(--brand-text-primary)]' : 'border-[rgba(255,255,255,0.08)] text-zinc-500 hover:text-[var(--brand-text-primary)] hover:border-white/20'}`}
                        >
                            {isReordering ? <Check className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">{isReordering ? 'Done' : 'Order'}</span>
                        </button>
                    </div>
                </div>
                {list.description && <p className="text-zinc-500 max-w-xl mb-2">{list.description}</p>}

                {/* Status Filter Tabs */}
                {!isReordering && list.type !== 'quote' && displayItems.length > 0 && (
                    <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                        {(['all', 'pending', 'active', 'completed'] as StatusFilter[]).map(tab => {
                            const isActive = statusFilter === tab
                            const count = counts[tab]
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setStatusFilter(tab)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0"
                                    style={{
                                        backgroundColor: isActive ? `rgba(${rgb}, 0.15)` : 'rgba(255,255,255,0.03)',
                                        boxShadow: isActive
                                            ? `inset 0 0 0 1px rgba(${rgb}, 0.35)`
                                            : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                                        color: isActive ? `rgb(${rgb})` : 'rgba(255,255,255,0.35)'
                                    }}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest">{statusLabels[tab]}</span>
                                    {count > 0 && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: isActive ? `rgba(${rgb}, 0.2)` : 'rgba(255,255,255,0.06)',
                                                color: isActive ? `rgb(${rgb})` : 'rgba(255,255,255,0.25)'
                                            }}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Add Input */}
                {!isReordering && (
                    <div className="mt-6 mb-10 max-w-2xl">
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
                                        <span className="text-sm text-sky-400 font-medium">Voice Quick-Add</span>
                                        <button onClick={() => setIsVoiceMode(false)} className="text-zinc-500 hover:text-[var(--brand-text-primary)] transition-colors">
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
                                    style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 25px 50px rgba(0,0,0,0.5)' }}
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
                                                className="rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 h-10 w-10 p-0 shrink-0 transition-all"
                                                style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
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
                )}
            </div>

            {/* Items Grid */}
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-48 max-w-5xl">
                <AnimatePresence mode="wait">
                    {isReordering ? (
                        <motion.div key="reorder-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Reorder.Group axis="y" values={displayItems} onReorder={handleReorder} className="space-y-2">
                                {displayItems.map((item) => (
                                    <Reorder.Item
                                        key={item.id}
                                        value={item}
                                        className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-xl cursor-grab active:cursor-grabbing hover:bg-zinc-900/60 transition-all"
                                        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
                                    >
                                        <GripVertical className="h-4 w-4 text-zinc-600" />
                                        {item.metadata?.image && (
                                            <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
                                                <OptimizedImage
                                                    src={item.metadata.image}
                                                    alt={item.content}
                                                    className="w-full h-full"
                                                    aspectRatio="1/1"
                                                    priority={false}
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[var(--brand-text-primary)] font-bold uppercase tracking-tight truncate">{item.content}</p>
                                            {item.metadata?.subtitle && (
                                                <p className="text-[10px] text-zinc-500 italic truncate">{item.metadata.subtitle}</p>
                                            )}
                                        </div>
                                        {item.user_rating && (
                                            <StarRating rating={item.user_rating} readonly size="sm" />
                                        )}
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        </motion.div>
                    ) : (
                        <motion.div key="masonry-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {filteredItems.length > 0 ? (
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
                                />
                            ) : loading ? (
                                <div className="flex flex-wrap gap-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="shimmer h-48 rounded-2xl" style={{ width: 'calc(50% - 6px)' }} />
                                    ))}
                                </div>
                            ) : statusFilter !== 'all' ? (
                                <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                                    <p className="text-zinc-500 font-medium text-base mb-1">Nothing here yet.</p>
                                    <p className="text-sm text-zinc-600">
                                        No items with status "{statusLabels[statusFilter]}"
                                    </p>
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className="mt-4 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-[var(--brand-text-primary)] transition-colors"
                                    >
                                        Show all →
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-40 text-zinc-600">
                                    <p className="text-zinc-500 font-medium text-lg mb-1">Your collection is empty.</p>
                                    <p className="text-sm text-zinc-500 opacity-60">Begin typing above to curate your list.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {confirmDialog}

            {/* Completion celebration */}
            <AnimatePresence>
                {celebrationItem && (
                    <CompletionCelebration
                        item={celebrationItem}
                        onRate={handleCelebrationRate}
                        onClose={() => setCelebrationItem(null)}
                    />
                )}
            </AnimatePresence>

            {/* Smart Connections Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-48">
                {(connectionCount > 0 || isLoadingConnections) && (
                    <div className="mt-12 pt-12 border-t border-[rgba(255,255,255,0.05)] pb-20">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)]">Synthesized Insights</h3>
                                <p className="text-sm text-zinc-500">Connections discovered by the Aperture Engine.</p>
                            </div>
                            <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400">
                                AI Connected
                            </div>
                        </div>
                        <ConnectionsList
                            itemType="list"
                            itemId={list.id}
                            content={`${list.title} ${list.description || ''} ${displayItems.map(i => i.content).join(', ')}`}
                            onCountChange={setConnectionCount}
                            onLoadingChange={setIsLoadingConnections}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
