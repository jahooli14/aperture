import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Camera, MapPin, Star } from 'lucide-react';

interface QuickAddFABProps {
  onAddPhoto: () => void;
  onAddPlace: () => void;
  onAddMilestone: () => void;
}

export function QuickAddFAB({ onAddPhoto, onAddPlace, onAddMilestone }: QuickAddFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div
      ref={fabRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
    >
      {/* Action buttons - appear when FAB is open */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Add Milestone */}
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              transition={{ duration: 0.15, delay: 0.1 }}
              onClick={() => handleAction(onAddMilestone)}
              className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg font-medium transition-colors"
            >
              <Star className="w-5 h-5" />
              <span>Milestone</span>
            </motion.button>

            {/* Add Place */}
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              transition={{ duration: 0.15, delay: 0.05 }}
              onClick={() => handleAction(onAddPlace)}
              className="flex items-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-full shadow-lg font-medium transition-colors"
            >
              <MapPin className="w-5 h-5" />
              <span>Place</span>
            </motion.button>

            {/* Add Photo */}
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleAction(onAddPhoto)}
              className="flex items-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg font-medium transition-colors"
            >
              <Camera className="w-5 h-5" />
              <span>Photo</span>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={`
          w-14 h-14 rounded-full shadow-lg flex items-center justify-center
          transition-colors touch-manipulation
          ${isOpen
            ? 'bg-gray-600 hover:bg-gray-700'
            : 'bg-primary-600 hover:bg-primary-700'
          }
        `}
        aria-label={isOpen ? 'Close quick add menu' : 'Open quick add menu'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Plus className="w-6 h-6 text-white" />
        )}
      </motion.button>
    </div>
  );
}
