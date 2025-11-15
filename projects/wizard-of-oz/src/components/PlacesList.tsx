import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaceStore } from '../stores/usePlaceStore';
import type { Database } from '../types/database';
import { AddVisitModal } from './AddVisitModal';

type PlaceWithStats = Database['public']['Views']['places_with_stats']['Row'];

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

const CATEGORY_LABELS: Record<string, string> = {
  pub: 'Pub',
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  park: 'Park',
  beach: 'Beach',
  relative_house: "Relative's House",
  nursery: 'Nursery',
  playgroup: 'Playgroup',
  soft_play: 'Soft Play',
  attraction: 'Attraction',
  landmark: 'Landmark',
  other: 'Other',
};

interface PlacesListProps {
  onEditPlace?: (place: PlaceWithStats) => void;
}

export function PlacesList({ onEditPlace }: PlacesListProps) {
  const { placesWithStats, placeVisits, fetchPlacesWithStats, fetchPlaceVisits, deletePlaceVisit, loading } = usePlaceStore();
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithStats | null>(null);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [sortBy, setSortBy] = useState<'first-visit' | 'name'>('first-visit');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlacesWithStats();
    fetchPlaceVisits();
  }, []);

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm('Are you sure you want to delete this visit?')) return;
    try {
      await deletePlaceVisit(visitId);
    } catch (error) {
      console.error('Error deleting visit:', error);
    }
  };

  const filteredPlaces = selectedCategory
    ? placesWithStats.filter((p) => p.category === selectedCategory)
    : placesWithStats;

  const sortedPlaces = [...filteredPlaces].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    // First visit
    const dateA = a.first_visit_date ? new Date(a.first_visit_date).getTime() : Infinity;
    const dateB = b.first_visit_date ? new Date(b.first_visit_date).getTime() : Infinity;
    return dateA - dateB;
  });

  // Get unique categories from places
  const availableCategories = Array.from(new Set(placesWithStats.map((p) => p.category || 'other'))).sort();

  const getPlaceVisits = (placeId: string) => {
    return placeVisits
      .filter((pv) => pv.place_id === placeId)
      .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

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

  if (placesWithStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold mb-2">No Places Yet</h2>
          <p className="text-gray-600">
            Start tracking special places you've visited with your baby!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Places Timeline</h1>
            <p className="text-sm text-gray-600">Track visits to special locations</p>
          </div>
          <button
            onClick={() => setShowAddVisitModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Visit
          </button>
        </div>

        {/* Sort options */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSortBy('first-visit')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              sortBy === 'first-visit'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            First Visit
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              sortBy === 'name'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            By Name
          </button>
        </div>

        {/* Category filter */}
        {availableCategories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Places
            </button>
            {availableCategories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  selectedCategory === category
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{CATEGORY_ICONS[category] || '📍'}</span>
                {CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Places List with Click to Expand */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-200 p-4">
          {sortedPlaces.map((place) => {
            const visits = getPlaceVisits(place.id);
            const isExpanded = expandedPlaceId === place.id;

            return (
              <motion.div
                key={place.id}
                layout
                initial={false}
              >
                {/* Compact Row - Always Visible */}
                <button
                  onClick={() => setExpandedPlaceId(isExpanded ? null : place.id)}
                  className="w-full flex items-center justify-between py-4 px-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{CATEGORY_ICONS[place.category || 'other'] || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{place.name}</p>
                      <p className="text-xs text-gray-500">{visits.length} {visits.length === 1 ? 'visit' : 'visits'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {CATEGORY_LABELS[place.category || 'other'] || 'Other'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden bg-blue-50"
                    >
                      <div className="px-4 py-4 space-y-4">
                        {/* Place Info */}
                        <div className="space-y-2">
                          {place.description && (
                            <div>
                              <p className="text-xs font-medium text-gray-600 mb-1">Description</p>
                              <p className="text-sm text-gray-700">{place.description}</p>
                            </div>
                          )}
                          {place.first_visit_date && (
                            <div>
                              <p className="text-xs font-medium text-gray-600">First visited</p>
                              <p className="text-sm text-gray-700">{formatDate(place.first_visit_date)}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white rounded p-2">
                              <p className="text-xs text-gray-600">Visits</p>
                              <p className="text-lg font-bold text-blue-600">{visits.length}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-xs text-gray-600">Photos</p>
                              <p className="text-lg font-bold text-purple-600">{place.photo_count || 0}</p>
                            </div>
                          </div>
                        </div>

                        {/* Visits List */}
                        {visits.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-600 uppercase">Recent Visits</p>
                            <div className="space-y-1">
                              {visits.slice(0, 5).map((visit) => (
                                <div key={visit.id} className="flex items-center justify-between text-sm bg-white rounded p-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-gray-900">{formatDate(visit.visit_date)}</p>
                                    {visit.notes && <p className="text-xs text-gray-600 truncate">{visit.notes}</p>}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteVisit(visit.id);
                                    }}
                                    className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 rounded transition-colors ml-2"
                                    aria-label="Delete visit"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              {visits.length > 5 && (
                                <p className="text-xs text-gray-500 text-center py-1">+{visits.length - 5} more visits</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlace(place);
                              setShowAddVisitModal(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Add Visit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditPlace?.(place);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Add Visit Modal */}
      <AddVisitModal
        isOpen={showAddVisitModal}
        selectedPlace={selectedPlace}
        onClose={() => {
          setShowAddVisitModal(false);
          setSelectedPlace(null);
        }}
        onSuccess={() => {
          setShowAddVisitModal(false);
          setSelectedPlace(null);
          fetchPlaceVisits();
        }}
      />
    </div>
  );
}
