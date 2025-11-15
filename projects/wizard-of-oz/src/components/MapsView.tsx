import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { usePlaceStore } from '../stores/usePlaceStore';
import { MapPin, Calendar, Plus } from 'lucide-react';
import { AddPlaceModal } from './AddPlaceModal';
import type { Database } from '../types/database';

type PlaceWithStats = Database['public']['Views']['places_with_stats']['Row'];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Debug: Log the API key status
console.log('[MapsView] Google Maps API Key:', GOOGLE_MAPS_API_KEY ? `Present (${GOOGLE_MAPS_API_KEY.substring(0, 10)}...)` : 'Missing');
console.log('[MapsView] All env vars:', import.meta.env);

// Default center (London, UK) - will be replaced by user's places
const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 };
const DEFAULT_ZOOM = 12;

interface MapsViewProps {
  onPlaceSelect?: (place: PlaceWithStats) => void;
}

export default function MapsView({ onPlaceSelect }: MapsViewProps) {
  const { placesWithStats, fetchPlacesWithStats, loading, error } = usePlaceStore();
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithStats | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch once on mount
    console.log('[MapsView] useEffect running, calling fetchPlacesWithStats');
    fetchPlacesWithStats().then(() => {
      console.log('[MapsView] fetchPlacesWithStats completed');
    }).catch((err) => {
      console.error('[MapsView] fetchPlacesWithStats failed:', err);
    });
  }, []); // Empty dependency array - only run once on mount

  // Listen for Google Maps errors
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (e.message && e.message.includes('Google Maps')) {
        console.error('Google Maps Error:', e);
        setMapsError('Google Maps failed to load. Please check your API key and enabled APIs.');
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Auto-center map on places
  useEffect(() => {
    if (placesWithStats.length > 0) {
      // Calculate center of all places
      const avgLat = placesWithStats.reduce((sum, p) => sum + Number(p.latitude), 0) / placesWithStats.length;
      const avgLng = placesWithStats.reduce((sum, p) => sum + Number(p.longitude), 0) / placesWithStats.length;
      setMapCenter({ lat: avgLat, lng: avgLng });

      // Adjust zoom based on spread of places
      if (placesWithStats.length === 1) {
        setMapZoom(15);
      } else {
        setMapZoom(11);
      }
    }
  }, [placesWithStats]);

  const handleMarkerClick = (place: PlaceWithStats) => {
    setSelectedPlace(place);
    if (onPlaceSelect) {
      onPlaceSelect(place);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold mb-2">Google Maps API Key Required</h2>
          <p className="text-gray-600 mb-4">
            To use the Maps feature, you need to add a Google Maps API key to your environment variables.
          </p>
          <div className="text-left bg-gray-100 p-4 rounded-lg text-sm space-y-3">
            <div>
              <p className="font-semibold mb-1">1. Add environment variable:</p>
              <p className="font-mono text-xs bg-white p-2 rounded">VITE_GOOGLE_MAPS_API_KEY=your-key-here</p>
            </div>
            <div>
              <p className="font-semibold mb-1">2. Enable required APIs in Google Cloud:</p>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                <li>Maps JavaScript API</li>
                <li>Places API</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">3. Set up billing:</p>
              <p className="text-xs text-gray-600">Google Maps requires a billing account (has free tier)</p>
            </div>
            <a
              href="https://console.cloud.google.com/google/maps-apis"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-600 hover:underline text-sm mt-2"
            >
              Open Google Cloud Console →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading && placesWithStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your places...</p>
          <p className="text-xs text-gray-500 mt-2">If this takes too long, check your browser console for errors</p>
        </div>
      </div>
    );
  }

  if (error || mapsError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2 text-red-600">
            {mapsError ? 'Google Maps Error' : 'Error Loading Places'}
          </h2>
          <p className="text-gray-600 mb-4">{mapsError || error}</p>
          {mapsError && (
            <div className="text-left bg-red-50 p-4 rounded-lg text-sm space-y-2">
              <p className="font-semibold text-red-900">Common fixes:</p>
              <ul className="text-xs text-red-800 list-disc list-inside space-y-1">
                <li>Enable "Maps JavaScript API" in Google Cloud Console</li>
                <li>Enable "Places API" in Google Cloud Console</li>
                <li>Set up billing (required, but has free tier)</li>
                <li>Check API key restrictions (HTTP referrers)</li>
                <li>Verify the API key is correct in environment variables</li>
              </ul>
              <a
                href="https://console.cloud.google.com/google/maps-apis/api-list"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-red-600 hover:underline text-sm mt-2 font-medium"
              >
                Check API Status in Google Cloud →
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (placesWithStats.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">No Places Yet</h2>
            <p className="text-gray-600 mb-4">
              Start tracking special places you've visited with your baby!
            </p>
            <button
              onClick={() => {
                console.log('[MapsView] Add Your First Place button clicked');
                setIsAddPlaceModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Place
            </button>
          </div>
        </div>

        {/* Add Place Modal */}
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
    <div className="h-full flex flex-col">
      {/* Map Container */}
      <div className="flex-1 relative">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            mapId="pupils-places-map"
            defaultCenter={mapCenter}
            defaultZoom={mapZoom}
            center={mapCenter}
            zoom={mapZoom}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
          >
            {placesWithStats.map((place) => (
              <AdvancedMarker
                key={place.id}
                position={{ lat: Number(place.latitude), lng: Number(place.longitude) }}
                onClick={() => handleMarkerClick(place)}
              >
                <Pin
                  background={selectedPlace?.id === place.id ? '#3b82f6' : '#ef4444'}
                  glyphColor="#ffffff"
                  borderColor="#ffffff"
                  scale={selectedPlace?.id === place.id ? 1.3 : 1}
                />
              </AdvancedMarker>
            ))}
          </Map>
        </APIProvider>

        {/* Selected Place Info Card */}
        {selectedPlace && (
          <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm mx-auto">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg flex-1">{selectedPlace.name}</h3>
              <button
                onClick={() => setSelectedPlace(null)}
                className="text-gray-400 hover:text-gray-600 ml-2"
              >
                ✕
              </button>
            </div>

            {selectedPlace.description && (
              <p className="text-sm text-gray-600 mb-3">{selectedPlace.description}</p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-blue-600 font-medium">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(selectedPlace.first_visit_date)}</span>
              </div>

              {selectedPlace.address && (
                <div className="flex items-start gap-2 text-gray-500 text-xs">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{selectedPlace.address}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => onPlaceSelect && onPlaceSelect(selectedPlace)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Photos
            </button>
          </div>
        )}

        {/* Floating Add Button */}
        <button
          onClick={() => {
            console.log('[MapsView] Floating Add Button clicked');
            setIsAddPlaceModalOpen(true);
          }}
          className="absolute bottom-24 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 active:scale-95"
          aria-label="Add new place"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Places List - Grouped by Category */}
      <div className="bg-white border-t border-gray-200 overflow-y-auto max-h-48">
        {placesWithStats.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">
            No places yet. Click the + button to add your first place.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {(() => {
              // Group places by category
              const categoryLabels: Record<string, { label: string; icon: string }> = {
                pub: { label: 'Pubs', icon: '🍺' },
                restaurant: { label: 'Restaurants', icon: '🍽️' },
                cafe: { label: 'Cafes', icon: '☕' },
                park: { label: 'Parks', icon: '🌳' },
                beach: { label: 'Beaches', icon: '🏖️' },
                relative_house: { label: 'Relatives\' Houses', icon: '👨‍👩‍👧' },
                nursery: { label: 'Nurseries', icon: '👶' },
                playgroup: { label: 'Playgroups', icon: '🎨' },
                soft_play: { label: 'Soft Play', icon: '🎪' },
                attraction: { label: 'Attractions', icon: '🎡' },
                landmark: { label: 'Landmarks', icon: '🏛️' },
                other: { label: 'Other', icon: '📍' },
              };

              const grouped = placesWithStats.reduce((acc, place) => {
                const cat = place.category || 'other';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(place);
                return acc;
              }, {} as Record<string, typeof placesWithStats>);

              // Sort groups by category order, then places by name
              const sortedCategories = Object.keys(grouped).sort((a, b) => {
                const aIndex = Object.keys(categoryLabels).indexOf(a);
                const bIndex = Object.keys(categoryLabels).indexOf(b);
                return aIndex - bIndex;
              });

              return sortedCategories.map((category) => (
                <div key={category} className="border-b border-gray-100 last:border-b-0">
                  <div className="bg-gray-50 px-4 py-2 sticky top-0 flex items-center gap-2">
                    <span className="text-base">{categoryLabels[category]?.icon || '📍'}</span>
                    <h4 className="font-semibold text-gray-700 text-sm">
                      {categoryLabels[category]?.label || category}
                    </h4>
                    <span className="ml-auto text-xs text-gray-500">
                      {grouped[category].length}
                    </span>
                  </div>
                  <div className="space-y-0">
                    {grouped[category]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((place) => (
                        <div
                          key={place.id}
                          onClick={() => handleMarkerClick(place)}
                          className={`px-4 py-2 border-t border-gray-100 first:border-t-0 cursor-pointer transition-colors text-xs ${
                            selectedPlace?.id === place.id
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{place.name}</p>
                              {place.description && (
                                <p className="text-xs text-gray-500 truncate">{place.description}</p>
                              )}
                            </div>
                            <p className="text-gray-600 whitespace-nowrap ml-2">
                              {formatDate(place.first_visit_date)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Add Place Modal */}
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
