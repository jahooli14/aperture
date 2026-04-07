/**
 * List Theme Helpers
 * Shared icon, color, and gradient utilities for list components
 */

import React from 'react'
import { Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Quote, FileText, Wrench } from 'lucide-react'
import type { ListType } from '../types'

export const ListIcon = ({ type, className, style }: { type: ListType, className?: string, style?: React.CSSProperties }) => {
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
        case 'article': return <FileText className={className} style={style} />
        case 'fix': return <Wrench className={className} style={style} />
        default: return <Box className={className} style={style} />
    }
}

export const ListColor = (type: ListType) => {
    switch (type) {
        case 'film':
        case 'music':
        case 'tech':
        case 'book':
        case 'place':
        case 'game':
        case 'quote':
        case 'event':
        case 'software':
        case 'article':
        case 'fix':
            return 'var(--brand-primary-rgb)'
        default: return '148, 163, 184' // Slate
    }
}

export const ListGradient = (type: ListType) => {
    switch (type) {
        case 'film': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'music': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'tech': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'book': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'place': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'game': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'quote': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'event': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'software': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'article': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        case 'fix': return 'from-brand-primary/20 via-brand-primary/10 to-brand-primary/20'
        default: return 'from-slate-500/20 via-gray-500/10 to-zinc-500/20'
    }
}
