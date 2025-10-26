import type { TestRepair } from '../types'

interface RepairCardProps {
  repair: TestRepair
  onApprove: () => void
  onReject: () => void
}

export function RepairCard({ repair, onApprove, onReject }: RepairCardProps) {
  const confidenceColor = {
    high: 'text-green-600',
    medium: 'text-yellow-600',
    low: 'text-red-600',
  }

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {repair.description}
          </h3>
          <p className="text-sm text-gray-500">
            {repair.testFile} → {repair.testName}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(repair.timestamp).toLocaleString()}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            statusColor[repair.status]
          }`}
        >
          {repair.status}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Screenshot with highlighted element */}
        <div className="relative">
          <img
            src={`data:image/png;base64,${repair.screenshot}`}
            alt="Test failure screenshot"
            className="w-full rounded border border-gray-200"
          />
          {repair.newCoordinates && (
            <div
              className="absolute w-4 h-4 border-2 border-red-500 rounded-full bg-red-500 bg-opacity-30"
              style={{
                left: `${(repair.newCoordinates.x / 1000) * 100}%`,
                top: `${(repair.newCoordinates.y / 1000) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="absolute w-8 h-8 border-2 border-red-500 rounded-full animate-ping opacity-50" />
            </div>
          )}
        </div>

        {/* Repair details */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Action</label>
            <p className="text-sm font-mono bg-gray-50 px-2 py-1 rounded">
              {repair.action}
              {repair.fillValue && ` → "${repair.fillValue}"`}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">
              Old Selector
            </label>
            <p className="text-sm font-mono bg-red-50 px-2 py-1 rounded text-red-700">
              {repair.oldLocator}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">
              New Coordinates
            </label>
            {repair.newCoordinates ? (
              <p className="text-sm font-mono bg-green-50 px-2 py-1 rounded text-green-700">
                ({repair.newCoordinates.x}, {repair.newCoordinates.y})
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No coordinates</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">
              Confidence
            </label>
            <p
              className={`text-sm font-semibold ${
                confidenceColor[repair.confidence]
              }`}
            >
              {repair.confidence.toUpperCase()}
            </p>
          </div>

          {repair.reasoning && (
            <div>
              <label className="text-xs font-medium text-gray-500">
                AI Reasoning
              </label>
              <p className="text-sm text-gray-700 bg-blue-50 px-2 py-1 rounded">
                {repair.reasoning}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500">Error</label>
            <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded font-mono">
              {repair.errorMessage}
            </p>
          </div>
        </div>
      </div>

      {repair.status === 'pending' && (
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onApprove}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium transition-colors"
          >
            ✅ Approve & Update Test
          </button>
          <button
            onClick={onReject}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors"
          >
            ❌ Reject
          </button>
        </div>
      )}
    </div>
  )
}
