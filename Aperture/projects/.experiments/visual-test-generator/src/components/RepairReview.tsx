import { useEffect, useState } from 'react'
import { useRepairs } from '../hooks/useRepairs'
import { RepairCard } from './RepairCard'
import type { SelfHealingConfig } from '../types'

export function RepairReview() {
  const { repairs, loading, error, fetchRepairs, approveRepair, rejectRepair } =
    useRepairs()
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  const config: SelfHealingConfig = {
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  }

  useEffect(() => {
    fetchRepairs(config, filter === 'all' ? undefined : filter)
  }, [filter])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading repairs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test Repairs
          </h1>
          <p className="text-gray-600">
            Review and approve self-healing test repairs powered by Gemini
            Computer Use
          </p>
        </header>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <div className="flex gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-500 mb-1">Total Repairs</p>
            <p className="text-3xl font-bold text-gray-900">{repairs.length}</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-500 mb-1">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-600">
              {repairs.filter((r) => r.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-500 mb-1">Approved</p>
            <p className="text-3xl font-bold text-green-600">
              {repairs.filter((r) => r.status === 'approved').length}
            </p>
          </div>
        </div>

        {/* Repairs list */}
        {repairs.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No repairs found</p>
            <p className="text-gray-400 text-sm mt-2">
              Run your tests with self-healing enabled to see repairs here
            </p>
          </div>
        ) : (
          <div>
            {repairs.map((repair) => (
              <RepairCard
                key={repair.id}
                repair={repair}
                onApprove={() => approveRepair(repair.id, config)}
                onReject={() => rejectRepair(repair.id, config)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
