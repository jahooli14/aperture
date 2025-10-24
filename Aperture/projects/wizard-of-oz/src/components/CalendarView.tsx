import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePhotoStore } from '../stores/usePhotoStore';
import { getPhotoDisplayUrl } from '../lib/photoUtils';

export function CalendarView() {
  const { photos } = usePhotoStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get photo map by date
  const photosByDate = useMemo(() => {
    const map = new Map<string, typeof photos[0]>();
    photos.forEach(photo => {
      map.set(photo.upload_date, photo);
    });
    return map;
  }, [photos]);

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

              <div className="space-y-1 text-sm text-gray-600">
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
