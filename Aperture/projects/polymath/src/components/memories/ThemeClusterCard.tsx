import { ThemeCluster } from '../../types'

interface ThemeClusterCardProps {
  cluster: ThemeCluster
  onClick: () => void
}

export function ThemeClusterCard({ cluster, onClick }: ThemeClusterCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-orange-400 hover:shadow-lg transition-all duration-200 text-left w-full"
    >
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${cluster.color}20` }}
      >
        <span className="text-3xl">{cluster.icon}</span>
      </div>

      {/* Theme Name */}
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {cluster.name}
      </h3>

      {/* Memory Count */}
      <p className="text-sm text-gray-600 mb-3">
        {cluster.memory_count} {cluster.memory_count === 1 ? 'memory' : 'memories'}
      </p>

      {/* Sample Keywords */}
      <div className="flex flex-wrap gap-1.5">
        {cluster.sample_keywords.slice(0, 3).map((keyword, i) => (
          <span
            key={i}
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${cluster.color}15`,
              color: cluster.color
            }}
          >
            {keyword}
          </span>
        ))}
        {cluster.sample_keywords.length > 3 && (
          <span className="text-xs px-2 py-1 text-gray-500">
            +{cluster.sample_keywords.length - 3}
          </span>
        )}
      </div>

      {/* Hover indicator */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
