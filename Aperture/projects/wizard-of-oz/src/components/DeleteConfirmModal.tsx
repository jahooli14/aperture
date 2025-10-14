import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X, Loader2 } from 'lucide-react';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

interface DeleteConfirmModalProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting?: boolean;
}

export function DeleteConfirmModal({ photo, isOpen, onClose, onConfirm, deleting = false }: DeleteConfirmModalProps) {
  if (!photo) return null;

  const photoDate = new Date(photo.upload_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Photo</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Photo preview */}
            <div className="mb-4">
              <div className="aspect-square w-24 h-24 mx-auto rounded-lg overflow-hidden bg-gray-100 mb-3">
                <img
                  src={photo.aligned_url || photo.original_url}
                  alt={`Photo from ${photo.upload_date}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-center text-sm text-gray-600">{photoDate}</p>
            </div>

            {/* Warning message */}
            <div className="mb-6">
              <p className="text-gray-700 text-center">
                Are you sure you want to delete this photo? This action cannot be undone.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}