import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoOverlayProps {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoOverlay({ photos, isOpen, onClose }: PhotoOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter only aligned photos, sort oldest to newest for progression
  const alignedPhotos = photos
    .filter(p => p.aligned_url)
    .sort((a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());

  // Reset to first photo when overlay opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentIndex(Math.max(0, currentIndex - 1));
      if (e.key === 'ArrowRight') setCurrentIndex(Math.min(alignedPhotos.length - 1, currentIndex + 1));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, alignedPhotos.length, onClose]);

  if (alignedPhotos.length === 0) {
    return null;
  }

  const currentPhoto = alignedPhotos[currentIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close overlay"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Main content */}
          <div
            className="h-full flex flex-col items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Photo stack container */}
            <div className="relative w-full max-w-2xl aspect-square mb-6">
              {/* Stack all photos with opacity transition */}
              {alignedPhotos.map((photo, index) => (
                <motion.img
                  key={photo.id}
                  src={photo.aligned_url!}
                  alt={`Photo from ${photo.upload_date}`}
                  className="absolute inset-0 w-full h-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: index === currentIndex ? 1 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                />
              ))}
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
                Day {currentIndex + 1} of {alignedPhotos.length}
              </p>
            </div>

            {/* Scrubber slider */}
            <div className="w-full max-w-2xl">
              <input
                type="range"
                min="0"
                max={alignedPhotos.length - 1}
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

            {/* Navigation hints */}
            <div className="mt-6 text-center text-sm text-white/40">
              <p>Use arrow keys or drag slider to navigate • ESC to close</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
