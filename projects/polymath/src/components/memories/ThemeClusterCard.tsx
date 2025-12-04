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
      className="group relative premium-card p-5 text-left w-full hover-lift flex flex-col items-start gap-4"
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
        style={{
          background: 'rgba(59, 130, 246, 0.1)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}
      >
        <IconComponent className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
      </div>

      {/* Content */}
      <div className="flex-1 w-full min-w-0">
        {/* Theme Name */}
        <h3 className="text-lg font-bold mb-1 premium-text-platinum line-clamp-2">
          {cluster.name}
        </h3>

        {/* Thought Count */}
        <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
          {cluster.memory_count} {cluster.memory_count === 1 ? 'thought' : 'thoughts'}
        </p>

        {/* Sample Keywords */}
        <div className="flex flex-wrap gap-2">
          {cluster.sample_keywords.slice(0, 3).map((keyword, i) => (
            <span
              key={i}
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'rgba(59, 130, 246, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.25)'
              }}
            >
              {keyword}
            </span>
          ))}
          {cluster.sample_keywords.length > 3 && (
            <span className="text-xs px-2.5 py-1 rounded-full" style={{
              color: 'var(--premium-text-tertiary)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)'
            }}>
              +{cluster.sample_keywords.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Hover indicator */}
      <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5" style={{ color: 'var(--premium-blue)' }} />
      </div>
    </button>
  )
})
