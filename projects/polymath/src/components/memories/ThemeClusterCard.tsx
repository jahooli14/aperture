import React, { useState } from 'react'
import { ThemeCluster } from '../../types'
import { Sprout } from 'lucide-react'
import { CreateProjectDialog } from '../projects/CreateProjectDialog'
import { getIconComponent } from '../../lib/themeIcons'

interface ThemeClusterCardProps {
  cluster: ThemeCluster
  onClick: () => void
}

export const ThemeClusterCard = React.memo(function ThemeClusterCard({ cluster, onClick }: ThemeClusterCardProps) {
  const IconComponent = getIconComponent(cluster.name)
  const [seedOpen, setSeedOpen] = useState(false)

  const clusterDescription = cluster.memories.length > 0
    ? cluster.memories.slice(0, 3).map(m => m.body || m.title).filter(Boolean).join(' / ').slice(0, 200)
    : cluster.sample_keywords.join(', ')

  return (
    <div
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
          background: 'rgba(var(--brand-primary-rgb),0.12)',
          border: '2px solid rgba(var(--brand-primary-rgb),0.3)',
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
                background: 'rgba(var(--brand-primary-rgb),0.1)',
                color: "var(--brand-text-secondary)",
                border: '1.5px solid rgba(var(--brand-primary-rgb),0.3)',
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

      {/* Clickable overlay for the card (opens cluster) */}
      <button
        onClick={onClick}
        className="absolute inset-0 rounded-lg"
        aria-label={`Open ${cluster.name} cluster`}
      />

      {/* Start project button — always visible on mobile */}
      {cluster.memory_count >= 2 && (
        <button
          onClick={(e) => { e.stopPropagation(); setSeedOpen(true) }}
          className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-lg transition-all active:scale-95"
          style={{
            background: 'rgba(var(--brand-primary-rgb), 0.1)',
            border: '1px solid rgba(var(--brand-primary-rgb), 0.25)',
            color: 'rgb(var(--color-accent-light-rgb))',
            fontSize: '9px',
            fontWeight: 900,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          title="Turn into a project"
        >
          <Sprout className="w-3 h-3" />
          Start project
        </button>
      )}

      <CreateProjectDialog
        isOpen={seedOpen}
        onOpenChange={setSeedOpen}
        hideTrigger
        initialTitle={cluster.name}
        initialDescription={clusterDescription}
        onCreated={async (projectId) => {
          // Link all cluster memories to the new project
          const memoryIds = cluster.memories.map(m => m.id)
          await Promise.allSettled(memoryIds.map(memoryId =>
            fetch('/api/connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_type: 'memory', source_id: memoryId,
                target_type: 'project', target_id: projectId,
                connection_type: 'inspired_by', created_by: 'user',
                reasoning: `Memory from "${cluster.name}" theme cluster`
              })
            })
          ))
        }}
      />
    </div>
  )
})
