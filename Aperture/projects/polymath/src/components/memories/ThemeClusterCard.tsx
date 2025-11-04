import React from 'react'
import { ThemeCluster } from '../../types'
import { ChevronRight } from 'lucide-react'

interface ThemeClusterCardProps {
  cluster: ThemeCluster
  onClick: () => void
}

export const ThemeClusterCard = React.memo(function ThemeClusterCard({ cluster, onClick }: ThemeClusterCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative premium-card p-6 text-left w-full hover-lift"
    >
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
        style={{
          background: `linear-gradient(135deg, ${cluster.color}20, ${cluster.color}10)`,
          border: `1px solid ${cluster.color}30`
        }}
      >
        <span className="text-4xl">{cluster.icon}</span>
      </div>

      {/* Theme Name */}
      <h3 className="text-xl font-bold mb-2 premium-text-platinum">
        {cluster.name}
      </h3>

      {/* Memory Count */}
      <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
        {cluster.memory_count} {cluster.memory_count === 1 ? 'memory' : 'memories'}
      </p>

      {/* Sample Keywords */}
      <div className="flex flex-wrap gap-2">
        {cluster.sample_keywords.slice(0, 3).map((keyword, i) => (
          <span
            key={i}
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: `linear-gradient(135deg, ${cluster.color}25, ${cluster.color}15)`,
              color: cluster.color,
              border: `1px solid ${cluster.color}40`
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

      {/* Hover indicator */}
      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5" style={{ color: 'var(--premium-blue)' }} />
      </div>
    </button>
  )
})
