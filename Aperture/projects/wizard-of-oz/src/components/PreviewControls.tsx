import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw, RotateCcw, Loader2, CheckCircle } from 'lucide-react';

interface PreviewControlsProps {
  preview: string | null;
  detectingEyes: boolean;
  aligning: boolean;
  uploading: boolean;
  hasEyeCoords: boolean;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onUpload: () => void;
}

export function PreviewControls({
  preview,
  detectingEyes,
  aligning,
  uploading,
  hasEyeCoords,
  onRotateLeft,
  onRotateRight,
  onUpload,
}: PreviewControlsProps) {
  if (!preview) return null;

  const isProcessing = detectingEyes || aligning;
  const canUpload = !isProcessing && !uploading;

  return (
    <div className="space-y-4">
      {/* Preview Image */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/5]">
        <img
          src={preview}
          alt="Preview"
          className="w-full h-full object-contain"
        />

        {/* Processing Overlay */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center"
            >
              <div className="text-white text-center">
                <Loader2 className="w-12 h-12 mx-auto animate-spin mb-2" />
                <p className="text-sm font-medium">
                  {detectingEyes ? 'Detecting eyes...' : 'Aligning photo...'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rotation Controls */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRotateLeft}
          disabled={isProcessing || uploading}
          className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm font-medium">Rotate Left</span>
        </button>

        <button
          type="button"
          onClick={onRotateRight}
          disabled={isProcessing || uploading}
          className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RotateCw className="w-4 h-4" />
          <span className="text-sm font-medium">Rotate Right</span>
        </button>
      </div>

      {/* Eye Detection Status */}
      {hasEyeCoords && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Eyes detected and aligned!</span>
        </div>
      )}

      {/* Upload Button */}
      <motion.button
        type="button"
        onClick={onUpload}
        disabled={!canUpload}
        whileHover={canUpload ? { scale: 1.02 } : {}}
        whileTap={canUpload ? { scale: 0.98 } : {}}
        className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Uploading...</span>
          </>
        ) : isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{detectingEyes ? 'Detecting...' : 'Aligning...'}</span>
          </>
        ) : (
          <span>Upload Photo</span>
        )}
      </motion.button>
    </div>
  );
}
