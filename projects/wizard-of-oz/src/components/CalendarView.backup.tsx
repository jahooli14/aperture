import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Sparkles, MapPin } from 'lucide-react';
import { usePhotoStore } from '../stores/usePhotoStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { usePlaceStore } from '../stores/usePlaceStore';
import { getPhotoDisplayUrl } from '../lib/photoUtils';
import { milestones } from '../data/milestones';

interface CalendarViewProps {
  onUploadClick?: () => void;
}

export function CalendarView({ onUploadClick }: CalendarViewProps = {}) {
  const { photos } = usePhotoStore();
  const { achievements } = useMilestoneStore();
  const { photoPlaces, places, fetchPhotoPlaces, fetchPlaces } = usePlaceStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch places and photo_places on mount
  useEffect(() => {
    fetchPhotoPlaces();
    fetchPlaces();
  }, [fetchPhotoPlaces, fetchPlaces]);

  // Get milestones by date
  const milestonesByDate = useMemo(() => {
    const map = new Map<string, typeof achievements>();
    achievements.forEach(achievement => {
      const date = achievement.achieved_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(achievement);
    });
    return map;
  }, [achievements]);

  // Get photo map by date
  const photosByDate = useMemo(() => {
    const map = new Map<string, typeof photos[0]>();
    photos.forEach(photo => {
      map.set(photo.upload_date, photo);
    });
    return map;
  }, [photos]);

  // Get places by date (based on photo_places)
  const placesByDate = useMemo(() => {
    const map = new Map<string, typeof places>();
    photoPlaces.forEach(photoPlace => {
      const photo = photos.find(p => p.id === photoPlace.photo_id);
      if (photo) {
        const date = photo.upload_date;
        const place = places.find(p => p.id === photoPlace.place_id);
        if (place) {
          if (!map.has(date)) {
            map.set(date, []);
          }
          map.get(date)!.push(place);
        }
      }
    });
    return map;
  }, [photoPlaces, photos, places]);

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: Array<{ date: number; dateString: string; hasPhoto: boolean } | null> = [];

    // Add empty slots for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      // Create date string directly to avoid timezone issues
      // Database stores YYYY-MM-DD format, so we should match that exactly
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: day,
        dateString,
        hasPhoto: photosByDate.has(dateString),
      });
    }

    return days;
  }, [currentDate, photosByDate]);

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const handleDateClick = (dateString: string) => {
    if (photosByDate.has(dateString)) {
      setSelectedDate(selectedDate === dateString ? null : dateString);
    }
  };

  const selectedPhoto = selectedDate ? photosByDate.get(selectedDate) : null;
  const today = new Date().toISOString().split('T')[0];
  const hasTodayPhoto = photosByDate.has(today);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Calendar View</h2>
        <button
          type="button"
          onClick={goToToday}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Today
        </button>
      </div>

      {/* Upload Today's Photo Banner - show if no photo for today */}
      {!hasTodayPhoto && onUploadClick && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-200 rounded-lg p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-primary-900 mb-1">
                📸 Today's Photo
              </h3>
              <p className="text-sm text-primary-700">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={onUploadClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-lg font-medium shadow-md transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Upload Photo</span>
              <span className="sm:hidden">Upload</span>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="text-lg font-semibold text-gray-900">{monthName}</h3>

        <button
          type="button"
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="mb-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarData.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const isToday = day.dateString === today;
            const isSelected = day.dateString === selectedDate;
            const hasPhoto = day.hasPhoto;
            const hasMilestone = milestonesByDate.has(day.dateString);
            const hasPlace = placesByDate.has(day.dateString);

            return (
              <motion.button
                key={day.dateString}
                type="button"
                onClick={() => handleDateClick(day.dateString)}
                disabled={!hasPhoto}
                whileHover={hasPhoto ? { scale: 1.05 } : {}}
                whileTap={hasPhoto ? { scale: 0.95 } : {}}
                className={`
                  aspect-square p-2 rounded-lg text-sm font-medium transition-colors relative
                  ${isToday ? 'ring-2 ring-primary-600' : ''}
                  ${isSelected ? 'bg-primary-600 text-white' : ''}
                  ${hasPhoto && !isSelected ? 'bg-primary-50 text-primary-900 hover:bg-primary-100' : ''}
                  ${!hasPhoto ? 'text-gray-400 cursor-default' : 'cursor-pointer'}
                `}
              >
                {day.date}
                {hasPhoto && !isSelected && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary-600 rounded-full" />
                )}
                {hasMilestone && (
                  <div className="absolute top-0.5 right-0.5">
                    <Sparkles className="w-3 h-3 text-yellow-500" fill="currentColor" />
                  </div>
                )}
                {hasPlace && (
                  <div className="absolute top-0.5 left-0.5">
                    <MapPin className="w-3 h-3 text-blue-600" fill="currentColor" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Selected Photo Display */}
      {selectedPhoto && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-gray-200 pt-6"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={getPhotoDisplayUrl(selectedPhoto)}
                alt={`Photo from ${selectedPhoto.upload_date}`}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">
                  {new Date(selectedPhoto.upload_date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {selectedPhoto.eye_coordinates && (
                  <p className="flex items-center gap-1">
                    <span className="text-green-600">✓</span>
                    Eyes detected and aligned
                  </p>
                )}
                {!selectedPhoto.eye_coordinates && (
                  <p className="flex items-center gap-1">
                    <span className="text-blue-600">📷</span>
                    Original photo (no alignment)
                  </p>
                )}
                {milestonesByDate.has(selectedPhoto.upload_date) && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="flex items-center gap-1 font-medium text-yellow-800 mb-1">
                      <Sparkles className="w-4 h-4" fill="currentColor" />
                      Milestones Achieved
                    </p>
                    <ul className="text-xs text-yellow-700 space-y-0.5">
                      {milestonesByDate.get(selectedPhoto.upload_date)!.map(achievement => {
                        const milestone = milestones.find(m => m.id === achievement.milestone_id);
                        return (
                          <li key={achievement.id}>
                            {milestone?.icon} {milestone?.title || achievement.milestone_id}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {placesByDate.has(selectedPhoto.upload_date) && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="flex items-center gap-1 font-medium text-blue-800 mb-1">
                      <MapPin className="w-4 h-4" fill="currentColor" />
                      Places
                    </p>
                    <ul className="text-xs text-blue-700 space-y-0.5">
                      {placesByDate.get(selectedPhoto.upload_date)!.map(place => (
                        <li key={place.id}>
                          📍 {place.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {photosByDate.size} {photosByDate.size === 1 ? 'photo' : 'photos'} in total
          </span>
          <span className="text-gray-600">
            {calendarData.filter(d => d?.hasPhoto).length} this month
          </span>
        </div>
      </div>
    </motion.div>
  );
}
