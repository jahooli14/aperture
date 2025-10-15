import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

interface ComparisonSliderProps {
  photo1: Photo;
  photo2: Photo;
  position: number; // 0-100
  onPositionChange: (pos: number) => void;
}

export function ComparisonSlider({ photo1, photo2, position, onPositionChange }: ComparisonSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleInteractionStart = (clientX: number) => {
    setIsDragging(true);
    updatePosition(clientX);
  };

  const handleInteractionMove = (clientX: number) => {
    if (isDragging) {
      updatePosition(clientX);
    }
  };

  const handleInteractionEnd = () => {
    setIsDragging(false);
  };

  const updatePosition = (clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    onPositionChange(percentage);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleInteractionStart(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleInteractionMove(e.clientX);
      }
    };

    const handleMouseUp = () => {
      handleInteractionEnd();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleInteractionStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleInteractionMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleInteractionEnd();
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] max-w-md mx-auto overflow-hidden rounded-2xl shadow-2xl bg-gray-100 cursor-ew-resize select-none touch-none"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Photo 2 (background - right side) */}
      <div className="absolute inset-0">
        <img
          src={photo2.aligned_url || photo2.original_url}
          alt={`Photo from ${photo2.upload_date}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
          <span className="text-white text-sm font-medium">
            {new Date(photo2.upload_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Photo 1 (foreground - left side with clip) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          clipPath: `inset(0 ${100 - position}% 0 0)`,
        }}
      >
        <img
          src={photo1.aligned_url || photo1.original_url}
          alt={`Photo from ${photo1.upload_date}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
          <span className="text-white text-sm font-medium">
            {new Date(photo1.upload_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Slider Handle */}
      <motion.div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none"
        style={{
          left: `${position}%`,
          transform: 'translateX(-50%)',
        }}
        animate={{ opacity: isDragging ? 1 : 0.8 }}
      >
        {/* Handle Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center pointer-events-auto cursor-ew-resize">
          <div className="flex gap-1">
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
