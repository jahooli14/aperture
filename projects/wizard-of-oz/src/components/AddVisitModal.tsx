import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Plus } from 'lucide-react';
import { usePlaceStore } from '../stores/usePlaceStore';
import type { Database } from '../types/database';

type PlaceWithStats = Database['public']['Views']['places_with_stats']['Row'];

interface AddVisitModalProps {
  isOpen: boolean;
  selectedPlace: PlaceWithStats | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddVisitModal({ isOpen, selectedPlace, onClose, onSuccess }: AddVisitModalProps) {
  const { placesWithStats, addPlaceVisit } = usePlaceStore();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && selectedPlace) {
      setSelectedPlaceId(selectedPlace.id);
    }
  }, [isOpen, selectedPlace]);

  const handleSubmit = async () => {
    if (!selectedPlaceId || !visitDate) {
      setError('Please select a place and date');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await addPlaceVisit({
        place_id: selectedPlaceId,
        visit_date: visitDate,
        notes: notes.trim() || null,
      });

      // Reset form
      setVisitDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setSelectedPlaceId(selectedPlace?.id || null);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError('');
    setNotes('');
    setSelectedPlaceId(selectedPlace?.id || null);
    onClose();
  };

  if (!isOpen) return null;

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
            className="fixed inset-4 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-md mx-auto my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add Visit</h2>
              <button
                onClick={handleClose}
                className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Place Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Select Place *
                </label>
                <select
                  value={selectedPlaceId || ''}
                  onChange={(e) => setSelectedPlaceId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">-- Choose a place --</option>
                  {placesWithStats.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name} {place.description ? `(${place.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Date of Visit *
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., First time, visited with grandma, great beer..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none h-20"
                />
              </div>

              {/* Selected place info */}
              {selectedPlaceId && placesWithStats.find((p) => p.id === selectedPlaceId) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  {(() => {
                    const place = placesWithStats.find((p) => p.id === selectedPlaceId);
                    return (
                      <>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-blue-900">{place?.name}</p>
                            {place?.address && (
                              <p className="text-xs text-blue-700 mt-1">{place.address}</p>
                            )}
                            <p className="text-xs text-blue-600 mt-1">
                              {place?.visit_dates?.length || 0} visit{place?.visit_dates?.length === 1 ? '' : 's'} recorded
                            </p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedPlaceId || !visitDate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {isSubmitting ? 'Adding...' : 'Add Visit'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
