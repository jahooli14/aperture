import { useEffect, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Calendar, Image, MapPin, Trash2 } from 'lucide-react';
import type { Database } from '../types/database';
import { usePlaceStore } from '../stores/usePlaceStore';
import { usePhotoStore } from '../stores/usePhotoStore';
import { getPhotoDisplayUrl } from '../lib/photoUtils';

type PlaceWithStats = Database['public']['Views']['places_with_stats']['Row'];
type Photo = Database['public']['Tables']['photos']['Row'];

interface PlaceBottomSheetProps {
  place: PlaceWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onPhotoClick?: (photo: Photo) => void;
}

export function PlaceBottomSheet({ place, isOpen, onClose, onPhotoClick }: PlaceBottomSheetProps) {
  const { deletePlace, getPhotosByPlace } = usePlaceStore();
  const { photos } = usePhotoStore();
  const [placePhotos, setPlacePhotos] = useState<Photo[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (place && photos) {
      const photoIds = getPhotosByPlace(place.id);
      const photosForPlace = photos.filter((p) => photoIds.includes(p.id));
      // Sort by upload_date ascending to show first visit first
      const sorted = photosForPlace.sort((a, b) =>
        new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime()
      );
      setPlacePhotos(sorted);
    }
  }, [place, photos, getPhotosByPlace]);

  if (!place) return null;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close if dragged down more than 100px or velocity is high
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${place.name}"? This will unlink all photos from this place.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await deletePlace(place.id);
      onClose();
    } catch (error) {
      console.error('Error deleting place:', error);
      alert('Failed to delete place. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const firstVisitDate = place.first_visit_date;
  const visitDates = place.visit_dates || [];
  const totalVisits = visitDates.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto max-h-[calc(85vh-2rem)]">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1 pr-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{place.name}</h3>
                  {place.description && (
                    <p className="text-sm text-gray-600">{place.description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 -mr-2 -mt-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-4 mb-6">
                {/* First Visit - Highlighted */}
                {firstVisitDate && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900">First Visit</p>
                      <p className="text-base text-gray-900 font-medium">{formatDate(firstVisitDate)}</p>
                    </div>
                  </div>
                )}

                {/* Total Visits */}
                <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Image className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700">Total Visits</p>
                    <p className="text-base text-gray-900">
                      {totalVisits} {totalVisits === 1 ? 'visit' : 'visits'} • {place.photo_count} {place.photo_count === 1 ? 'photo' : 'photos'}
                    </p>
                  </div>
                </div>

                {/* Address */}
                {place.address && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700">Address</p>
                      <p className="text-base text-gray-900">{place.address}</p>
                    </div>
                  </div>
                )}

                {/* Coordinates */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700">Coordinates</p>
                    <p className="text-sm text-gray-900 font-mono">
                      {Number(place.latitude).toFixed(6)}, {Number(place.longitude).toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Photos Grid */}
              {placePhotos.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Photos from Visits</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {placePhotos.map((photo, index) => (
                      <button
                        key={photo.id}
                        onClick={() => onPhotoClick && onPhotoClick(photo)}
                        className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-blue-500 transition-all group"
                      >
                        <img
                          src={getPhotoDisplayUrl(photo)}
                          alt={`Photo from ${photo.upload_date}`}
                          className="w-full h-full object-cover"
                        />
                        {/* First visit badge */}
                        {index === 0 && (
                          <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            First
                          </div>
                        )}
                        {/* Date overlay on hover */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <p className="text-white text-xs font-medium text-center px-2">
                            {formatShortDate(photo.upload_date)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Visit Timeline */}
              {visitDates.length > 1 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Visit Timeline</h4>
                  <div className="space-y-2">
                    {visitDates.slice(0, 10).map((date, index) => (
                      <div key={index} className="flex items-center gap-3 text-sm">
                        <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-400'}`} />
                        <span className={index === 0 ? 'font-medium text-blue-600' : 'text-gray-600'}>
                          {formatShortDate(date)}
                          {index === 0 && ' (First visit)'}
                        </span>
                      </div>
                    ))}
                    {visitDates.length > 10 && (
                      <p className="text-xs text-gray-500 pl-5">
                        + {visitDates.length - 10} more visits
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-50 hover:bg-red-100 active:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors min-h-[56px] disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>{isDeleting ? 'Deleting...' : 'Delete Place'}</span>
                </button>
              </div>

              {/* Bottom Safe Area */}
              <div className="h-8" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
