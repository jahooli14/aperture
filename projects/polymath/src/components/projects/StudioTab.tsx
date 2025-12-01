import React from 'react'
import { ConnectionsList } from '../connections/ConnectionsList'
import { Sparkles, Brain, BookOpen } from 'lucide-react'
import { Project } from '../../types'

interface StudioTabProps {
    project: Project
}

export function StudioTab({ project }: StudioTabProps) {
    return (
        <div className="space-y-6">
            {/* Header / Context */}
            <div className="premium-card p-6 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-indigo-500/20">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-300">
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">The Studio</h3>
                        <p className="text-sm text-slate-300">
                            Your creative workspace for {project.title}.
                            Connect ideas, find inspiration, and let AI help you connect the dots.
                        </p>
                    </div>
                </div>
            </div>

            {/* Connections & Inspiration */}
            <div className="premium-card p-6">
                <ConnectionsList
                    itemType="project"
                    itemId={project.id}
                    content={`${project.title}\n${project.description || ''}`}
                />
            </div>
        </div>
    )
}
