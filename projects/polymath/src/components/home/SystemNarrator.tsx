import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, ArrowRight } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'

interface QuirkyMessage {
    text: string
    link?: string
}

export function SystemNarrator() {
    const { allProjects } = useProjectStore()
    const priorityProject = useMemo(() => allProjects.find(p => p.is_priority), [allProjects])

    const QUIRKY_MESSAGES: QuirkyMessage[] = useMemo(() => [
        { text: "I've updated the Power Hour. Your momentum is currently 84% efficient. Don't let it drop." },
        { text: "Synthesizing your 3:00 AM thoughts... surprisingly, they aren't all nonsense today." },
        { text: "The Venn Engine found a collision between 'Spinoza' and 'Latte Art'. You're welcome.", link: '/map' },
        {
            text: "Your project velocity is increasing. Are we actually going to finish something this time?",
            link: priorityProject ? `/projects/${priorityProject.id}` : '/projects'
        },
        { text: "I've archived your dormant project. It's okay. We both knew it was time." },
        {
            text: "Shadow Work complete: I've drafted skeletons for your new idea. The blank page is now your problem, not mine.",
            link: priorityProject ? `/projects/${priorityProject.id}` : '/projects'
        },
        { text: "Warning: High curiosity levels detected in the reading queue. Don't forget to actually execute.", link: '/reading' },
        { text: "Aperture is watching. Not in a creepy way, just in a 'I care about your productivity' way." }
    ], [priorityProject])

    const [messageObj, setMessageObj] = useState<QuirkyMessage | null>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Show a message after a short delay
        const timer = setTimeout(() => {
            const randomMsg = QUIRKY_MESSAGES[Math.floor(Math.random() * QUIRKY_MESSAGES.length)]
            setMessageObj(randomMsg)
            setIsVisible(true)
        }, 3000)

        return () => clearTimeout(timer)
    }, [QUIRKY_MESSAGES])

    return (
        <AnimatePresence>
            {isVisible && messageObj && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="fixed bottom-28 right-4 z-50 max-w-[280px] group"
                >
                    <div className="bg-black border border-white p-4 shadow-[8px_8px_0px_0px_rgba(255,215,0,1)] relative">
                        <div className="flex items-center gap-2 mb-2 text-zebra-accent">
                            <Terminal className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">Aperture System</span>
                        </div>
                        <p className="text-[13px] text-gray-300 font-medium leading-tight mb-4">
                            {messageObj.text}
                        </p>

                        {messageObj.link && (
                            <Link
                                to={messageObj.link}
                                className="inline-flex items-center gap-2 bg-white text-black px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter hover:bg-zebra-accent transition-colors"
                            >
                                Go to Project <ArrowRight className="h-3 w-3" />
                            </Link>
                        )}

                        <button
                            onClick={() => setIsVisible(false)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center text-[10px] font-black hover:bg-zebra-accent transition-colors border border-black"
                        >
                            X
                        </button>
                    </div>

                    {/* Terminal Decoration */}
                    <div className="mt-2 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-2 h-2 bg-white" />
                        <div className="w-2 h-2 bg-zebra-accent" />
                        <div className="w-2 h-2 bg-gray-600" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
