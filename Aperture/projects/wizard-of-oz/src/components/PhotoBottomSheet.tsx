import { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Calendar, Image, Trash2, Eye, EyeOff, Baby, MessageSquare, Edit2, Check } from 'lucide-react';
import type { Database } from '../types/database';
import { calculateAge, formatAge } from '../lib/ageUtils';
import { useSettingsStore } from '../stores/useSettingsStore';
import { usePhotoStore } from '../stores/usePhotoStore';

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoBottomSheetProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function PhotoBottomSheet({ photo, isOpen, onClose, onDelete }: PhotoBottomSheetProps) {
  if (!photo) return null;

  const { settings } = useSettingsStore();
  const { updatePhotoNote } = usePhotoStore();

  // Get existing note and emoji from metadata
  const existingNote = (() => {
    if (!photo.metadata || typeof photo.metadata !== 'object') return '';
    const metadata = photo.metadata as Record<string, unknown>;
    return ('note' in metadata && metadata.note) ? String(metadata.note) : '';
  })();

  const existingEmoji = (() => {
    if (!photo.metadata || typeof photo.metadata !== 'object') return '💬';
    const metadata = photo.metadata as Record<string, unknown>;
    return ('emoji' in metadata && metadata.emoji) ? String(metadata.emoji) : '💬';
  })();

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(existingNote);
  const [selectedEmoji, setSelectedEmoji] = useState(existingEmoji);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  const handleSaveNote = async () => {
    try {
      setIsSavingNote(true);
      setNoteError('');
      await updatePhotoNote(photo.id, noteText, selectedEmoji);
      setIsEditingNote(false);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleCancelEdit = () => {
    setNoteText(existingNote);
    setSelectedEmoji(existingEmoji);
    setIsEditingNote(false);
    setNoteError('');
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close if dragged down more than 100px or velocity is high
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const photoDate = new Date(photo.upload_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const uploadedDate = new Date(photo.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const hasEyeDetection = !!photo.eye_coordinates;
  const isAligned = !!photo.aligned_url && photo.aligned_url !== photo.original_url;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto max-h-[calc(85vh-2rem)]">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Photo Details</h3>
                <button
                  onClick={onClose}
                  className="p-2 -mr-2 -mt-1 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Photo Preview */}
              <div className="mb-6">
                <div className="aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-gray-100 shadow-lg">
                  <img
                    src={photo.aligned_url || photo.original_url}
                    alt={`Photo from ${photo.upload_date}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-4 mb-6">
                {/* Memory Note - editable */}
                <div className="p-4 bg-amber-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-700">Memory Note</p>
                        {!isEditingNote && (
                          <button
                            onClick={() => setIsEditingNote(true)}
                            className="p-1.5 hover:bg-amber-200 rounded-lg transition-colors"
                            aria-label={existingNote ? 'Edit note' : 'Add note'}
                          >
                            <Edit2 className="w-4 h-4 text-amber-600" />
                          </button>
                        )}
                      </div>

                      {isEditingNote ? (
                        <div className="space-y-3">
                          {/* Emoji Picker */}
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">Icon:</label>
                            <input
                              type="text"
                              value={selectedEmoji}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow single emoji/character
                                const emoji = Array.from(value)[0] || '💬';
                                setSelectedEmoji(emoji);
                              }}
                              className="w-16 h-12 text-center text-2xl border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              placeholder="💬"
                              maxLength={2}
                            />
                            <p className="text-xs text-gray-500">Tap to type any emoji</p>
                          </div>

                          <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="What happened on this day? Any special moments or milestones..."
                            maxLength={500}
                            rows={4}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm bg-white"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                              {noteText.length}/500 characters
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSavingNote}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveNote}
                                disabled={isSavingNote}
                                className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                {isSavingNote ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                          {noteError && (
                            <p className="text-xs text-red-600">{noteError}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-base text-gray-900 whitespace-pre-wrap">
                          {existingNote || (
                            <span className="text-gray-500 italic">No note yet. Click the edit button to add one.</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Age Display - only show if birthdate is set */}
                {settings?.baby_birthdate && (() => {
                  const age = calculateAge(settings.baby_birthdate, photo.upload_date);

                  return (
                    <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
                      <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Baby className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700">Age in Photo</p>
                        <p className="text-base text-gray-900">{formatAge(age)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {age.totalDays} {age.totalDays === 1 ? 'day' : 'days'} old
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Photo Date */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700">Photo Date</p>
                    <p className="text-base text-gray-900">{photoDate}</p>
                  </div>
                </div>

                {/* Upload Date */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Image className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700">Uploaded</p>
                    <p className="text-base text-gray-900">{uploadedDate}</p>
                  </div>
                </div>

                {/* Alignment Status */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    hasEyeDetection ? 'bg-green-100' : 'bg-gray-200'
                  }`}>
                    {hasEyeDetection ? (
                      <Eye className="w-5 h-5 text-green-600" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700">Face Detection</p>
                    <p className="text-base text-gray-900">
                      {hasEyeDetection ? (
                        isAligned ? 'Eyes detected & aligned' : 'Eyes detected'
                      ) : (
                        'No eyes detected'
                      )}
                    </p>
                    {/* Confidence metric removed - not meaningful to end users */}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-50 hover:bg-red-100 active:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors min-h-[56px]"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Photo</span>
                </button>
              </div>

              {/* Bottom Safe Area */}
              <div className="h-8" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
