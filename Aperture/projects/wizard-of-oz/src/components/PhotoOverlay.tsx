import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';
import { useGesture } from '@use-gesture/react';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoOverlayProps {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoOverlay({ photos, isOpen, onClose }: PhotoOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showZoomHint, setShowZoomHint] = useState(true);
  const imageRef = useRef<HTMLDivElement>(null);

  // Sort all photos oldest to newest for progression
  const sortedPhotos = photos
    .sort((a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());

  // Reset state when overlay opens or photo changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      // Hide zoom hint after 3 seconds
      const timer = setTimeout(() => setShowZoomHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Gesture handling
  const bind = useGesture(
    {
      onDrag: ({ offset: [x, y], cancel }) => {
        // Only allow dragging when zoomed in
        if (scale <= 1) {
          cancel();
          return;
        }
        setPosition({ x, y });
      },
      onPinch: ({ offset: [d], cancel }) => {
        // Prevent pinch when already zoomed out
        if (d < 1 && scale <= 1) {
          cancel();
          return;
        }

        const newScale = Math.max(1, Math.min(4, d));
        setScale(newScale);

        // Reset position when zooming out completely
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
      },
      // Swipe to change photos (only when not zoomed)
      onDragEnd: ({ movement: [mx], direction: [dx], cancel }) => {
        if (scale > 1) {
          cancel();
          return;
        }

        // Swipe threshold
        if (Math.abs(mx) > 50) {
          if (dx > 0 && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
          } else if (dx < 0 && currentIndex < sortedPhotos.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
        }
      },
    },
    {
      drag: { from: () => [position.x, position.y] },
      pinch: { from: () => [scale, 0], scaleBounds: { min: 1, max: 4 } },
    }
  );

  // Double-tap to zoom
  const handleDoubleTap = () => {
    if (scale === 1) {
      setScale(2);
      setShowZoomHint(false);
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (scale > 1) return; // Disable keyboard nav when zoomed

      if (e.key === 'Escape') {
        if (scale > 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowLeft') setCurrentIndex(Math.max(0, currentIndex - 1));
      if (e.key === 'ArrowRight') setCurrentIndex(Math.min(sortedPhotos.length - 1, currentIndex + 1));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, sortedPhotos.length, onClose, scale]);

  if (sortedPhotos.length === 0) {
    return null;
  }

  const currentPhoto = sortedPhotos[currentIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
          onClick={() => scale === 1 && onClose()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Close overlay"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Zoom hint */}
          {showZoomHint && scale === 1 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 bg-black/60 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              <ZoomIn className="w-4 h-4" />
              <span>Pinch or double-tap to zoom</span>
            </motion.div>
          )}

          {/* Main content */}
          <div
            className="h-full flex flex-col items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Photo container with gestures */}
            <div
              ref={imageRef}
              className="relative w-full max-w-2xl aspect-square mb-6 touch-none select-none"
              onDoubleClick={handleDoubleTap}
            >
              {/* Photo with transform */}
              <div
                {...(bind() as object)}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  touchAction: 'none',
                }}
                className="absolute inset-0 cursor-grab active:cursor-grabbing transition-transform"
              >
                {sortedPhotos.map((photo, index) => (
                  <motion.img
                    key={photo.id}
                    src={photo.aligned_url || photo.original_url}
                    alt={`Photo from ${photo.upload_date}`}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: index === currentIndex ? 1 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>
            </div>

            {/* Date display */}
            <div className="text-white text-center mb-4">
              <p className="text-2xl font-bold">
                {new Date(currentPhoto.upload_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-white/60 mt-1">
                Day {currentIndex + 1} of {sortedPhotos.length}
              </p>
              {scale > 1 && (
                <p className="text-xs text-white/40 mt-1">
                  Zoom: {scale.toFixed(1)}x
                </p>
              )}
            </div>

            {/* Scrubber slider - hide when zoomed */}
            {scale === 1 && (
              <div className="w-full max-w-2xl">
                <input
                  type="range"
                  min="0"
                  max={sortedPhotos.length - 1}
                  value={currentIndex}
                  onChange={(e) => setCurrentIndex(Number(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-lg"
                />

                {/* Timeline markers */}
                <div className="flex justify-between mt-2 text-xs text-white/40">
                  <span>Start</span>
                  <span>Today</span>
                </div>
              </div>
            )}

            {/* Navigation hints */}
            <div className="mt-6 text-center text-sm text-white/40">
              {scale === 1 ? (
                <p>Swipe or use arrow keys to navigate • ESC to close</p>
              ) : (
                <p>Drag to pan • Pinch to zoom out • ESC to reset</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
