import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { usePlaceStore } from '../stores/usePlaceStore';
import { MapPin, Calendar, Plus, Camera } from 'lucide-react';
import { AddPlaceModal } from './AddPlaceModal';
import type { Database } from '../types/database';

type PlaceWithStats = Database['public']['Views']['places_with_stats']['Row'];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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
    fetchPlacesWithStats();
  }, []);

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
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="w-20 h-20 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Places Yet</h2>
            <p className="text-gray-600 mb-6">
              Start tracking special places you've visited with your baby!
            </p>
            <button
              onClick={() => setIsAddPlaceModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md"
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Map Container - Full height with rounded corners */}
      <div className="flex-1 relative m-3 rounded-xl overflow-hidden shadow-lg border border-gray-200">
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
            className="w-full h-full"
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

        {/* Places count badge */}
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md text-sm font-medium text-gray-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span>{placesWithStats.length} {placesWithStats.length === 1 ? 'place' : 'places'}</span>
        </div>

        {/* Selected Place Info Card */}
        {selectedPlace && (
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-4 max-w-sm mx-auto border border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg flex-1 text-gray-900">{selectedPlace.name}</h3>
              <button
                onClick={() => setSelectedPlace(null)}
                className="text-gray-400 hover:text-gray-600 ml-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>

            {selectedPlace.description && (
              <p className="text-sm text-gray-600 mb-3">{selectedPlace.description}</p>
            )}

            <div className="flex items-center gap-4 text-sm mb-3">
              <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(selectedPlace.first_visit_date)}</span>
              </div>
              {selectedPlace.photo_count !== undefined && selectedPlace.photo_count > 0 && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Camera className="w-4 h-4" />
                  <span>{selectedPlace.photo_count}</span>
                </div>
              )}
            </div>

            {selectedPlace.address && (
              <div className="flex items-start gap-2 text-gray-500 text-xs mb-3 bg-gray-50 p-2 rounded-lg">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{selectedPlace.address}</span>
              </div>
            )}

            <button
              onClick={() => onPlaceSelect && onPlaceSelect(selectedPlace)}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              View Details
            </button>
          </div>
        )}

        {/* Floating Add Button */}
        <button
          onClick={() => setIsAddPlaceModalOpen(true)}
          className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 active:scale-95"
          aria-label="Add new place"
        >
          <Plus className="w-6 h-6" />
        </button>
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
