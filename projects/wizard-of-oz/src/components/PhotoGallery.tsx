import { useEffect, useState, lazy, Suspense, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { lazyRetry } from '../lib/lazyRetry';
import { usePhotoStore } from '../stores/usePhotoStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { triggerHaptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import { PhotoSkeleton } from './PhotoSkeleton';
import { getPhotoDisplayUrl } from '../lib/photoUtils';
import { formatRelativeDate, getTodayLocalDateString } from '../lib/dateUtils';
import { calculateAge, formatAge } from '../lib/ageUtils';
import { currentStreak } from '../lib/streak';
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
const PhotoOverlay = lazy(lazyRetry(() => import('./PhotoOverlay').then(m => ({ default: m.PhotoOverlay }))));

// PhotoBottomSheet pulls in EyeAdjust + AddPlaceModal + place store — defer it
// until the user actually taps a photo so the initial Watch tab is lighter.
const PhotoBottomSheet = lazy(lazyRetry(() => import('./PhotoBottomSheet').then(m => ({ default: m.PhotoBottomSheet }))));

// DeleteConfirmModal only renders after a delete action — no need to ship it
// on first paint.
const DeleteConfirmModal = lazy(lazyRetry(() => import('./DeleteConfirmModal').then(m => ({ default: m.DeleteConfirmModal }))));

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoGalleryProps {
  showToast?: (message: string, type?: ToastType, actionLabel?: string, onAction?: () => void) => void;
}

const PRIVACY_MODE_KEY = 'wizard-privacy-mode';

export function PhotoGallery({ showToast }: PhotoGalleryProps = {}) {
  const { photos, loading, fetchError, fetchPhotos, deletePhoto, restorePhoto, deleting, reAlignBacklog } = usePhotoStore();
  const { getJoinedAccount, settings } = useSettingsStore();
  const [realignState, setRealignState] = useState<{ done: number; total: number } | null>(null);
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

  // Photos the current pipeline hasn't aligned yet (legacy uploads + any that
  // were committed before detection succeeded). These are the ones that don't
  // stack in the timeline.
  const unalignedCount = useMemo(
    () => photos.filter((p) => !p.alignment_transform).length,
    [photos]
  );

  // Consecutive-day capture streak — gently reinforces the one-a-day habit.
  // Must be computed here, ABOVE the early returns below: hooks can't sit after
  // a conditional `return` or the hook count changes between the loading render
  // and the loaded render, which crashes the whole tree (white screen).
  const streak = useMemo(
    () => currentStreak(photos.map((p) => p.upload_date)),
    [photos]
  );

  const handleFixAlignment = async () => {
    if (realignState) return;
    setRealignState({ done: 0, total: unalignedCount });
    try {
      const res = await reAlignBacklog(
        settings?.baby_birthdate ?? null,
        (done, total) => setRealignState({ done, total })
      );
      if (showToast) {
        const msg = res.failed > 0
          ? `Aligned ${res.aligned}. ${res.failed} couldn't be auto-detected — tap those to place the eyes by hand.`
          : `Aligned ${res.aligned} photo${res.aligned === 1 ? '' : 's'}. The timeline now stacks.`;
        showToast(msg, res.failed > 0 ? 'info' : 'success');
      }
    } catch (err) {
      if (showToast) {
        showToast(err instanceof Error ? err.message : 'Re-align failed', 'error');
      }
    } finally {
      setRealignState(null);
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

  // Baby's age today, shown in the header for emotional context.
  const ageToday = settings?.baby_birthdate
    ? formatAge(calculateAge(settings.baby_birthdate, getTodayLocalDateString()))
    : null;

  const todayStr = getTodayLocalDateString();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Journey</h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredPhotos.length} {filteredPhotos.length === 1 ? 'day' : 'days'} captured
              {ageToday && <span className="text-gray-400"> · {ageToday} old</span>}
            </p>
          </div>
          {streak >= 2 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
              <span className="text-base leading-none">🔥</span>
              <span className="text-sm font-semibold text-orange-700">
                {streak} day streak
              </span>
            </div>
          )}
        </div>

        {hasPhotos && photos.length > 1 && (
          <motion.button
            onClick={handleViewAll}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mb-3 py-3 px-6 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-lg transition-all shadow-lg"
          >
            🎬 Watch Their Growth
          </motion.button>
        )}

        {hasPhotos && unalignedCount > 0 && (
          <button
            onClick={handleFixAlignment}
            disabled={!!realignState}
            className="w-full mb-6 py-3 px-6 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {realignState
              ? `Re-aligning ${realignState.done}/${realignState.total}…`
              : `Fix alignment on ${unalignedCount} photo${unalignedCount === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {filteredPhotos.map((photo) => {
          // Comment chip metadata — computed inline so we don't churn the JSX
          // object identity per render.
          let chipEmoji = '';
          if (photo.metadata && typeof photo.metadata === 'object') {
            const metadata = photo.metadata as Record<string, unknown>;
            const note = ('note' in metadata && metadata.note) ? String(metadata.note) : '';
            if (note.trim()) {
              chipEmoji = ('emoji' in metadata && metadata.emoji) ? String(metadata.emoji) : '💬';
            }
          }

          // Plain <button> with CSS transitions instead of framer-motion per
          // tile. The old stagger (delay: index * 0.05) blocked the grid for
          // ~5s with 100 photos before everything was visible — now the whole
          // grid paints in one frame, with CSS-only press/hover affordances.
          const isToday = photo.upload_date === todayStr;

          return (
            <button
              key={photo.id}
              type="button"
              onClick={(e) => handlePhotoClick(photo, e)}
              className={`relative aspect-square rounded-lg overflow-hidden bg-gray-200 shadow-md hover:shadow-2xl active:scale-[0.97] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-150 cursor-pointer group select-none touch-manipulation ${
                isToday ? 'ring-2 ring-primary-500 ring-offset-2' : ''
              }`}
            >
              {/* Smooth background placeholder - no more skeleton flash */}
              <div className="absolute inset-0 bg-gray-100" />

              <ImageWithRetry
                src={getPhotoDisplayUrl(photo)}
                alt={`Photo from ${photo.upload_date}`}
                className="relative w-full h-full object-cover transition-opacity duration-300"
                privacyMode={privacyMode}
              />

              {chipEmoji && (
                <div className="absolute top-2 right-2 bg-blue-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full flex items-center shadow-lg">
                  <span className="text-base">{chipEmoji}</span>
                </div>
              )}

              {/* Overlay with date - always visible on mobile, hover on desktop */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 text-left">
                  <p className="text-white text-xs md:text-sm font-medium">
                    {formatRelativeDate(photo.upload_date)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
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

      {/* Photo Bottom Sheet — lazy: only mounts after the first photo click */}
      {(isBottomSheetOpen || selectedPhoto) && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Delete Confirmation Modal — lazy: only mounts after a delete tap */}
      {photoToDelete && (
        <Suspense fallback={null}>
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
                  const photoDate = formatRelativeDate(photoToDelete.upload_date);

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
        </Suspense>
      )}
    </div>
  );
}
