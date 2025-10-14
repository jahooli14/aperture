import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { usePhotoStore } from '../stores/usePhotoStore';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { Database } from '../types/database';

// Lazy load PhotoOverlay since it's only shown on user interaction
const PhotoOverlay = lazy(() => import('./PhotoOverlay').then(m => ({ default: m.PhotoOverlay })));

type Photo = Database['public']['Tables']['photos']['Row'];

export function PhotoGallery() {
  const { photos, loading, fetchError, fetchPhotos, deletePhoto, deleting } = usePhotoStore();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch photos on mount
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handlePressStart = (photo: Photo, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    longPressTimer.current = setTimeout(() => {
      setPhotoToDelete(photo);
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 800); // 800ms long press
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePhotoClick = (_photo: Photo, _e: React.MouseEvent) => {
    // Only open overlay if we have multiple photos and not in a long press state
    if (photos.length > 1 && !longPressTimer.current) {
      setIsOverlayOpen(true);
    }
  };

  if (fetchError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-red-50 border border-red-200 rounded-lg p-6"
      >
        <h3 className="text-red-800 font-semibold text-lg mb-2">❌ Error Loading Photos</h3>
        <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono bg-white p-4 rounded border border-red-200 overflow-auto max-h-96">
          {fetchError}
        </pre>
        <button
          type="button"
          onClick={() => fetchPhotos()}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          Retry
        </button>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Loading photos...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 max-w-md mx-auto"
      >
        <div className="mb-6 text-6xl">📸</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Journey</h3>
        <p className="text-gray-600 mb-6">
          Capture one photo each day and watch your baby grow over time
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
          <p className="text-sm font-semibold text-blue-900 mb-2">✨ Tips:</p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use good lighting for best results</li>
            <li>• Keep your baby's face visible</li>
            <li>• Photos align automatically with eye detection</li>
            <li>• One photo per day creates a beautiful timelapse</li>
          </ul>
        </div>
      </motion.div>
    );
  }

  // Check if we have any photos for the overlay
  const hasPhotos = photos.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Your Journey</h2>
        <p className="text-gray-600">{photos.length} {photos.length === 1 ? 'day' : 'days'}</p>
      </div>

      {hasPhotos && photos.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">✨ Tip:</span> Click any photo to see your baby's journey timeline!
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Long press to delete a photo
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={(e) => handlePhotoClick(photo, e)}
            onMouseDown={(e) => handlePressStart(photo, e)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={(e) => handlePressStart(photo, e)}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressEnd}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 shadow-md active:shadow-xl md:hover:shadow-xl transition-shadow cursor-pointer group select-none"
          >
            {/* Skeleton loader background */}
            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />

            <img
              src={photo.aligned_url || photo.original_url}
              alt={`Photo from ${photo.upload_date}`}
              className="w-full h-full object-cover transition-opacity duration-300"
              loading="lazy"
              onLoad={(e) => e.currentTarget.classList.add('opacity-100')}
              style={{ opacity: 0 }}
            />

            {/* Overlay with date - always visible on mobile, hover on desktop */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                <p className="text-white text-xs md:text-sm font-medium">
                  {new Date(photo.upload_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Photo Overlay - Lazy loaded */}
      {isOverlayOpen && (
        <Suspense fallback={null}>
          <PhotoOverlay
            photos={photos}
            isOpen={isOverlayOpen}
            onClose={() => setIsOverlayOpen(false)}
          />
        </Suspense>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        photo={photoToDelete}
        isOpen={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={async () => {
          if (photoToDelete) {
            try {
              await deletePhoto(photoToDelete.id);
              setPhotoToDelete(null);
            } catch (error) {
              console.error('Failed to delete photo:', error);
              // Keep modal open on error so user can try again
            }
          }
        }}
        deleting={deleting}
      />
    </div>
  );
}
