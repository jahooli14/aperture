import React, { useState, useEffect } from 'react'
import { ConnectionsList } from '../connections/ConnectionsList'
import { Lightbulb, Brain, BookOpen, Save, Send, Sparkles, Wand2, PenTool } from 'lucide-react'
import { Project } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { motion, AnimatePresence } from 'framer-motion'

interface StudioTabProps {
    project: Project
}

export function StudioTab({ project }: StudioTabProps) {
    const { updateProject } = useProjectStore()
    const { addToast } = useToast()
    const [draft, setDraft] = useState(project.metadata?.studio_draft || '')
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [connectionCount, setConnectionCount] = useState(0)
    const [isLoadingConnections, setIsLoadingConnections] = useState(true)

    // Auto-save logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (draft !== (project.metadata?.studio_draft || '')) {
                handleSave()
            }
        }, 3000)
        return () => clearTimeout(timer)
    }, [draft])

    const handleSave = async () => {
        if (isSaving) return
        setIsSaving(true)
        try {
            await updateProject(project.id, {
                metadata: {
                    ...project.metadata,
                    studio_draft: draft
                }
            })
            setLastSaved(new Date())
        } catch (error) {
            console.error('Failed to save draft:', error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Drafting Area */}
            <div className="lg:col-span-2 space-y-6">
                <div className="premium-card p-6 bg-gradient-to-br from-indigo-900/10 to-purple-900/10 border-indigo-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                                <PenTool className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white leading-none">The Studio</h3>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">The Workbench for Ideas</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {lastSaved && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    SAVED: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {isSaving && (
                                <div className="h-1.5 w-12 bg-zinc-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-indigo-500"
                                        animate={{ x: [-48, 48] }}
                                        transition={{ repeat: Infinity, duration: 1 }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="This is your blank canvas. \n\nDrop unstructured thoughts, research links, or grand visions here. \nThere are no rules in the studio."
                        className="w-full h-96 bg-transparent border-0 focus:ring-0 text-zinc-200 placeholder:text-zinc-600 resize-none font-serif text-lg leading-relaxed scroll-minimal"
                    />

                    <div className="mt-4 flex justify-between items-center border-t border-white/5 pt-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    addToast({
                                        title: 'Studio Assistant',
                                        description: 'AI refinement coming soon to The Studio.',
                                    })
                                }}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5 flex items-center gap-2 group"
                            >
                                <Sparkles className="h-3 w-3 group-hover:text-indigo-400 transition-colors" />
                                Make it Magic
                            </button>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono">
                            {draft.length} CHARS
                        </span>
                    </div>
                </div>
            </div>

            {/* Sidebar: Connections & Inspiration */}
            <div className="space-y-6">
                {(connectionCount > 0 || isLoadingConnections) && (
                    <div className="premium-card p-6 border-zinc-500/10">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-4 w-4 text-sky-400" />
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Contextual Sparks</h4>
                        </div>
                        <div className="text-xs text-zinc-500 mb-4 leading-relaxed">
                            Automatic connections found by the Aperture Engine based on your Studio notes.
                        </div>
                        <ConnectionsList
                            itemType="project"
                            itemId={project.id}
                            content={`${project.title}\n${project.description || ''}\n${draft}`}
                            onCountChange={setConnectionCount}
                            onLoadingChange={setIsLoadingConnections}
                        />
                    </div>
                )}

                <div className="premium-card p-6 border-zinc-500/10 bg-gradient-to-tr from-sky-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-amber-400" />
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">About The Studio</h4>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                        Separating <strong>Doing</strong> (Overview) from <strong>Thinking</strong> (Studio) keeps your checklist clean. Use this space to get messy before you commit to tasks.
                    </p>
                </div>
            </div>
        </div>
    )
}
