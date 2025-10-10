import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePhotoStore } from '../stores/usePhotoStore';

export function UploadPhoto() {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { uploadPhoto, uploading, hasUploadedToday } = usePhotoStore();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }

    // Store the file in state
    setSelectedFile(file);

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('No file selected');
      return;
    }

    try {
      setError('');
      await uploadPhoto(selectedFile);
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload photo';
      const errorDetails = JSON.stringify({
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        statusCode: err?.statusCode
      }, null, 2);
      console.error('Upload error:', err);
      setError(`${errorMessage}\n\nDetails:\n${errorDetails}`);
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
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Today's Photo</h2>

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
          <div className="mb-4 rounded-lg overflow-hidden">
            <img src={preview} alt="Preview" className="w-full h-auto" />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
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
              disabled={uploading}
              className="flex-1 bg-primary-600 active:bg-primary-700 md:hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] touch-manipulation"
            >
              {uploading ? 'Uploading...' : 'Upload'}
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
