import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'
import { Button } from '../components/ui/button'
import { OptimizedImage } from '../components/ui/optimized-image'
import { ListIcon, ListColor } from '../lib/listTheme'
import type { ListItem, ListType } from '../types'

type FavouriteItem = ListItem & {
    list: { id: string; title: string; type: ListType }
}

const TYPE_LABEL: Record<string, string> = {
    film: 'Films',
    movie: 'Films',
    show: 'Shows',
    tv: 'Shows',
    book: 'Books',
    article: 'Articles',
    music: 'Music',
    game: 'Games',
    place: 'Places',
    quote: 'Quotes',
    event: 'Events',
    software: 'Software',
    tech: 'Tech',
    generic: 'Other',
}

const isPosterType = (type: string) =>
    type === 'book' || type === 'film' || type === 'movie' || type === 'show' || type === 'tv'

function FavouriteCard({ item, onClick }: { item: FavouriteItem; onClick: () => void }) {
    const poster = isPosterType(item.list.type)
    const img = item.metadata?.image
    const rgb = ListColor(item.list.type)

    return (
        <button
            onClick={onClick}
            className="group relative overflow-hidden rounded-xl text-left hover:scale-[1.02] transition-all duration-300 break-inside-avoid"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
        >
            {img ? (
                <div className={`relative ${poster ? 'aspect-[2/3]' : 'aspect-square'} overflow-hidden`}>
                    <OptimizedImage
                        src={img}
                        alt={item.content}
                        className="w-full h-full"
                        aspectRatio={poster ? '2/3' : '1/1'}
                        priority={false}
                        sizes="(max-width: 768px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                </div>
            ) : (
                <div
                    className="relative aspect-square overflow-hidden"
                    style={{ background: `linear-gradient(145deg, #0f172a, #1e293b)` }}
                >
                    <div
                        className="absolute inset-0"
                        style={{ background: `radial-gradient(ellipse at 30% 30%, rgba(${rgb}, 0.18) 0%, transparent 70%)` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
                        <ListIcon type={item.list.type} className="h-24 w-24" style={{ color: `rgb(${rgb})` }} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                </div>
            )}

            <div className="absolute inset-0 p-3 flex flex-col justify-end">
                <h3 className="text-[var(--brand-text-primary)] font-bold leading-tight uppercase tracking-tight text-sm mb-1 line-clamp-2"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)' }}>
                    {item.content}
                </h3>
                <p className="text-[10px] uppercase tracking-widest mb-1.5 truncate font-semibold"
                    style={{ color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {item.list.title}
                </p>
                <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                        <Star
                            key={s}
                            className="h-3.5 w-3.5"
                            style={{
                                fill: (item.user_rating ?? 0) >= s ? `rgb(${rgb})` : 'transparent',
                                color: (item.user_rating ?? 0) >= s ? `rgb(${rgb})` : 'rgba(255,255,255,0.3)',
                                filter: (item.user_rating ?? 0) >= s ? `drop-shadow(0 0 4px rgba(${rgb}, 0.6))` : undefined,
                            }}
                        />
                    ))}
                </div>
            </div>
        </button>
    )
}

function MasonryGroup({ items, onItemClick }: { items: FavouriteItem[]; onItemClick: (i: FavouriteItem) => void }) {
    const [columns, setColumns] = useState(2)

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth
            if (w < 640) setColumns(2)
            else if (w < 1024) setColumns(3)
            else setColumns(4)
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    const distributed = useMemo(() => {
        const cols: FavouriteItem[][] = Array.from({ length: columns }, () => [])
        items.forEach((item, i) => cols[i % columns].push(item))
        return cols
    }, [items, columns])

    return (
        <div className="flex gap-3 items-start w-full">
            {distributed.map((col, i) => (
                <div key={i} className="flex-1 flex flex-col gap-3 min-w-0">
                    {col.map(item => (
                        <FavouriteCard key={item.id} item={item} onClick={() => onItemClick(item)} />
                    ))}
                </div>
            ))}
        </div>
    )
}

export default function FavouritesPage() {
    const navigate = useNavigate()
    const [items, setItems] = useState<FavouriteItem[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setError(null)
        fetch('/api/lists?scope=items&resource=favourites')
            .then(async r => {
                if (!r.ok) throw new Error(`Failed (${r.status})`)
                return r.json()
            })
            .then(data => { if (!cancelled) setItems(data as FavouriteItem[]) })
            .catch(e => { if (!cancelled) setError(e.message) })
        return () => { cancelled = true }
    }, [])

    // Group items by a canonical type bucket (films/shows unified visually by the label map).
    const grouped = useMemo(() => {
        if (!items) return []
        const map = new Map<string, FavouriteItem[]>()
        items.forEach(item => {
            const bucket = TYPE_LABEL[item.list.type] ?? 'Other'
            const arr = map.get(bucket) ?? []
            arr.push(item)
            map.set(bucket, arr)
        })
        return Array.from(map.entries())
    }, [items])

    return (
        <div className="min-h-screen bg-black flex flex-col">
            <div className="pt-24 px-4 sm:px-6 lg:px-8 pb-4 max-w-5xl">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/lists')}
                    className="text-brand-text-muted mb-4 pl-0 hover:text-[var(--brand-text-primary)] hover:bg-transparent"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Collections
                </Button>

                <div className="flex items-center gap-3 mb-3">
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{
                            backgroundColor: 'rgba(var(--brand-primary-rgb), 0.1)',
                            boxShadow: 'inset 0 0 0 1px rgba(var(--brand-primary-rgb), 0.2)',
                        }}
                    >
                        <Star className="h-3.5 w-3.5" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                        <span
                            className="text-[9px] font-black uppercase tracking-widest"
                            style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                        >
                            Favourites
                        </span>
                    </div>
                    {items && (
                        <div
                            className="px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs font-mono text-brand-text-muted"
                            style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface)' }}
                        >
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                        </div>
                    )}
                </div>

                <h1 className="text-3xl font-bold text-[var(--brand-text-primary)] mb-1 uppercase tracking-tight italic">
                    your top-rated
                </h1>
                <p className="text-brand-text-muted text-sm">
                    Items you've rated four stars or higher across every collection.
                </p>
            </div>

            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-48 max-w-5xl">
                {error ? (
                    <div className="py-16 text-center text-brand-text-muted text-sm">{error}</div>
                ) : items === null ? (
                    <div className="flex flex-wrap gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div
                                key={i}
                                className="shimmer h-48 rounded-2xl"
                                style={{ width: 'calc(50% - 6px)' }}
                            />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <Star className="h-10 w-10 text-zinc-700 mb-4" />
                        <p className="text-brand-text-muted font-medium text-lg mb-1">
                            No favourites yet.
                        </p>
                        <p className="text-sm text-brand-text-muted opacity-60 max-w-sm">
                            Rate items four stars or higher in any collection and they'll show up here.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-10">
                        {grouped.map(([label, groupItems]) => (
                            <section key={label}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-brand-text-muted">
                                        {label}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-600">{groupItems.length}</span>
                                    <div className="flex-1 h-px bg-[var(--glass-surface)]" />
                                </div>
                                <MasonryGroup
                                    items={groupItems}
                                    onItemClick={(item) => navigate(`/lists/${item.list.id}`)}
                                />
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
