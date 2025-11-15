import { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Plus } from 'lucide-react';
import { usePlaceStore } from '../stores/usePlaceStore';
import { AddPlaceModal } from './AddPlaceModal';
import { EditPlaceModal } from './EditPlaceModal';
import { PlacesList } from './PlacesList';
import type { Database } from '../types/database';

type PlaceWithStats = Database['public']['Views']['places_with_stats']['Row'];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 };
const DEFAULT_ZOOM = 12;

const CATEGORY_ICONS: Record<string, string> = {
  pub: '🍺',
  restaurant: '🍽️',
  cafe: '☕',
  park: '🌳',
  beach: '🏖️',
  relative_house: '👨‍👩‍👧',
  nursery: '👶',
  playgroup: '🎨',
  soft_play: '🎪',
  attraction: '🎡',
  landmark: '🏛️',
  other: '📍',
};

// Create SVG marker icons for each category
const createMarkerIcon = (emoji: string, isSelected: boolean) => {
  const size = isSelected ? 40 : 32;
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <!-- Outer circle -->
      <circle cx="16" cy="16" r="14" fill="${isSelected ? '#3b82f6' : '#ef4444'}" stroke="white" stroke-width="2"/>
      <!-- Inner lighter circle -->
      <circle cx="16" cy="16" r="12" fill="${isSelected ? '#60a5fa' : '#f87171'}" opacity="0.3"/>
      <!-- Emoji text - centered both horizontally and vertically -->
      <text x="16" y="18" text-anchor="middle" dominant-baseline="middle" font-size="18">${emoji}</text>
    </svg>
  `.trim();
  return encodeURIComponent(svg);
};

const getMarkerIcon = (category: string | null, isSelected: boolean) => {
  const emoji = CATEGORY_ICONS[category || 'other'] || '📍';
  const iconSvg = createMarkerIcon(emoji, isSelected);
  const size = isSelected ? 40 : 32;

  // Return just the URL if Google Maps isn't loaded yet
  // The actual Size and Point will be created inside the component
  return `data:image/svg+xml,${iconSvg}`;
};

export default function PlacesView() {
  const { placesWithStats, fetchPlacesWithStats, loading, error } = usePlaceStore();
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithStats | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<PlaceWithStats | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Fetch places on mount
  useEffect(() => {
    fetchPlacesWithStats();
  }, []);

  // Auto-center map on places
  if (placesWithStats.length > 0 && !selectedPlace) {
    const avgLat = placesWithStats.reduce((sum, p) => sum + Number(p.latitude), 0) / placesWithStats.length;
    const avgLng = placesWithStats.reduce((sum, p) => sum + Number(p.longitude), 0) / placesWithStats.length;

    const newCenter = { lat: avgLat, lng: avgLng };
    const newZoom = placesWithStats.length === 1 ? 15 : 11;

    if (mapCenter.lat !== newCenter.lat || mapCenter.lng !== newCenter.lng) {
      setMapCenter(newCenter);
      setMapZoom(newZoom);
    }
  }

  const handleMarkerClick = (place: PlaceWithStats) => {
    setSelectedPlace(place);
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <p className="text-gray-600">Google Maps API Key is required</p>
        </div>
      </div>
    );
  }

  if (loading && placesWithStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading places...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-semibold mb-2">Error</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (placesWithStats.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold mb-2">No Places Yet</h2>
            <p className="text-gray-600 mb-4">
              Start tracking special places you've visited with your baby!
            </p>
            <button
              onClick={() => setIsAddPlaceModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Place
            </button>
          </div>
        </div>

        <AddPlaceModal
          isOpen={isAddPlaceModalOpen}
          onClose={() => setIsAddPlaceModalOpen(false)}
          onSuccess={() => {
            fetchPlacesWithStats();
            setIsAddPlaceModalOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <div className="h-full flex flex-col bg-white">
      {/* Header with view toggle */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Places</h1>
          <p className="text-sm text-gray-600">{placesWithStats.length} place{placesWithStats.length === 1 ? '' : 's'} tracked</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🗺️ Map
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 List
          </button>
          <button
            onClick={() => setIsAddPlaceModalOpen(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'map' ? (
          // Map view with places list below
          <div className="flex-1 flex flex-col w-full overflow-hidden">
            {/* Map Container - fixed height */}
            <div style={{ height: '400px', width: '100%' }} className="shrink-0">
              {!GOOGLE_MAPS_API_KEY ? (
                <div className="h-full flex items-center justify-center bg-gray-200">
                  <div className="text-center">
                    <p className="text-gray-600">Google Maps API Key is missing</p>
                  </div>
                </div>
              ) : (
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={mapCenter}
                    zoom={mapZoom}
                    key={`map-${mapCenter.lat}-${mapCenter.lng}`}
                    onLoad={(map) => {
                      // Ensure the map is properly initialized
                      map.panTo(mapCenter);
                    }}
                    options={{
                      gestureHandling: 'cooperative',
                      zoomControl: true,
                      fullscreenControl: false,
                      mapTypeControl: true,
                      scaleControl: true,
                    }}
                  >
                    {/* Markers for each place */}
                    {typeof window !== 'undefined' && window.google && placesWithStats.map((place) => {
                      const isSelected = selectedPlace?.id === place.id;
                      const size = isSelected ? 40 : 32;

                      return (
                        <Marker
                          key={place.id}
                          position={{
                            lat: Number(place.latitude),
                            lng: Number(place.longitude),
                          }}
                          onClick={() => handleMarkerClick(place)}
                          title={place.name}
                          icon={{
                            url: getMarkerIcon(place.category, isSelected),
                            scaledSize: new window.google.maps.Size(size, size),
                            anchor: new window.google.maps.Point(size / 2, size / 2),
                          }}
                        />
                      );
                    })}

                    {/* Info window for selected place */}
                    {selectedPlace && (
                      <InfoWindow
                        position={{
                          lat: Number(selectedPlace.latitude),
                          lng: Number(selectedPlace.longitude),
                        }}
                        onCloseClick={() => setSelectedPlace(null)}
                      >
                        <div className="p-2">
                          <h3 className="font-semibold">{selectedPlace.name}</h3>
                          <p className="text-sm text-gray-600">{selectedPlace.visit_count || 0} visits</p>
                        </div>
                      </InfoWindow>
                    )}
                </GoogleMap>
              )}
            </div>

            {/* Places table below map - compact summary */}
            <div className="bg-white border-t border-gray-200 overflow-y-auto max-h-48">
              <div className="divide-y divide-gray-200">
                {placesWithStats.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => handleMarkerClick(place)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                      selectedPlace?.id === place.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[place.category || 'other'] || '📍'}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{place.name}</p>
                        <p className="text-xs text-gray-500">{place.visit_count || 0} visits</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-600">{place.photo_count || 0}</p>
                        <p className="text-xs text-gray-500">photos</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // List view with all details
          <PlacesList onEditPlace={setEditingPlace} />
        )}
      </div>

      {/* Modals */}
      <AddPlaceModal
        isOpen={isAddPlaceModalOpen}
        onClose={() => setIsAddPlaceModalOpen(false)}
        onSuccess={() => {
          fetchPlacesWithStats();
          setIsAddPlaceModalOpen(false);
        }}
      />

      <EditPlaceModal
        isOpen={editingPlace !== null}
        place={editingPlace}
        onClose={() => setEditingPlace(null)}
        onSuccess={() => {
          fetchPlacesWithStats();
          setEditingPlace(null);
        }}
      />
    </div>
    </LoadScript>
  );
}
