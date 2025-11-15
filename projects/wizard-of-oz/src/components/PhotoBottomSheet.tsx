import { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Calendar, Image, Trash2, Eye, EyeOff, Baby, MessageSquare, Edit2, Check, MapPin } from 'lucide-react';
import type { Database } from '../types/database';
import { calculateAge, formatAge } from '../lib/ageUtils';
import { getPhotoDisplayUrl, isPhotoAligned } from '../lib/photoUtils';
import { useSettingsStore } from '../stores/useSettingsStore';
import { usePhotoStore } from '../stores/usePhotoStore';
import { usePlaceStore } from '../stores/usePlaceStore';
import { AddPlaceModal } from './AddPlaceModal';

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
  const { fetchPlaces, fetchPhotoPlaces } = usePlaceStore();

  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);

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
  const photoIsAligned = isPhotoAligned(photo);

  return (
    <>
      <AnimatePresence mode="wait">
        {isOpen && (
          <div key={photo.id}>
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
                    src={getPhotoDisplayUrl(photo)}
                    alt={`Photo from ${photo.upload_date}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-4 mb-6">
                {/* Day Icon - separate from note */}
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                      {existingEmoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-700">Day Icon</p>
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.value = existingEmoji;
                            input.className = 'w-20 h-14 text-center text-3xl border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white';
                            input.placeholder = '💬';
                            input.inputMode = 'text';

                            // Create a dialog-like overlay
                            const overlay = document.createElement('div');
                            overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
                            overlay.onclick = (e) => {
                              if (e.target === overlay) {
                                document.body.removeChild(overlay);
                              }
                            };

                            const container = document.createElement('div');
                            container.className = 'bg-white p-6 rounded-xl shadow-xl m-4 max-w-sm w-full';

                            const title = document.createElement('p');
                            title.className = 'text-sm font-medium text-gray-700 mb-3';
                            title.textContent = 'Type or paste an emoji:';

                            const buttonContainer = document.createElement('div');
                            buttonContainer.className = 'flex gap-2 mt-4';

                            const saveBtn = document.createElement('button');
                            saveBtn.textContent = 'Save';
                            saveBtn.className = 'flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium';
                            saveBtn.onclick = async () => {
                              const value = input.value;
                              // Extract first emoji using spread operator to handle multi-byte characters
                              const emojis = [...value];
                              const newEmoji = emojis[0] || '💬';

                              try {
                                await updatePhotoNote(photo.id, existingNote, newEmoji);
                                document.body.removeChild(overlay);
                              } catch (err) {
                                alert('Failed to save icon: ' + (err instanceof Error ? err.message : String(err)));
                              }
                            };

                            const cancelBtn = document.createElement('button');
                            cancelBtn.textContent = 'Cancel';
                            cancelBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium';
                            cancelBtn.onclick = () => {
                              document.body.removeChild(overlay);
                            };

                            buttonContainer.appendChild(cancelBtn);
                            buttonContainer.appendChild(saveBtn);

                            container.appendChild(title);
                            container.appendChild(input);
                            container.appendChild(buttonContainer);
                            overlay.appendChild(container);
                            document.body.appendChild(overlay);

                            setTimeout(() => input.focus(), 100);
                          }}
                          className="p-1.5 hover:bg-blue-200 rounded-lg transition-colors"
                          aria-label="Change icon"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">Tap the edit button to change this day's icon</p>
                    </div>
                  </div>
                </div>

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
                        photoIsAligned ? 'Eyes detected & aligned' : 'Eyes detected'
                      ) : (
                        'No eyes detected'
                      )}
                    </p>
                    {/* Show zoom level if available */}
                    {(() => {
                      if (!photo.metadata || typeof photo.metadata !== 'object') return null;
                      const metadata = photo.metadata as Record<string, unknown>;
                      const zoomLevel = ('zoom_level' in metadata && typeof metadata.zoom_level === 'number')
                        ? metadata.zoom_level
                        : null;

                      if (!zoomLevel) return null;

                      return (
                        <p className="text-xs text-gray-500 mt-1">
                          Crop level: {(zoomLevel * 100).toFixed(0)}%
                          {zoomLevel >= 0.35 && ' (Tight: face focus)'}
                          {zoomLevel < 0.35 && zoomLevel >= 0.28 && ' (Medium: shows torso)'}
                          {zoomLevel < 0.28 && zoomLevel >= 0.22 && ' (Wide: upper body)'}
                          {zoomLevel < 0.22 && ' (Very wide: full context)'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => setIsAddPlaceModalOpen(true)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-50 hover:bg-blue-100 active:bg-blue-100 text-blue-600 font-semibold rounded-xl transition-colors min-h-[56px]"
                >
                  <MapPin className="w-5 h-5" />
                  <span>Tag Location</span>
                </button>

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
          </div>
        )}
      </AnimatePresence>

      <AddPlaceModal
        photo={photo}
        isOpen={isAddPlaceModalOpen}
        onClose={() => setIsAddPlaceModalOpen(false)}
        onSuccess={() => {
          // Refresh places and photo_places
          fetchPlaces();
          fetchPhotoPlaces();
        }}
      />
    </>
  );
}
