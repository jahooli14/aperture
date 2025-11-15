import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Plus, Check, Navigation, Search } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import { usePlaceStore } from '../stores/usePlaceStore';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 }; // London, UK

interface AddPlaceModalProps {
  photo?: Photo | null; // Made optional
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Separate component for the map with autocomplete
function PlacePickerMap({
  center,
  markerPosition,
  onMapClick,
  onCenterChange,
  onMarkerChange
}: {
  center: { lat: number; lng: number };
  markerPosition: { lat: number; lng: number };
  onMapClick: (e: MapMouseEvent) => void;
  onCenterChange: (pos: { lat: number; lng: number }) => void;
  onMarkerChange: (pos: { lat: number; lng: number }) => void;
}) {
  const places = useMapsLibrary('places');
  const [searchValue, setSearchValue] = useState('');
  const [autocompleteError, setAutocompleteError] = useState(false);
  const [isPlacesLoaded, setIsPlacesLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) {
      setIsPlacesLoaded(false);
      return;
    }

    try {
      const autocomplete = new places.Autocomplete(inputRef.current, {
        fields: ['geometry', 'name', 'formatted_address'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const newPos = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          onCenterChange(newPos);
          onMarkerChange(newPos);
        }
      });

      autocompleteRef.current = autocomplete;
      setIsPlacesLoaded(true);
      setAutocompleteError(false);
    } catch (error) {
      console.error('[AddPlaceModal] Error setting up autocomplete:', error);
      setAutocompleteError(true);
      setIsPlacesLoaded(false);
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [places, onCenterChange, onMarkerChange]);

  return (
    <div className="space-y-2">
      {/* Warning if autocomplete failed */}
      {autocompleteError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs">
          <p className="font-semibold text-yellow-900">Places API not enabled</p>
          <p className="text-yellow-800">Enable "Places API" in Google Cloud Console for address search.</p>
        </div>
      )}

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={isPlacesLoaded ? "Search for an address or place..." : "Loading search..."}
          disabled={!isPlacesLoaded}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {!isPlacesLoaded && !autocompleteError && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
          </div>
        )}
      </div>

      {/* Map */}
      <div
        className="h-64 rounded-lg overflow-hidden border border-gray-300 relative touch-none"
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <Map
          mapId="add-place-map"
          center={center}
          zoom={15}
          onClick={onMapClick}
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          clickableIcons={false}
        >
          <AdvancedMarker position={markerPosition}>
            <Pin background="#3b82f6" glyphColor="#ffffff" borderColor="#ffffff" scale={1.2} />
          </AdvancedMarker>
        </Map>
      </div>

      <p className="text-xs text-gray-500">
        Search for an address, click on the map, or use your current location
      </p>
    </div>
  );
}

