import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RotateCcw, RotateCw } from 'lucide-react';
import { usePhotoStore, type EyeCoordinates } from '../stores/usePhotoStore';
import { EyeDetector } from './EyeDetector';
import { rotateImage, fileToDataURL, validateImageFile } from '../lib/imageUtils';

export function UploadPhoto() {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState('');
  const [customDate, setCustomDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [eyeCoords, setEyeCoords] = useState<EyeCoordinates | null>(null);
  const [detectingEyes, setDetectingEyes] = useState(false);
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

    // Store both original and current file in state
    setOriginalFile(file);
    setSelectedFile(file);
    setRotation(0); // Reset rotation for new file
    setEyeCoords(null); // Reset eye coordinates
    setDetectingEyes(true); // Start detection

    // Safety timeout: If detection doesn't complete in 15 seconds, allow upload anyway
    setTimeout(() => {
      setDetectingEyes(false);
    }, 15000);

    // Show preview
    try {
      const dataURL = await fileToDataURL(file);
      setPreview(dataURL);
      setError('');
    } catch (err) {
      console.error('Error loading image preview:', err);
      setError('Failed to load image preview');
    }
  };

  const handleEyeDetection = (coords: EyeCoordinates | null) => {
    setEyeCoords(coords);
    setDetectingEyes(false);
    if (!coords) {
      setError('Could not detect eyes in photo. You can still upload, but alignment may not work.');
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
      await uploadPhoto(selectedFile, eyeCoords, displayDate);

      // Clear component state
      setPreview(null);
      setSelectedFile(null);
      setOriginalFile(null);
      setRotation(0);
      setEyeCoords(null);
      setDetectingEyes(false);
      setCustomDate('');
      setShowDatePicker(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
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

      {/* Date Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Date: {new Date(displayDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
            {customDate && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                Custom
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {customDate && (
              <button
                type="button"
                onClick={() => {
                  setCustomDate('');
                  setShowDatePicker(false);
                }}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                title="Reset to today"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {showDatePicker ? 'Done' : 'Change'}
            </button>
          </div>
        </div>

        {showDatePicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-white border border-gray-200 rounded-lg"
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select date for this photo:
            </label>
            <input
              type="date"
              value={customDate || today}
              onChange={(e) => setCustomDate(e.target.value)}
              min={minDate}
              max={today}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can backdate photos up to 5 years, but future dates are not allowed.
            </p>
          </motion.div>
        )}
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

          <button
            type="button"
            onClick={handleCameraCapture}
            className="w-full bg-primary-600 active:bg-primary-700 md:hover:bg-primary-700 text-white font-medium py-4 px-6 rounded-lg transition-colors mb-3 min-h-[48px] touch-manipulation"
          >
            📸 Take Photo
          </button>

          <button
            type="button"
            onClick={handleGallerySelect}
            className="w-full bg-gray-100 active:bg-gray-200 md:hover:bg-gray-200 text-gray-700 font-medium py-4 px-6 rounded-lg transition-colors min-h-[48px] touch-manipulation"
          >
            📁 Choose from Gallery
          </button>
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
              <button
                type="button"
                onClick={() => handleRotate('left')}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
                title="Rotate left"
                disabled={uploading}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleRotate('right')}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
                title="Rotate right"
                disabled={uploading}
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Rotation indicator */}
            {rotation !== 0 && (
              <div className="absolute bottom-2 left-2">
                <span className="text-xs bg-black/60 text-white px-2 py-1 rounded-full backdrop-blur-sm">
                  Rotated {rotation}°
                </span>
              </div>
            )}
          </div>

          {/* Detection status indicator */}
          {detectingEyes && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm text-center">
              🔍 Detecting eyes...
            </div>
          )}

          {eyeCoords && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
              ✓ Eyes detected successfully
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
                setOriginalFile(null);
                setRotation(0);
                setEyeCoords(null);
                setDetectingEyes(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                if (cameraInputRef.current) {
                  cameraInputRef.current.value = '';
                }
              }}
              className="flex-1 bg-gray-100 active:bg-gray-200 md:hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors min-h-[48px] touch-manipulation"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || detectingEyes}
              className="flex-1 bg-primary-600 active:bg-primary-700 md:hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] touch-manipulation"
            >
              {uploading ? 'Uploading...' : detectingEyes ? 'Detecting...' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
          <pre className="whitespace-pre-wrap font-mono">{error}</pre>
        </div>
      )}
    </motion.div>
  );
}
