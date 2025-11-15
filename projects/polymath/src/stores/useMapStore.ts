/**
 * Knowledge Map Store (Zustand)
 * Manages knowledge map state and API calls
 */

import { create } from 'zustand'
import type { MapData, City, Road, Door } from '../utils/mapTypes'
import { api } from '../lib/apiClient'
import { logger } from '../lib/logger'

interface MapState {
  mapData: MapData | null
  loading: boolean
  error: string | null
  selectedCity: City | null

  // Actions
  fetchMap: () => Promise<void>
  fetchDoorSuggestions: () => Promise<void>
  saveMap: (mapData: MapData) => Promise<void>
  selectCity: (city: City | null) => void
  addCity: (city: City) => void
  updateCity: (cityId: string, updates: Partial<City>) => void
  addRoad: (road: Road) => void
  removeRoad: (roadId: string) => void
  addDoor: (door: Door) => void
  dismissDoor: (doorId: string) => void
  acceptDoor: (door: Door) => void
  updateViewport: (x: number, y: number, scale: number) => void
}

export const useMapStore = create<MapState>((set, get) => ({
  mapData: null,
  loading: false,
  error: null,
  selectedCity: null,

  fetchMap: async () => {
    set({ loading: true, error: null })

    try {
      const data = await api.get('projects?resource=knowledge_map')

      // Validate response structure
      if (!data || !data.mapData) {
        throw new Error('Invalid response from server - mapData is missing')
      }

      set({
        mapData: data.mapData,
        loading: false
      })

      logger.info('[map] Loaded map:', {
        cities: data.mapData.cities?.length || 0,
        roads: data.mapData.roads?.length || 0,
        generated: data.generated
      })

      // Fetch door suggestions after loading map
      get().fetchDoorSuggestions()
    } catch (error) {
      logger.error('Failed to fetch knowledge map:', error)

      // Provide helpful error message
      let errorMessage = 'Failed to load knowledge map'
      if (error instanceof Error) {
        if (error.message.includes('relation') || error.message.includes('table')) {
          errorMessage = 'Database migration not run yet. Please run the knowledge_map migration.'
        } else {
          errorMessage = error.message
        }
      }

      set({
        error: errorMessage,
        loading: false
      })
    }
  },

  fetchDoorSuggestions: async () => {
    const { mapData } = get()
    if (!mapData) return

    try {
      logger.info('[map] Fetching door suggestions...')
      const data = await api.get('projects?resource=knowledge_map&action=suggestions')

      const newMapData = {
        ...mapData,
        doors: data.doors || []
      }

      set({ mapData: newMapData })

      logger.info('[map] Loaded door suggestions:', {
        doors: data.doors?.length || 0
      })
    } catch (error) {
      logger.error('Failed to fetch door suggestions:', error)
    }
  },

  saveMap: async (mapData: MapData) => {
    try {
      await api.post('projects?resource=knowledge_map', { mapData })
      set({ mapData })

      logger.info('[map] Saved map:', {
        cities: mapData.cities.length,
        roads: mapData.roads.length,
        version: mapData.version
      })
    } catch (error) {
      logger.error('Failed to save knowledge map:', error)
      set({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  selectCity: (city: City | null) => {
    set({ selectedCity: city })
  },

  addCity: (city: City) => {
    const { mapData } = get()
    if (!mapData) return

    const newMapData = {
      ...mapData,
      cities: [...mapData.cities, city],
      version: mapData.version + 1
    }

    set({ mapData: newMapData })
    get().saveMap(newMapData)
  },

  updateCity: (cityId: string, updates: Partial<City>) => {
    const { mapData } = get()
    if (!mapData) return

    const newMapData = {
      ...mapData,
      cities: mapData.cities.map(c =>
        c.id === cityId ? { ...c, ...updates } : c
      ),
      version: mapData.version + 1
    }

    set({ mapData: newMapData })
    get().saveMap(newMapData)
  },

  addRoad: (road: Road) => {
    const { mapData } = get()
    if (!mapData) return

    const newMapData = {
      ...mapData,
      roads: [...mapData.roads, road],
      version: mapData.version + 1
    }

    set({ mapData: newMapData })
    get().saveMap(newMapData)
  },

  removeRoad: (roadId: string) => {
    const { mapData } = get()
    if (!mapData) return

    const newMapData = {
      ...mapData,
      roads: mapData.roads.filter(r => r.id !== roadId),
      version: mapData.version + 1
    }

    set({ mapData: newMapData })
    get().saveMap(newMapData)
  },

  addDoor: (door: Door) => {
    const { mapData } = get()
    if (!mapData) return

    const newMapData = {
      ...mapData,
      doors: [...mapData.doors, door],
      version: mapData.version + 1
    }

    set({ mapData: newMapData })
  },

  dismissDoor: (doorId: string) => {
    const { mapData } = get()
    if (!mapData) return

    const newMapData = {
      ...mapData,
      doors: mapData.doors.filter(d => d.id !== doorId),
      version: mapData.version + 1
    }

    set({ mapData: newMapData })
    get().saveMap(newMapData)
  },

  acceptDoor: (door: Door) => {
    const { mapData } = get()
    if (!mapData) return

    logger.info('[map] Accepting door:', { type: door.type, id: door.id })

    let newMapData = { ...mapData }

    // Handle different door types
    if (door.type === 'new_connection') {
      // Create a new road between two cities
      const { cityAId, cityBId, sharedItems } = door.suggestionData
      const road: Road = {
        id: `road-${Date.now()}`,
        fromCityId: cityAId,
        toCityId: cityBId,
        strength: sharedItems.length,
        type: sharedItems.length >= 11 ? 'highway' : sharedItems.length >= 6 ? 'main' : sharedItems.length >= 3 ? 'country' : 'trail',
        connectionIds: sharedItems,
        built: new Date().toISOString(),
        lastTraveled: new Date().toISOString()
      }

      newMapData = {
        ...newMapData,
        roads: [...newMapData.roads, road]
      }
    } else if (door.type === 'new_topic') {
      // Create a new city
      const { topicName, items } = door.suggestionData
      const city: City = {
        id: `city-${Date.now()}`,
        name: topicName,
        position: door.position, // Use door position as city position
        population: items.length,
        size: items.length >= 50 ? 'metropolis' : items.length >= 20 ? 'city' : items.length >= 10 ? 'town' : items.length >= 3 ? 'village' : 'homestead',
        itemIds: items.map((item: any) => item.id),
        founded: new Date().toISOString(),
        lastActive: new Date().toISOString()
      }

      newMapData = {
        ...newMapData,
        cities: [...newMapData.cities, city]
      }
    } else if (door.type === 'project_idea') {
      // For project ideas, just remove the door (user can create project manually)
      logger.info('[map] Project idea accepted - user can create project from this suggestion')
    }

    // Remove the accepted door
    newMapData = {
      ...newMapData,
      doors: newMapData.doors.filter(d => d.id !== door.id),
      version: newMapData.version + 1
    }

    set({ mapData: newMapData })
    get().saveMap(newMapData)
  },

  updateViewport: (x: number, y: number, scale: number) => {
    const { mapData } = get()
    if (!mapData) return

    const newMapData = {
      ...mapData,
      viewport: { x, y, scale }
    }

    set({ mapData: newMapData })

    // Debounced save - save viewport after 2 seconds of no changes
    if ((window as any).__viewportSaveTimeout) {
      clearTimeout((window as any).__viewportSaveTimeout)
    }
    (window as any).__viewportSaveTimeout = setTimeout(() => {
      get().saveMap(newMapData)
    }, 2000)
  }
}))
