import { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Calendar, Image, Trash2, Eye, EyeOff, Baby, MessageSquare, Edit2, Check, MapPin, Target } from 'lucide-react';
import type { Database } from '../types/database';
import { calculateAge, formatAge } from '../lib/ageUtils';
import { calculateZoomLevel } from '../lib/imageUtils';
import { getPhotoDisplayUrl, isPhotoAligned } from '../lib/photoUtils';
import { useSettingsStore } from '../stores/useSettingsStore';
import { usePhotoStore } from '../stores/usePhotoStore';
import { usePlaceStore } from '../stores/usePlaceStore';
import { AddPlaceModal } from './AddPlaceModal';
import { EyeAdjust, type EyeAdjustCoords } from './EyeAdjust';

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoBottomSheetProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function PhotoBottomSheet({ photo: photoProp, isOpen, onClose, onDelete }: PhotoBottomSheetProps) {
  if (!photoProp) return null;

  const { settings } = useSettingsStore();
  const { updatePhotoNote, reAlignPhoto, photos } = usePhotoStore();
  const { fetchPlaces, fetchPhotoPlaces } = usePlaceStore();

  // Always read the freshest photo from the store by id. Parent components
  // (e.g. PhotoGallery) pass `photo` as a captured reference, which stays
  // stale after mutations like reAlignPhoto() replace the stored row. Reading
  // from the store ensures the sheet re-renders with new URLs / coords.
  const photo = photos.find((p) => p.id === photoProp.id) ?? photoProp;

  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [adjustState, setAdjustState] = useState<
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'editing'; previewUrl: string; width: number; height: number; initial: EyeAdjustCoords | null }
    | { phase: 'saving' }
  >({ phase: 'idle' });
  const [adjustError, setAdjustError] = useState('');

  const openAdjust = async () => {
    try {
      setAdjustError('');
      setAdjustState({ phase: 'loading' });
      const sourceUrl = getPhotoDisplayUrl(photo);
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error(`Couldn't load photo (${response.status})`);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();

      // Seed markers with existing eye coords if we have them AND they're in
      // the same image-space as what we're about to edit. Otherwise let
      // EyeAdjust default to 1/3-2/3 horizontally, mid-vertically.
      let initial: EyeAdjustCoords | null = null;
      const ec = photo.eye_coordinates;
      if (ec && ec.imageWidth && ec.imageHeight) {
        // Scale coords if the fetched image dims differ (signed URL may serve
        // the same pixels, but be robust to any resizing).
        const sx = width / ec.imageWidth;
        const sy = height / ec.imageHeight;
        initial = {
          leftEye: { x: ec.leftEye.x * sx, y: ec.leftEye.y * sy },
          rightEye: { x: ec.rightEye.x * sx, y: ec.rightEye.y * sy },
        };
      }

      // Use an object URL of the fetched blob so the EyeAdjust <img> can load
      // without any CORS/redirect surprises.
      const objectUrl = URL.createObjectURL(blob);
      setAdjustState({ phase: 'editing', previewUrl: objectUrl, width, height, initial });
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed to open adjust');
      setAdjustState({ phase: 'idle' });
    }
  };

  const closeAdjust = () => {
    if (adjustState.phase === 'editing') {
      URL.revokeObjectURL(adjustState.previewUrl);
    }
    setAdjustState({ phase: 'idle' });
    setAdjustError('');
  };

  const handleAdjustConfirm = async (placed: EyeAdjustCoords) => {
    if (adjustState.phase !== 'editing') return;
    const { previewUrl: previewUrlToRevoke, width, height, initial } = adjustState;

    // No-op detection: if the user confirmed without moving the image, the
    // inverse transform will reproduce the exact starting coords (or within
    // floating-point drift). Running alignPhoto on identical coords just
    // re-uploads a byte-identical image and makes it look like "nothing
    // changed" from the user's POV. Bail early with a helpful message.
    if (initial) {
      const dLeftX = placed.leftEye.x - initial.leftEye.x;
      const dLeftY = placed.leftEye.y - initial.leftEye.y;
      const dRightX = placed.rightEye.x - initial.rightEye.x;
      const dRightY = placed.rightEye.y - initial.rightEye.y;
      const maxDelta = Math.max(
        Math.abs(dLeftX), Math.abs(dLeftY),
        Math.abs(dRightX), Math.abs(dRightY)
      );
      // ~0.25% of a 1080-wide frame. Below this, the crop would shift by
      // less than one output pixel and no visible change would occur.
      const EPS = Math.max(width, height) * 0.0025;
      console.log('[Re-align] confirm', {
        photoId: photo.id,
        initial,
        placed,
        maxDelta,
        eps: EPS,
      });
      if (maxDelta < EPS) {
        setAdjustError(
          "No change detected — drag, pinch or rotate the photo first, then tap Re-align."
        );
        return;
      }
    }

    try {
      setAdjustState({ phase: 'saving' });
      await reAlignPhoto(photo.id, placed, settings?.baby_birthdate ?? null);
      URL.revokeObjectURL(previewUrlToRevoke);
      setAdjustState({ phase: 'idle' });
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed to re-align');
      // Return to edit state so the user can retry without re-loading.
      setAdjustState({
        phase: 'editing',
        previewUrl: previewUrlToRevoke,
        width,
        height,
        initial: placed,
      });
    }
  };

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

  // Disable the drag-to-dismiss gesture whenever the eye-adjust UI is active.
  // Otherwise framer-motion hijacks vertical pointer drags on the markers and
  // can close the sheet mid-adjustment.
  const sheetDragEnabled = adjustState.phase === 'idle';

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
              // Backdrop click dismisses — but NOT while the adjust UI is
              // open, since a drag that ends on the backdrop (finger past the
              // image edge) would otherwise close mid-adjustment.
              onClick={sheetDragEnabled ? onClose : undefined}
            />

            {/* Bottom Sheet */}
            <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag={sheetDragEnabled ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ touchAction: 'none' }}
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
                  className="flex items-center justify-center -mr-2 -mt-1 min-w-[44px] min-h-[44px] rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
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

                            setTimeout(() => input.focus(), 0);
                          }}
                          className="flex items-center justify-center min-w-[44px] min-h-[44px] hover:bg-blue-200 active:bg-blue-300 rounded-lg transition-colors"
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
                            className="flex items-center justify-center min-w-[44px] min-h-[44px] hover:bg-amber-200 active:bg-amber-300 rounded-lg transition-colors"
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

              {/* Manual adjust UI — inline, replaces other actions while open */}
              {adjustState.phase === 'editing' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                  <EyeAdjust
                    previewUrl={adjustState.previewUrl}
                    imageWidth={adjustState.width}
                    imageHeight={adjustState.height}
                    initial={adjustState.initial}
                    zoomLevel={(() => {
                      // Mirror the zoom-level logic used by reAlignPhoto so
                      // the preview rectangle matches the committed crop.
                      if (settings?.baby_birthdate) {
                        const photoDate = new Date(photo.upload_date);
                        const birth = new Date(settings.baby_birthdate);
                        const ageInMonths = Math.floor(
                          (photoDate.getTime() - birth.getTime()) /
                            (1000 * 60 * 60 * 24 * 30.44)
                        );
                        return calculateZoomLevel(ageInMonths);
                      }
                      const prev = photo.metadata as Record<string, unknown> | null;
                      if (prev && typeof prev.zoom_level === 'number') {
                        return prev.zoom_level;
                      }
                      return 0.4;
                    })()}
                    onConfirm={handleAdjustConfirm}
                    onCancel={closeAdjust}
                    title="Fix eye alignment"
                    confirmLabel="Re-align photo"
                  />
                  {adjustError && (
                    <p className="mt-2 text-xs text-red-600">{adjustError}</p>
                  )}
                </div>
              )}

              {adjustState.phase === 'saving' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-700">
                  Re-aligning photo…
                </div>
              )}

              {/* Actions */}
              {adjustState.phase === 'idle' && (
                <div className="space-y-3">
                  <button
                    onClick={openAdjust}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-50 hover:bg-green-100 active:bg-green-100 text-green-700 font-semibold rounded-xl transition-colors min-h-[56px]"
                  >
                    <Target className="w-5 h-5" />
                    <span>{hasEyeDetection ? 'Adjust alignment' : 'Set eye positions'}</span>
                  </button>

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

                  {adjustError && (
                    <p className="text-xs text-red-600">{adjustError}</p>
                  )}
                </div>
              )}

              {adjustState.phase === 'loading' && (
                <div className="text-center py-4 text-sm text-gray-600">
                  Loading photo…
                </div>
              )}

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
