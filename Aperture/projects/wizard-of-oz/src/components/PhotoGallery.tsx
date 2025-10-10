import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePhotoStore } from '../stores/usePhotoStore';
import { PhotoOverlay } from './PhotoOverlay';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

export function PhotoGallery() {
  const { photos, loading, fetchPhotos, deletePhoto, deleting } = usePhotoStore();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

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
    // Only open overlay if not in a long press state
    if (hasAlignedPhotos && !longPressTimer.current) {
      setIsOverlayOpen(true);
    }
  };

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
        className="text-center py-12"
      >
        <p className="text-gray-600 text-lg">No photos yet. Upload your first one!</p>
      </motion.div>
    );
  }

  // Check if we have any aligned photos for the overlay
  const hasAlignedPhotos = photos.some(p => p.aligned_url);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Your Journey</h2>
        <p className="text-gray-600">{photos.length} {photos.length === 1 ? 'day' : 'days'}</p>
      </div>

      {hasAlignedPhotos && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">✨ Tip:</span> Click any photo to see your baby's journey with aligned eyes!
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
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-md active:shadow-xl md:hover:shadow-xl transition-shadow cursor-pointer group select-none"
          >
            <img
              src={photo.aligned_url || photo.original_url}
              alt={`Photo from ${photo.upload_date}`}
              className="w-full h-full object-cover"
              loading="lazy"
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
                {photo.aligned_url && (
                  <p className="text-white/80 text-xs mt-0.5">✓ Aligned</p>
                )}
                {!photo.aligned_url && photo.original_url && (
                  <p className="text-yellow-300 text-xs mt-0.5">⏳ Processing...</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Photo Overlay */}
      <PhotoOverlay
        photos={photos}
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
      />

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
