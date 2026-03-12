import React from 'react'
import { ThemeCluster } from '../../types'
import { ChevronRight, Brain, Lightbulb, Leaf, Code, Palette, Heart, BookOpen, Zap, Users } from 'lucide-react'

interface ThemeClusterCardProps {
  cluster: ThemeCluster
  onClick: () => void
}

const getIconComponent = (name: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('learn')) return Brain
  if (lowerName.includes('creat')) return Lightbulb
  if (lowerName.includes('nature')) return Leaf
  if (lowerName.includes('code') || lowerName.includes('tech')) return Code
  if (lowerName.includes('art') || lowerName.includes('design')) return Palette
  if (lowerName.includes('love') || lowerName.includes('relationship')) return Heart
  if (lowerName.includes('read') || lowerName.includes('book')) return BookOpen
  if (lowerName.includes('energy') || lowerName.includes('power')) return Zap
  if (lowerName.includes('social') || lowerName.includes('people')) return Users
  return Lightbulb // default icon
}

export const ThemeClusterCard = React.memo(function ThemeClusterCard({ cluster, onClick }: ThemeClusterCardProps) {
  const IconComponent = getIconComponent(cluster.name)
  return (
    <button
      onClick={onClick}
      className="group relative p-4 rounded-lg text-left w-full flex flex-col items-start gap-3 transition-all duration-200"
      style={{
        background: '#111113',
        border: '2px solid rgba(255,255,255,0.1)',
        boxShadow: '3px 3px 0 rgba(0,0,0,0.8)',
      }}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{
          background: 'rgba(59,130,246,0.12)',
          border: '2px solid rgba(59,130,246,0.3)',
          boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
        }}
      >
        <IconComponent className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
      </div>

      {/* Content */}
      <div className="flex-1 w-full min-w-0">
        {/* Theme Name */}
        <h3 className="text-sm font-black uppercase tracking-wide mb-1 line-clamp-2" style={{ color: "var(--brand-primary)" }}>
          {cluster.name}
        </h3>

        {/* Thought Count */}
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--brand-primary)" }}>
          {cluster.memory_count} {cluster.memory_count === 1 ? 'thought' : 'thoughts'}
        </p>

        {/* Sample Keywords */}
        <div className="flex flex-wrap gap-1.5">
          {cluster.sample_keywords.slice(0, 3).map((keyword, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wide"
              style={{
                background: 'rgba(59,130,246,0.1)',
                color: "var(--brand-text-secondary)",
                border: '1.5px solid rgba(59,130,246,0.3)',
              }}
            >
              {keyword}
            </span>
          ))}
          {cluster.sample_keywords.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold" style={{
              color: 'var(--brand-text-muted)',
              background: 'var(--glass-surface)',
              border: '1.5px solid rgba(255,255,255,0.1)',
            }}>
              +{cluster.sample_keywords.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Hover indicator */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
      </div>
    </button>
  )
})
