import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Share2, Sparkles, Box } from 'lucide-react'

interface IdeaChild {
    child_title: string
    intersection_reason: string
    concept_mockup: string
    aesthetic: string
    source_a: { title: string; type: string }
    source_b: { title: string; type: string }
}

export function VennIntersection() {
    const [idea, setIdea] = useState<IdeaChild | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchVenn() {
            try {
                const res = await fetch('/api/venn')
                const data = await res.json()
                if (data.ideas && data.ideas.length > 0) {
                    setIdea(data.ideas[0])
                }
            } catch (e) {
                console.error('Failed to fetch Venn idea', e)
            } finally {
                setLoading(false)
            }
        }
        fetchVenn()
    }, [])

    if (loading) return null
    if (!idea) return null

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="zebra-card p-8 border-2 border-white relative overflow-hidden">
                {/* Background Intersection Circles */}
                <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2" />
                <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-zebra-accent/5 rounded-full blur-3xl -translate-y-1/2" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-8">
                        <Share2 className="h-5 w-5 text-zebra-accent" />
                        <span className="font-black uppercase tracking-tighter text-sm">Venn Intersection</span>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-[10px] font-bold border border-white/20 px-2 py-0.5 rounded uppercase">{idea.aesthetic}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                        {/* Source A */}
                        <div className="text-center md:text-right">
                            <div className="text-[10px] opacity-40 uppercase font-bold mb-1">{idea.source_a.type}</div>
                            <div className="font-bold text-gray-300 line-clamp-2">{idea.source_a.title}</div>
                        </div>

                        {/* The Intersection */}
                        <div className="flex flex-col items-center justify-center relative">
                            <div className="w-16 h-16 rounded-full border-2 border-zebra-accent flex items-center justify-center mb-4 bg-black">
                                <Sparkles className="h-8 w-8 text-zebra-accent animate-pulse" />
                            </div>
                            <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent absolute top-8 -z-10" />
                        </div>

                        {/* Source B */}
                        <div className="text-center md:text-left">
                            <div className="text-[10px] opacity-40 uppercase font-bold mb-1">{idea.source_b.type}</div>
                            <div className="font-bold text-gray-300 line-clamp-2">{idea.source_b.title}</div>
                        </div>
                    </div>

                    <div className="mt-12 text-center max-w-2xl mx-auto">
                        <h3 className="text-3xl font-black italic uppercase mb-4 tracking-tighter">
                            {idea.child_title}
                        </h3>
                        <p className="text-gray-400 mb-6 italic text-sm">
                            "{idea.intersection_reason}"
                        </p>

                        <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-left">
                            <div className="flex items-center gap-2 mb-2">
                                <Box className="h-4 w-4 text-zebra-accent" />
                                <span className="text-[10px] font-bold uppercase">Mockup / Concept</span>
                            </div>
                            <p className="text-sm text-gray-300">
                                {idea.concept_mockup}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