export function AddPlaceModal({ photo, isOpen, onClose, onSuccess }: AddPlaceModalProps) {
  const { places, fetchPlaces, addPlace, linkPhotoToPlace, getPlacesByPhoto } = usePlaceStore();
  const [mode, setMode] = useState<'select' | 'create'>(photo ? 'select' : 'create');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // New place form
  const [placeName, setPlaceName] = useState('');
  const [placeDescription, setPlaceDescription] = useState('');
  const [placeCategory, setPlaceCategory] = useState<'pub' | 'restaurant' | 'cafe' | 'park' | 'beach' | 'relative_house' | 'nursery' | 'playgroup' | 'soft_play' | 'attraction' | 'landmark' | 'other'>('other');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [markerPosition, setMarkerPosition] = useState(DEFAULT_CENTER);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Only initialize once when modal opens
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      console.log('[AddPlaceModal] Modal opened, initializing');
      setMode(photo ? 'select' : 'create');
      setHasInitialized(true);
    } else if (!isOpen) {
      // Reset when closing
      setHasInitialized(false);
    }
  }, [isOpen, photo?.id, hasInitialized]);

  // Check if photo is already linked to places
  const linkedPlaces = photo ? getPlacesByPhoto(photo.id) : [];

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsLoadingLocation(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newCenter = { lat: latitude, lng: longitude };
        setMapCenter(newCenter);
        setMarkerPosition(newCenter);
        setIsLoadingLocation(false);
        console.log('Location obtained:', newCenter);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Could not get your location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += 'Please select manually on the map.';
        }
        setError(errorMessage);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      setMarkerPosition({
        lat: e.detail.latLng.lat,
        lng: e.detail.latLng.lng,
      });
    }
  };

  const handleLinkToExistingPlace = async () => {
    if (!selectedPlaceId || !photo) return;

    try {
      setIsSubmitting(true);
      setError('');
      await linkPhotoToPlace({
        photo_id: photo.id,
        place_id: selectedPlaceId,
      });
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link photo to place');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewPlace = async () => {
    if (!placeName.trim()) return;

    try {
      setIsSubmitting(true);
      setError('');

      // Create the place
      const newPlace = await addPlace({
        name: placeName.trim(),
        description: placeDescription.trim() || null,
        latitude: markerPosition.lat,
        longitude: markerPosition.lng,
        category: placeCategory,
      });

      // Link the photo to the new place if photo is provided
      if (photo) {
        await linkPhotoToPlace({
          photo_id: photo.id,
          place_id: newPlace.id,
        });
      }

      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create place');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setMode(photo ? 'select' : 'create');
    setSelectedPlaceId(null);
    setPlaceName('');
    setPlaceDescription('');
    setError('');
    setMapCenter(DEFAULT_CENTER);
    setMarkerPosition(DEFAULT_CENTER);
    onClose();
  };

  if (!isOpen) return null;

  const hasPhoto = !!photo;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-2xl mx-auto my-auto max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {hasPhoto ? 'Tag Location' : 'Add New Place'}
                </h2>
                {hasPhoto && photo && (
                  <p className="text-sm text-gray-600">
                    {new Date(photo.upload_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Mode Toggle - only show if photo is provided */}
            {hasPhoto && (
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setMode('select')}
                  className={`flex-1 px-6 py-3 font-medium transition-colors ${
                    mode === 'select'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Existing Places
                </button>
                <button
                  onClick={() => setMode('create')}
                  className={`flex-1 px-6 py-3 font-medium transition-colors ${
                    mode === 'create'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  New Place
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {mode === 'select' && hasPhoto ? (
                <>
                  {/* Already linked places */}
                  {linkedPlaces.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Already tagged:</h3>
                      <div className="space-y-2">
                        {linkedPlaces.map((place) => (
                          <div
                            key={place.id}
                            className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
                          >
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-green-900">{place.name}</p>
                              {place.description && (
                                <p className="text-sm text-green-700">{place.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Select existing place */}
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Select a place:</h3>
                  {places.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No places yet. Create your first one!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {places
                        .filter((p) => !linkedPlaces.some((lp) => lp.id === p.id))
                        .map((place) => (
                          <button
                            key={place.id}
                            onClick={() => setSelectedPlaceId(place.id)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                              selectedPlaceId === place.id
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <MapPin
                                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                  selectedPlaceId === place.id ? 'text-blue-600' : 'text-gray-400'
                                }`}
                              />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{place.name}</p>
                                {place.description && (
                                  <p className="text-sm text-gray-600 mt-1">{place.description}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Create new place */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Place Name *
                      </label>
                      <input
                        type="text"
                        value={placeName}
                        onChange={(e) => setPlaceName(e.target.value)}
                        placeholder="e.g., Grandma's House, The Red Lion Pub"
                        maxLength={100}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Description (optional)
                      </label>
                      <textarea
                        value={placeDescription}
                        onChange={(e) => setPlaceDescription(e.target.value)}
                        placeholder="Add a note about this place..."
                        maxLength={300}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Type of Place
                      </label>
                      <select
                        value={placeCategory}
                        onChange={(e) => setPlaceCategory(e.target.value as any)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="pub">🍺 Pub</option>
                        <option value="restaurant">🍽️ Restaurant</option>
                        <option value="cafe">☕ Cafe</option>
                        <option value="park">🌳 Park</option>
                        <option value="beach">🏖️ Beach</option>
                        <option value="relative_house">👨‍👩‍👧 Relative's House</option>
                        <option value="nursery">👶 Nursery</option>
                        <option value="playgroup">🎨 Playgroup</option>
                        <option value="soft_play">🎪 Soft Play</option>
                        <option value="attraction">🎡 Attraction</option>
                        <option value="landmark">🏛️ Landmark</option>
                        <option value="other">📍 Other</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          Location *
                        </label>
                        <button
                          onClick={handleGetCurrentLocation}
                          disabled={isLoadingLocation || !GOOGLE_MAPS_API_KEY}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Navigation className="w-3 h-3" />
                          {isLoadingLocation ? 'Getting location...' : 'Use my location'}
                        </button>
                      </div>

                      {GOOGLE_MAPS_API_KEY ? (
                        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
                          <PlacePickerMap
                            center={mapCenter}
                            markerPosition={markerPosition}
                            onMapClick={handleMapClick}
                            onCenterChange={setMapCenter}
                            onMarkerChange={setMarkerPosition}
                          />
                        </APIProvider>
                      ) : (
                        <div className="h-64 rounded-lg border border-gray-300 bg-gray-50 flex items-center justify-center">
                          <p className="text-sm text-gray-500">Google Maps API key required</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={mode === 'select' ? handleLinkToExistingPlace : handleCreateNewPlace}
                disabled={
                  isSubmitting ||
                  (mode === 'select' && !selectedPlaceId) ||
                  (mode === 'create' && !placeName.trim())
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? 'Saving...'
                  : mode === 'select'
                    ? 'Link to Place'
                    : hasPhoto
                      ? 'Create & Link'
                      : 'Create Place'
                }
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
