import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Calendar, Baby } from 'lucide-react';
import { usePhotoStore } from '../stores/usePhotoStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { ComparisonSlider } from './ComparisonSlider';
import { calculateAge, formatAge } from '../lib/ageUtils';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

export function ComparisonView() {
  const { photos } = usePhotoStore();
  const { settings } = useSettingsStore();
  const [selectedPhoto1, setSelectedPhoto1] = useState<Photo | null>(null);
  const [selectedPhoto2, setSelectedPhoto2] = useState<Photo | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleSwapPhotos = () => {
    const temp = selectedPhoto1;
    setSelectedPhoto1(selectedPhoto2);
    setSelectedPhoto2(temp);
  };

  const calculateDaysBetween = (photo1: Photo, photo2: Photo) => {
    const date1 = new Date(photo1.upload_date);
    const date2 = new Date(photo2.upload_date);
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const sortedPhotos = [...photos].sort((a, b) =>
    new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime()
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Compare Photos</h2>
        {selectedPhoto1 && selectedPhoto2 && (
          <button
            onClick={handleSwapPhotos}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="text-sm font-medium">Swap</span>
          </button>
        )}
      </div>

      {photos.length < 2 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📸</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Not enough photos yet
          </h3>
          <p className="text-gray-600">
            You need at least 2 photos to use the comparison feature.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Photo Selectors */}
          <div className="grid grid-cols-2 gap-4">
            {/* Photo 1 Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Photo 1 (Left)
              </label>
              <select
                value={selectedPhoto1?.id || ''}
                onChange={(e) => {
                  const photo = photos.find(p => p.id === e.target.value);
                  setSelectedPhoto1(photo || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a photo...</option>
                {sortedPhotos.map(photo => (
                  <option key={photo.id} value={photo.id}>
                    {new Date(photo.upload_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo 2 Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Photo 2 (Right)
              </label>
              <select
                value={selectedPhoto2?.id || ''}
                onChange={(e) => {
                  const photo = photos.find(p => p.id === e.target.value);
                  setSelectedPhoto2(photo || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a photo...</option>
                {sortedPhotos.map(photo => (
                  <option key={photo.id} value={photo.id}>
                    {new Date(photo.upload_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Display */}
          {selectedPhoto1 && selectedPhoto2 ? (
            <div className="space-y-4">
              <ComparisonSlider
                photo1={selectedPhoto1}
                photo2={selectedPhoto2}
                position={sliderPosition}
                onPositionChange={setSliderPosition}
              />

              {/* Metadata */}
              <div className="space-y-3">
                {/* Time Difference */}
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">Time Between Photos</p>
                    <p className="text-base text-gray-900">
                      {calculateDaysBetween(selectedPhoto1, selectedPhoto2)} days apart
                    </p>
                  </div>
                </div>

                {/* Age Comparison - only show if birthdate is set */}
                {settings?.baby_birthdate && (() => {
                  const age1 = calculateAge(settings.baby_birthdate, selectedPhoto1.upload_date);
                  const age2 = calculateAge(settings.baby_birthdate, selectedPhoto2.upload_date);

                  return (
                    <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
                      <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Baby className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-700">Ages in Photos</p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div>
                            <p className="text-xs text-gray-500">Photo 1 (Left)</p>
                            <p className="text-sm text-gray-900">{formatAge(age1)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Photo 2 (Right)</p>
                            <p className="text-sm text-gray-900">{formatAge(age2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Instructions */}
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500">
                    💡 Drag the slider or tap anywhere to compare
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
              <div className="text-4xl mb-3">👆</div>
              <p className="text-gray-600">
                Select two photos above to start comparing
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
