import { useEffect, useState, lazy, Suspense, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { usePhotoStore } from '../stores/usePhotoStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { PhotoBottomSheet } from './PhotoBottomSheet';
import { triggerHaptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import { PhotoSkeleton } from './PhotoSkeleton';
import { getPhotoDisplayUrl } from '../lib/photoUtils';
import type { Database } from '../types/database';
import type { ToastType } from './Toast';

// Image loading with retry logic
interface ImageWithRetryProps {
  src: string;
  alt: string;
  className: string;
  privacyMode: boolean;
}

function ImageWithRetry({ src, alt, className, privacyMode }: ImageWithRetryProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000];

  // Generate a unique key to force image reload on retry
  const imageSrc = retryCount > 0 ? `${src}${src.includes('?') ? '&' : '?'}_retry=${retryCount}` : src;

  const handleError = useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      logger.warn('Image load failed, retrying', { src, attempt: retryCount + 1 }, 'ImageWithRetry');
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, RETRY_DELAYS[retryCount]);
    } else {
      setHasError(true);
      logger.error('Image load failed after retries', { src }, 'ImageWithRetry');
    }
  }, [retryCount, src]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
  }, []);

  if (hasError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-400 text-xs p-2">
          <div className="text-2xl mb-1">📷</div>
          <button
            onClick={() => {
              setHasError(false);
              setRetryCount(0);
            }}
            className="text-blue-500 hover:underline"
          >
            Tap to retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} ${privacyMode ? 'blur-2xl' : ''}`}
      loading="lazy"
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}

// Lazy load PhotoOverlay since it's only shown on user interaction
const PhotoOverlay = lazy(() => import('./PhotoOverlay').then(m => ({ default: m.PhotoOverlay })));

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoGalleryProps {
  showToast?: (message: string, type?: ToastType, actionLabel?: string, onAction?: () => void) => void;
}

const PRIVACY_MODE_KEY = 'wizard-privacy-mode';

export function PhotoGallery({ showToast }: PhotoGalleryProps = {}) {
  const { photos, loading, fetchError, fetchPhotos, deletePhoto, restorePhoto, deleting } = usePhotoStore();
  const { getJoinedAccount } = useSettingsStore();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [isConnectedToAlbum, setIsConnectedToAlbum] = useState<boolean | null>(null);
  const [privacyMode, setPrivacyMode] = useState(false);

  // Load privacy mode setting
  useEffect(() => {
    const savedPrivacyMode = localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
    setPrivacyMode(savedPrivacyMode);
  }, []);

  // Check if user is connected to a shared album
  useEffect(() => {
    async function checkConnection() {
      try {
        const joined = await getJoinedAccount();
        setIsConnectedToAlbum(joined !== null);
      } catch {
        setIsConnectedToAlbum(false);
      }
    }
    checkConnection();
  }, [getJoinedAccount]);

  // Fetch photos on mount
  useEffect(() => {
    if (photos.length === 0 && !loading) {
      fetchPhotos();
    }
  }, [photos.length, loading, fetchPhotos]);

  // All photos are displayed without filtering
  const filteredPhotos = useMemo(() => {
    return photos;
  }, [photos]);


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

        {/* Shared Album Notice - show if user is not connected */}
        {isConnectedToAlbum === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">Join a Shared Album?</p>
                <p className="text-xs text-amber-700">
                  If your partner has already uploaded photos, ask them for their invite code. Go to <strong>Settings</strong> and enter the code under "Join Shared Album" to see their photos.
                </p>
              </div>
            </div>
          </div>
        )}

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
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Journey</h2>
            <p className="text-sm text-gray-600 mt-1">{filteredPhotos.length} {filteredPhotos.length === 1 ? 'day' : 'days'} captured</p>
          </div>
        </div>

        {hasPhotos && photos.length > 1 && (
          <motion.button
            onClick={handleViewAll}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mb-6 py-3 px-6 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-lg transition-all shadow-lg"
          >
            🎬 Watch Their Growth
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {filteredPhotos.map((photo, index) => (
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

              <ImageWithRetry
                src={getPhotoDisplayUrl(photo)}
                alt={`Photo from ${photo.upload_date}`}
                className="relative w-full h-full object-cover transition-opacity duration-500"
                privacyMode={privacyMode}
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
