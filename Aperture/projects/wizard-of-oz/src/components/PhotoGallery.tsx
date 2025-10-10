import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePhotoStore } from '../stores/usePhotoStore';

export function PhotoGallery() {
  const { photos, loading, fetchPhotos } = usePhotoStore();

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Your Journey</h2>
        <p className="text-gray-600">{photos.length} {photos.length === 1 ? 'day' : 'days'}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-md hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <img
              src={photo.aligned_url || photo.original_url}
              alt={`Photo from ${photo.upload_date}`}
              className="w-full h-full object-cover"
            />

            {/* Overlay with date */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-sm font-medium">
                  {new Date(photo.upload_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                {photo.aligned_url && (
                  <p className="text-white/80 text-xs mt-1">✓ Aligned</p>
                )}
                {!photo.aligned_url && photo.original_url && (
                  <p className="text-yellow-300 text-xs mt-1">⏳ Processing...</p>
                )}
              </div>
            </div>

            {/* Eye position indicator (only for aligned photos) */}
            {photo.eye_coordinates && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Show eye positions as small dots when hovering */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    className="absolute w-2 h-2 bg-green-400 rounded-full border border-white"
                    style={{
                      left: `${(photo.eye_coordinates.leftEye.x / photo.eye_coordinates.imageWidth) * 100}%`,
                      top: `${(photo.eye_coordinates.leftEye.y / photo.eye_coordinates.imageHeight) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                  <div
                    className="absolute w-2 h-2 bg-green-400 rounded-full border border-white"
                    style={{
                      left: `${(photo.eye_coordinates.rightEye.x / photo.eye_coordinates.imageWidth) * 100}%`,
                      top: `${(photo.eye_coordinates.rightEye.y / photo.eye_coordinates.imageHeight) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
