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
        case 'film': return '239, 68, 68' // Red
        case 'music': return '236, 72, 153' // Pink
        case 'tech': return '59, 130, 246' // Blue
        case 'book': return '245, 158, 11' // Amber
        case 'place': return '16, 185, 129' // Emerald
        case 'game': return '139, 92, 246' // Violet
        case 'quote': return '167, 139, 250' // Violet-light
        case 'event': return '251, 146, 60' // Orange
        case 'software': return '34, 211, 238' // Cyan
        case 'article': return '251, 191, 36' // Amber
        case 'fix': return '245, 158, 11' // Amber (wrench)
        default: return '148, 163, 184' // Slate
    }
}

export const ListGradient = (type: ListType) => {
    switch (type) {
        case 'film': return 'from-red-500/20 via-pink-500/10 to-purple-500/20'
        case 'music': return 'from-pink-500/20 via-fuchsia-500/10 to-violet-500/20'
        case 'tech': return 'from-blue-500/20 via-cyan-500/10 to-sky-500/20'
        case 'book': return 'from-amber-500/20 via-yellow-500/10 to-orange-500/20'
        case 'place': return 'from-emerald-500/20 via-teal-500/10 to-green-500/20'
        case 'game': return 'from-violet-500/20 via-purple-500/10 to-indigo-500/20'
        case 'quote': return 'from-violet-500/20 via-purple-500/10 to-fuchsia-500/20'
        case 'event': return 'from-orange-500/20 via-amber-500/10 to-yellow-500/20'
        case 'software': return 'from-cyan-500/20 via-blue-500/10 to-indigo-500/20'
        case 'article': return 'from-amber-500/20 via-yellow-500/10 to-orange-500/20'
        case 'fix': return 'from-amber-500/20 via-orange-500/10 to-yellow-500/20'
        default: return 'from-slate-500/20 via-gray-500/10 to-zinc-500/20'
    }
}
