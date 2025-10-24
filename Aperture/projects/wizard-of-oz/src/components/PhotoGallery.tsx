import { useEffect, useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { usePhotoStore } from '../stores/usePhotoStore';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { PhotoBottomSheet } from './PhotoBottomSheet';
import { triggerHaptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import { PhotoSkeleton } from './PhotoSkeleton';
import { getPhotoDisplayUrl } from '../lib/photoUtils';
import type { Database } from '../types/database';
import type { ToastType } from './Toast';

// Lazy load PhotoOverlay since it's only shown on user interaction
const PhotoOverlay = lazy(() => import('./PhotoOverlay').then(m => ({ default: m.PhotoOverlay })));

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoGalleryProps {
  showToast?: (message: string, type?: ToastType, actionLabel?: string, onAction?: () => void) => void;
}

const PRIVACY_MODE_KEY = 'wizard-privacy-mode';

export function PhotoGallery({ showToast }: PhotoGalleryProps = {}) {
  const { photos, loading, fetchError, fetchPhotos, deletePhoto, restorePhoto, deleting } = usePhotoStore();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [privacyMode, setPrivacyMode] = useState(false);

  // Load privacy mode setting
  useEffect(() => {
    const savedPrivacyMode = localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
    setPrivacyMode(savedPrivacyMode);
  }, []);

  // Fetch photos on mount (only if not already loaded)
  useEffect(() => {
    if (photos.length === 0 && !loading) {
      fetchPhotos();
    }
  }, [photos.length, loading, fetchPhotos]);

  const handlePhotoClick = (photo: Photo, e: React.MouseEvent) => {
    e.preventDefault();
    // Click opens photo details
    setSelectedPhoto(photo);
    setIsBottomSheetOpen(true);
    triggerHaptic('selection');
  };

  const handleViewAll = () => {
    setIsOverlayOpen(true);
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]" />
          <div className="h-6 w-16 bg-gray-200 rounded animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          <PhotoSkeleton count={8} />
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 max-w-md mx-auto space-y-6"
      >
        <div className="mb-6 text-6xl">📸</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Journey</h3>
        <p className="text-gray-600 mb-6">
          Capture one photo each day and watch your baby grow over time
        </p>

        {/* Privacy Indicator */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 mt-0.5">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-900 mb-1">Your Photos Are Private</p>
              <p className="text-xs text-green-700">
                Only you can see your photos. They're securely stored and never shared with anyone.
              </p>
            </div>
          </div>
        </div>

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
        <div className="flex items-center gap-3">
          {hasPhotos && photos.length > 1 && (
            <motion.button
              onClick={handleViewAll}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm rounded-lg transition-colors shadow-md"
            >
              View All
            </motion.button>
          )}
          <p className="text-gray-600">{photos.length} {photos.length === 1 ? 'day' : 'days'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            transition={{
              delay: index * 0.05,
              type: 'spring',
              stiffness: 400,
              damping: 17
            }}
            onClick={(e) => handlePhotoClick(photo, e)}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 shadow-md hover:shadow-2xl transition-shadow cursor-pointer group select-none"
          >
            <>
              {/* Smooth background placeholder - no more skeleton flash */}
              <div className="absolute inset-0 bg-gray-100" />

              <img
                src={getPhotoDisplayUrl(photo)}
                alt={`Photo from ${photo.upload_date}`}
                className={`relative w-full h-full object-cover opacity-0 transition-opacity duration-500 ${privacyMode ? 'blur-2xl' : ''}`}
                loading="lazy"
                onLoad={(e) => {
                  e.currentTarget.classList.remove('opacity-0');
                  e.currentTarget.classList.add('opacity-100');
                }}
              />

              {/* Comment indicator chip - using same logic as PhotoBottomSheet */}
              {(() => {
                if (!photo.metadata || typeof photo.metadata !== 'object') return null;
                const metadata = photo.metadata as Record<string, unknown>;
                const note = ('note' in metadata && metadata.note) ? String(metadata.note) : '';
                const emoji = ('emoji' in metadata && metadata.emoji) ? String(metadata.emoji) : '💬';

                return note.trim() && (
                  <div className="absolute top-2 right-2 bg-blue-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full flex items-center shadow-lg">
                    <span className="text-base">{emoji}</span>
                  </div>
                );
              })()}

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
            </>
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

      {/* Photo Bottom Sheet */}
      <PhotoBottomSheet
        photo={selectedPhoto}
        isOpen={isBottomSheetOpen}
        onClose={() => {
          setIsBottomSheetOpen(false);
          setSelectedPhoto(null);
        }}
        onDelete={() => {
          if (selectedPhoto) {
            setPhotoToDelete(selectedPhoto);
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        photo={photoToDelete}
        isOpen={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={async () => {
          if (photoToDelete) {
            try {
              // Delete the photo
              await deletePhoto(photoToDelete.id);

              // Close modal
              setPhotoToDelete(null);

              // Trigger haptic feedback
              triggerHaptic('warning');

              // Show undo toast with action
              const photoDate = new Date(photoToDelete.upload_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              // Capture the photo in closure for undo callback
              const photoToRestore = photoToDelete;

              if (showToast) {
                showToast(
                  `Photo from ${photoDate} deleted`,
                  'info',
                  'UNDO',
                  () => {
                    // Restore the photo
                    restorePhoto(photoToRestore);
                    triggerHaptic('success');
                    if (undoTimer) {
                      clearTimeout(undoTimer);
                      setUndoTimer(null);
                    }
                  }
                );
              }

              // Set timer to clear undo after 5 seconds
              if (undoTimer) {
                clearTimeout(undoTimer);
              }

              const timer = setTimeout(() => {
                // Timer expired, undo is no longer available
                setUndoTimer(null);
              }, 5000);

              setUndoTimer(timer);

            } catch (error) {
              logger.error('Failed to delete photo', { error: error instanceof Error ? error.message : String(error), photoId: photoToDelete.id }, 'PhotoGallery');
              if (showToast) {
                showToast('Failed to delete photo', 'error');
              }
              // Keep modal open on error so user can try again
            }
          }
        }}
        deleting={deleting}
      />
    </div>
  );
}
