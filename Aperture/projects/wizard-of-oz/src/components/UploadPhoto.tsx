import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, RotateCcw, RotateCw, CheckCircle, Loader2, Camera, FolderOpen } from 'lucide-react';
import { usePhotoStore, type EyeCoordinates } from '../stores/usePhotoStore';
import { EyeDetector } from './EyeDetector';
import { rotateImage, fileToDataURL, validateImageFile, alignPhoto, compressImage } from '../lib/imageUtils';
import { triggerHaptic } from '../lib/haptics';
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
  const [eyeCoords, setEyeCoords] = useState<EyeCoordinates | null>(null);
  const [detectingEyes, setDetectingEyes] = useState(false);
  const [aligning, setAligning] = useState(false);
  const [alignedFile, setAlignedFile] = useState<File | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const hasAlignedRef = useRef(false); // Track if we've already aligned this file
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { uploadPhoto, uploading, hasUploadedToday } = usePhotoStore();

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
      console.error('Error rotating image:', err);
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
      console.error('Error processing image:', err);
      setError('Failed to process image');
    }
  };

  const handleEyeDetection = async (coords: EyeCoordinates | null) => {
    setEyeCoords(coords);
    setDetectingEyes(false);

    if (!coords) {
      setError('Could not detect eyes in photo. You can still upload without alignment.');
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
        console.error('Alignment error:', err);
        setAligning(false);
        setError('Failed to align photo. You can still upload the original.');
        setAlignedFile(null);
        hasAlignedRef.current = false; // Reset on error
      }
    }
  };

  const handleDetectionError = (err: Error) => {
    console.error('Eye detection error:', err);
    setDetectingEyes(false);
    setError(`Eye detection failed: ${err.message}. You can still upload, but alignment may not work.`);
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
      await uploadPhoto(fileToUpload, eyeCoords, displayDate);

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
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
      }, 500);
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload photo';
      setError(errorMessage);
    }
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleGallerySelect = () => {
    fileInputRef.current?.click();
  };

  if (hasUploadedToday()) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-green-50 border border-green-200 rounded-lg p-6 text-center"
      >
        <div className="text-green-600 text-lg font-medium mb-2">✓ Today's photo uploaded!</div>
        <p className="text-green-700 text-sm">Come back tomorrow to capture another moment</p>
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

      {/* Date Selection - Always visible */}
      <div className="mb-6">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <label className="text-sm font-semibold text-gray-900">
              Photo Date
            </label>
            {customDate && (
              <button
                type="button"
                onClick={() => setCustomDate('')}
                className="ml-auto p-1 text-gray-500 hover:text-gray-700 transition-colors"
                title="Reset to today"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          <input
            type="date"
            value={customDate || today}
            onChange={(e) => setCustomDate(e.target.value)}
            min={minDate}
            max={today}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
          />

          <div className="mt-2 flex items-start space-x-1.5">
            <p className="text-xs text-gray-600">
              {customDate
                ? `📆 Backdating to ${new Date(customDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
                : '📸 Uploading for today'
              }
            </p>
          </div>
        </div>
      </div>

      {!preview ? (
        <div>
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

          <motion.button
            type="button"
            onClick={handleCameraCapture}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-medium py-4 px-6 rounded-lg transition-colors mb-3 min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            <span>Take Photo</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={handleGallerySelect}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="w-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-medium py-4 px-6 rounded-lg transition-colors min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
          >
            <FolderOpen className="w-5 h-5" />
            <span>Choose from Gallery</span>
          </motion.button>
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

          <div className="mb-4 rounded-lg overflow-hidden relative">
            <img src={preview} alt="Preview" className="w-full h-auto" />

            {/* Rotation controls overlay */}
            <div className="absolute top-2 right-2 flex gap-2">
              <motion.button
                type="button"
                onClick={() => handleRotate('left')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9, rotate: -15 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
                title="Rotate left"
                disabled={uploading}
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => handleRotate('right')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9, rotate: 15 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
                title="Rotate right"
                disabled={uploading}
              >
                <RotateCw className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Rotation indicator - more prominent */}
            <AnimatePresence>
              {rotation !== 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <div className="bg-black/80 text-white px-4 py-2 rounded-lg backdrop-blur-md shadow-lg border border-white/20">
                    <p className="text-sm font-medium">Rotated {rotation}°</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Detection and alignment status indicators */}
          {detectingEyes && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm text-center flex items-center justify-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Detecting eyes...</span>
            </motion.div>
          )}

          {aligning && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm text-center flex items-center justify-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Aligning photo...</span>
            </motion.div>
          )}

          {eyeCoords && !aligning && alignedFile && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
              ✓ Eyes detected and photo aligned!
            </div>
          )}

          {eyeCoords && !aligning && !alignedFile && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm text-center">
              ⚠️ Eyes detected but alignment failed. Original will be uploaded.
            </div>
          )}

          <div className="flex gap-3">
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
              className="flex-1 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors min-h-[48px] touch-manipulation disabled:opacity-50"
              disabled={uploading}
            >
              Cancel
            </motion.button>
            <motion.button
              type="button"
              onClick={handleUpload}
              disabled={uploading || detectingEyes || aligning}
              whileHover={{ scale: (uploading || detectingEyes || aligning) ? 1 : 1.02 }}
              whileTap={{ scale: (uploading || detectingEyes || aligning) ? 1 : 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className="flex-1 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
            >
              {(uploading || detectingEyes || aligning) && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>
                {uploading ? 'Uploading...' : detectingEyes ? 'Detecting...' : aligning ? 'Aligning...' : 'Upload'}
              </span>
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
