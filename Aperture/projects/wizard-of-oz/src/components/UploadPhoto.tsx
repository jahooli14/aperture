import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, MessageSquare } from 'lucide-react';
import { usePhotoStore, type EyeCoordinates } from '../stores/usePhotoStore';
import { EyeDetector } from './EyeDetector';
import { DateSelector } from './DateSelector';
import { UploadButtons } from './UploadButtons';
import { PreviewControls } from './PreviewControls';
import { rotateImage, fileToDataURL, validateImageFile, alignPhoto, compressImage } from '../lib/imageUtils';
import { triggerHaptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import type { ToastType } from './Toast';

interface UploadPhotoProps {
  showToast?: (message: string, type?: ToastType) => void;
}

export function UploadPhoto({ showToast }: UploadPhotoProps = {}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState('');
  const [customDate, setCustomDate] = useState<string>('');
  const [showBackdateUI, setShowBackdateUI] = useState(false); // Toggle for showing backdate selector
  const [eyeCoords, setEyeCoords] = useState<EyeCoordinates | null>(null);
  const [detectingEyes, setDetectingEyes] = useState(false);
  const [aligning, setAligning] = useState(false);
  const [alignedFile, setAlignedFile] = useState<File | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const hasAlignedRef = useRef(false); // Track if we've already aligned this file
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { uploadPhoto, uploading, hasUploadedToday, hasUploadedForDate } = usePhotoStore();

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Calculate minimum date (5 years ago)
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const minDate = fiveYearsAgo.toISOString().split('T')[0];

  const displayDate = customDate || today;

  const handleRotate = async (direction: 'left' | 'right') => {
    if (!originalFile) return;

    const newRotation = direction === 'right'
      ? (rotation + 90) % 360
      : (rotation - 90 + 360) % 360;

    try {
      const rotatedFile = await rotateImage(originalFile, newRotation);
      setSelectedFile(rotatedFile);
      setRotation(newRotation);
      setEyeCoords(null); // Clear old eye coordinates
      setAlignedFile(null); // Clear old alignment
      hasAlignedRef.current = false; // Reset alignment flag
      setDetectingEyes(true); // Re-run detection on rotated image

      // Safety timeout: If detection doesn't complete in 15 seconds, allow upload anyway
      setTimeout(() => {
        setDetectingEyes(false);
      }, 15000);

      // Update preview
      const dataURL = await fileToDataURL(rotatedFile);
      setPreview(dataURL);
    } catch (err) {
      logger.error('Error rotating image', { error: err instanceof Error ? err.message : String(err) }, 'UploadPhoto');
      setError('Failed to rotate image');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      setError(validation.error!);
      return;
    }

    try {
      // Compress image before processing (reduces upload time and storage costs)
      const compressedFile = await compressImage(file, 1920, 0.85);

      // Store both original and current file in state
      setOriginalFile(compressedFile);
      setSelectedFile(compressedFile);
      setRotation(0); // Reset rotation for new file
      setEyeCoords(null); // Reset eye coordinates
      setAlignedFile(null); // Reset alignment
      hasAlignedRef.current = false; // Reset alignment flag
      setDetectingEyes(true); // Start detection

      // Safety timeout: If detection doesn't complete in 15 seconds, allow upload anyway
      setTimeout(() => {
        setDetectingEyes(false);
      }, 15000);

      // Show preview
      const dataURL = await fileToDataURL(compressedFile);
      setPreview(dataURL);
      setError('');
    } catch (err) {
      logger.error('Error processing image', { error: err instanceof Error ? err.message : String(err) }, 'UploadPhoto');
      setError('Failed to process image');
    }
  };

  const handleEyeDetection = async (coords: EyeCoordinates | null) => {
    setEyeCoords(coords);
    setDetectingEyes(false);

    if (!coords) {
      // No error message - just silently proceed without alignment
      // The photo will upload as-is, which is perfectly fine
      setAlignedFile(null);
      hasAlignedRef.current = false;
      return;
    }

    // Automatically align photo after eye detection (only if not already done)
    if (selectedFile && !hasAlignedRef.current) {
      hasAlignedRef.current = true; // Mark as processing
      try {
        setAligning(true);
        setError('');
        const result = await alignPhoto(selectedFile, coords);
        setAlignedFile(result.alignedImage);
        setAligning(false);
      } catch (err) {
        logger.error('Alignment error', { error: err instanceof Error ? err.message : String(err) }, 'UploadPhoto');
        setAligning(false);
        setError('Failed to align photo. You can still upload the original.');
        setAlignedFile(null);
        hasAlignedRef.current = false; // Reset on error
      }
    }
  };

  const handleDetectionError = (err: Error) => {
    logger.error('Eye detection error', { error: err.message }, 'UploadPhoto');
    setDetectingEyes(false);
    // Silently handle detection errors - photo will just upload without alignment
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('No file selected');
      return;
    }

    try {
      setError('');
      // Upload aligned photo if available, otherwise upload original
      const fileToUpload = alignedFile || selectedFile;
      await uploadPhoto(fileToUpload, eyeCoords, displayDate, note || undefined);

      // Success feedback
      triggerHaptic('success');
      setShowSuccess(true);

      const formattedDate = new Date(displayDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      if (showToast) {
        showToast(`Photo added for ${formattedDate}`, 'success');
      }

      // Hide success animation after 1.5 seconds
      setTimeout(() => setShowSuccess(false), 1500);

      // Clear component state after brief delay for animation
      setTimeout(() => {
        setPreview(null);
        setSelectedFile(null);
        setOriginalFile(null);
        setRotation(0);
        setEyeCoords(null);
        setDetectingEyes(false);
        setAligning(false);
        setAlignedFile(null);
        hasAlignedRef.current = false;
        setCustomDate('');
        setNote('');
        setShowNoteInput(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
      }, 500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload photo';
      logger.error('Upload error', { error: errorMessage }, 'UploadPhoto');
      setError(errorMessage);
    }
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleGallerySelect = () => {
    fileInputRef.current?.click();
  };

  // Show success message with option to upload for previous dates
  if (hasUploadedToday() && !customDate) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-green-600 text-lg font-medium mb-2">✓ Today's photo uploaded!</div>
          <p className="text-green-700 text-sm">Come back tomorrow to capture another moment</p>
        </div>

        {!showBackdateUI ? (
          <motion.button
            type="button"
            onClick={() => setShowBackdateUI(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            📅 Upload for a Previous Date
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-gray-200 mt-4 pt-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Upload for a Previous Date</h3>
              <button
                type="button"
                onClick={() => setShowBackdateUI(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Select a date below to upload a photo for a day you missed:
            </p>

            <DateSelector
              customDate={customDate}
              today={today}
              minDate={minDate}
              onDateChange={setCustomDate}
            />
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {customDate ? 'Upload Photo' : "Today's Photo"}
      </h2>

      {/* Date Selection */}
      <DateSelector
        customDate={customDate}
        today={today}
        minDate={minDate}
        onDateChange={setCustomDate}
      />

      {!preview ? (
        <div>
          {/* Check if a photo already exists for the selected date */}
          {hasUploadedForDate(displayDate) ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <div className="text-amber-800 font-medium mb-2">
                📸 Photo already uploaded for this date
              </div>
              <p className="text-amber-700 text-sm">
                {displayDate === today
                  ? "You've already uploaded a photo for today."
                  : `A photo already exists for ${new Date(displayDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
                }
              </p>
              <p className="text-amber-600 text-xs mt-2">
                Delete the existing photo from the gallery if you want to replace it.
              </p>
            </div>
          ) : (
            <>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <UploadButtons
                onCameraClick={handleCameraCapture}
                onGalleryClick={handleGallerySelect}
              />
            </>
          )}
        </div>
      ) : (
        <div>
          {/* Run eye detection on selected file */}
          {selectedFile && (
            <EyeDetector
              imageFile={selectedFile}
              onDetection={handleEyeDetection}
              onError={handleDetectionError}
            />
          )}

          <PreviewControls
            preview={preview}
            detectingEyes={detectingEyes}
            aligning={aligning}
            uploading={uploading}
            hasEyeCoords={!!eyeCoords}
            onRotateLeft={() => handleRotate('left')}
            onRotateRight={() => handleRotate('right')}
            onUpload={handleUpload}
          />

          {/* Memory Note Input */}
          <div className="mt-4 mb-2">
            <button
              type="button"
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{showNoteInput ? 'Hide' : 'Add a'} memory note (optional)</span>
            </button>

            <AnimatePresence>
              {showNoteInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What happened today? Any special moments or milestones..."
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {note.length}/500 characters
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4">
            <motion.button
              type="button"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
                setOriginalFile(null);
                setRotation(0);
                setEyeCoords(null);
                setDetectingEyes(false);
                setAligning(false);
                setAlignedFile(null);
                hasAlignedRef.current = false;
                setNote('');
                setShowNoteInput(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                if (cameraInputRef.current) {
                  cameraInputRef.current.value = '';
                }
              }}
              whileHover={{ scale: uploading ? 1 : 1.02 }}
              whileTap={{ scale: uploading ? 1 : 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className="w-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors min-h-[48px] touch-manipulation disabled:opacity-50"
              disabled={uploading}
            >
              Cancel
            </motion.button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
          <pre className="whitespace-pre-wrap font-mono">{error}</pre>
        </div>
      )}

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-4"
              >
                <CheckCircle className="w-12 h-12 text-white" />
              </motion.div>
              <p className="text-lg font-semibold text-gray-900">Photo Added!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
