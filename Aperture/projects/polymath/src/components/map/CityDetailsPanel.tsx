/**
 * CityDetailsPanel Component
 * Sidebar panel showing city details when clicked
 */

import { motion, AnimatePresence } from 'framer-motion'
import { X, MapPin, Calendar, Activity, Link2 } from 'lucide-react'
import type { City, MapData } from '../../utils/mapTypes'

interface CityDetailsPanelProps {
  city: City | null
  mapData: MapData
  onClose: () => void
}

export function CityDetailsPanel({ city, mapData, onClose }: CityDetailsPanelProps) {
  if (!city) return null

  // Find roads connected to this city
  const connectedRoads = mapData.roads.filter(
    r => r.fromCityId === city.id || r.toCityId === city.id
  )

  // Find connected cities
  const connectedCities = connectedRoads.map(road => {
    const otherCityId = road.fromCityId === city.id ? road.toCityId : road.fromCityId
    return mapData.cities.find(c => c.id === otherCityId)
  }).filter(Boolean)

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Calculate days since last activity
  const daysSinceActive = Math.floor(
    (Date.now() - new Date(city.lastActive).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="fixed right-0 top-0 h-full w-96 premium-bg-2 shadow-2xl z-40 flex flex-col"
        style={{
          borderLeft: '1px solid var(--premium-bg-3)'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--premium-bg-3)' }}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" style={{ color: 'var(--premium-gold)' }} />
              <h2 className="text-2xl font-bold premium-text-platinum">
                {city.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-opacity-80 transition-all"
              style={{ background: 'var(--premium-bg-3)' }}
            >
              <X className="h-4 w-4" style={{ color: 'var(--premium-text-secondary)' }} />
            </button>
          </div>

          {/* City size badge */}
          <div className="flex gap-2 items-center">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold uppercase"
              style={{
                background: city.size === 'metropolis' ? 'var(--premium-gold)' :
                           city.size === 'city' ? 'var(--premium-purple)' :
                           city.size === 'town' ? 'var(--premium-indigo)' :
                           city.size === 'village' ? 'var(--premium-blue)' :
                           'var(--premium-bg-3)',
                color: city.size === 'homestead' ? 'var(--premium-text-secondary)' : 'white'
              }}
            >
              {city.size}
            </span>
            <span className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
              Population: {city.population}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--premium-bg-3)' }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg" style={{ background: 'var(--premium-bg-3)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                  Founded
                </span>
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                {formatDate(city.founded)}
              </div>
            </div>

            <div className="p-3 rounded-lg" style={{ background: 'var(--premium-bg-3)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                  Last Active
                </span>
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                {daysSinceActive === 0 ? 'Today' :
                 daysSinceActive === 1 ? 'Yesterday' :
                 `${daysSinceActive} days ago`}
              </div>
            </div>
          </div>
        </div>

        {/* Connected Cities */}
        <div className="p-6 border-b flex-1 overflow-y-auto" style={{ borderColor: 'var(--premium-bg-3)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--premium-text-tertiary)' }}>
              Connections
            </h3>
          </div>

          {connectedCities.length > 0 ? (
            <div className="space-y-2">
              {connectedCities.map(connectedCity => {
                if (!connectedCity) return null
                const road = connectedRoads.find(r =>
                  r.fromCityId === connectedCity.id || r.toCityId === connectedCity.id
                )

                return (
                  <div
                    key={connectedCity.id}
                    className="p-3 rounded-lg hover:bg-opacity-80 transition-all cursor-pointer"
                    style={{ background: 'var(--premium-bg-3)' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                        {connectedCity.name}
                      </span>
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: road?.type === 'highway' ? 'var(--premium-blue)' :
                                     road?.type === 'main' ? 'var(--premium-indigo)' :
                                     road?.type === 'country' ? 'var(--premium-bg-1)' :
                                     'var(--premium-bg-1)',
                          color: road?.type === 'highway' || road?.type === 'main' ? 'white' : 'var(--premium-text-tertiary)'
                        }}
                      >
                        {road?.type}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                      {road?.strength} shared {road?.strength === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                No connections yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                This city is isolated. Look for glowing doors to create connections.
              </p>
            </div>
          )}
        </div>

        {/* Footer with item count */}
        <div className="p-6 border-t" style={{ borderColor: 'var(--premium-bg-3)' }}>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--premium-gold)' }}>
              {city.population}
            </div>
            <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              Total Items (projects, thoughts, articles)
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
