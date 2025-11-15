import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Sparkles, MapPin, Calendar, Clock } from 'lucide-react';
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
  const { achievements, fetchAchievements } = useMilestoneStore();
  const { photoPlaces, places, placeVisits, fetchPhotoPlaces, fetchPlaces, fetchPlaceVisits } = usePlaceStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');

  // Fetch places, achievements, and visits on mount
  useEffect(() => {
    fetchPhotoPlaces();
    fetchPlaces();
    fetchAchievements();
    fetchPlaceVisits();
  }, [fetchPhotoPlaces, fetchPlaces, fetchAchievements, fetchPlaceVisits]);

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

  // Get visits by date
  const visitsByDate = useMemo(() => {
    const map = new Map<string, typeof placeVisits>();
    placeVisits.forEach(visit => {
      const date = visit.visit_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(visit);
    });
    return map;
  }, [placeVisits]);

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
        <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'timeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              Timeline
            </button>
          </div>

          <button
            type="button"
            onClick={goToToday}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
          >
            Today
          </button>
        </div>
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

      {viewMode === 'calendar' ? (
        <>
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
        </>
      ) : (
        // Timeline view
        <TimelineView
          photosByDate={photosByDate}
          milestonesByDate={milestonesByDate}
          placesByDate={placesByDate}
          visitsByDate={visitsByDate}
          places={places}
          onUploadClick={onUploadClick}
        />
      )}
    </motion.div>
  );
}

// Timeline view component
function TimelineView({
  photosByDate,
  milestonesByDate,
  placesByDate,
  visitsByDate,
  places,
  onUploadClick,
}: {
  photosByDate: Map<string, any>;
  milestonesByDate: Map<string, any>;
  placesByDate: Map<string, any>;
  visitsByDate: Map<string, any>;
  places: any[];
  onUploadClick?: () => void;
}) {
  // Get all unique dates in reverse chronological order
  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    photosByDate.forEach((_, date) => dateSet.add(date));
    milestonesByDate.forEach((_, date) => dateSet.add(date));
    placesByDate.forEach((_, date) => dateSet.add(date));
    visitsByDate.forEach((_, date) => dateSet.add(date));
    return Array.from(dateSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [photosByDate, milestonesByDate, placesByDate, visitsByDate]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      pub: '🍺',
      restaurant: '🍽️',
      cafe: '☕',
      park: '🌳',
      beach: '🏖️',
      relative_house: '👨‍👩‍👧',
      nursery: '👶',
      playgroup: '🎨',
      soft_play: '🎪',
      attraction: '🎡',
      landmark: '🏛️',
      other: '📍',
    };
    return icons[category] || '📍';
  };

  return (
    <div className="relative">
      {allDates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No photos, visits, or milestones yet</p>
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              Upload your first photo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Timeline vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-300 via-primary-500 to-primary-300" />

          {allDates.map((date, index) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative pl-20"
            >
              {/* Timeline dot with pulse effect */}
              <div className="absolute -left-2 top-6 flex items-center justify-center">
                <div className="absolute w-5 h-5 bg-primary-400 rounded-full animate-pulse" />
                <div className="relative w-5 h-5 bg-primary-600 rounded-full border-4 border-white shadow-lg" />
              </div>

              {/* Date heading */}
              <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
                {formatDate(date)}
              </h3>

              {/* Items for this date - grouped in card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {/* Photos */}
                  {photosByDate.has(date) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📷</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">Photo</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {photosByDate.get(date)?.eye_coordinates ? '✓ Face aligned' : 'Original photo'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Visits */}
                  {visitsByDate.has(date) &&
                    visitsByDate.get(date).map((visit: any, visitIndex: number) => {
                      const place = places.find((p) => p.id === visit.place_id);
                      return (
                        <motion.div
                          key={visit.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: visitIndex * 0.05 }}
                          className="px-4 py-3 hover:bg-yellow-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{place ? getCategoryIcon(place.category) : '📍'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {place?.name || 'Unknown place'}
                              </p>
                              {visit.notes && (
                                <p className="text-xs text-gray-600 mt-1 italic">"{visit.notes}"</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                  {/* Places from photos */}
                  {placesByDate.has(date) &&
                    !visitsByDate.has(date) &&
                    placesByDate.get(date).map((place: any, placeIndex: number) => (
                      <motion.div
                        key={place.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: placeIndex * 0.05 }}
                        className="px-4 py-3 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{getCategoryIcon(place.category)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{place.name}</p>
                            <p className="text-xs text-gray-600">Photographed</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                  {/* Milestones */}
                  {milestonesByDate.has(date) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-4 py-3 hover:bg-yellow-50 transition-colors"
                    >
                      <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="text-lg">🎉</span> Milestones
                      </p>
                      <ul className="text-xs text-gray-700 space-y-1 pl-6">
                        {milestonesByDate.get(date)!.map((achievement: any) => {
                          const milestone = milestones.find((m) => m.id === achievement.milestone_id);
                          return (
                            <li key={achievement.id} className="flex items-center gap-2">
                              <span>{milestone?.icon}</span>
                              <span>{milestone?.title || achievement.milestone_id}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
