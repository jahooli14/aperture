import { motion } from 'framer-motion';
import { Camera, FolderOpen } from 'lucide-react';

interface UploadButtonsProps {
  onCameraClick: () => void;
  onGalleryClick: () => void;
}

export function UploadButtons({ onCameraClick, onGalleryClick }: UploadButtonsProps) {
  return (
    <div className="space-y-3">
      <motion.button
        type="button"
        onClick={onCameraClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-medium py-4 px-6 rounded-lg transition-colors mb-3 min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
      >
        <Camera className="w-5 h-5" />
        <span>Take Photo</span>
      </motion.button>

      <motion.button
        type="button"
        onClick={onGalleryClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className="w-full bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-900 font-medium py-4 px-6 rounded-lg border-2 border-gray-300 transition-colors min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
      >
        <FolderOpen className="w-5 h-5" />
        <span>Choose from Gallery</span>
      </motion.button>
    </div>
  );
}
