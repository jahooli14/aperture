import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw, RotateCcw, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { computeCropRect, type EyeCoordinates } from '../lib/imageUtils';

interface PreviewControlsProps {
  preview: string | null;
  detectingEyes: boolean;
  aligning: boolean;
  uploading: boolean;
  hasEyeCoords: boolean;
  eyeCoords?: EyeCoordinates | null;
  zoomLevel?: number;
  qualityWarnings?: string[];
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
  eyeCoords,
  zoomLevel,
  qualityWarnings,
  onRotateLeft,
  onRotateRight,
  onUpload,
}: PreviewControlsProps) {
  if (!preview) return null;

  const isProcessing = detectingEyes || aligning;
  const canUpload = !isProcessing && !uploading;

  // Build the overlay geometry in source-image coordinates. The SVG uses a
  // viewBox matching the source and preserveAspectRatio="xMidYMid meet" so it
  // aligns exactly with the object-contain <img> in the same container.
  let overlay: null | {
    viewBox: string;
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    eyeRadius: number;
    crop: { cx: number; cy: number; w: number; h: number; angleDeg: number };
  } = null;

  if (eyeCoords && zoomLevel !== undefined) {
    const { leftEye, rightEye, imageWidth, imageHeight } = eyeCoords;
    const rect = computeCropRect({ leftEye, rightEye }, zoomLevel);
    if (rect) {
      const dx = rightEye.x - leftEye.x;
      const dy = rightEye.y - leftEye.y;
      const eyeDist = Math.sqrt(dx * dx + dy * dy);
      overlay = {
        viewBox: `0 0 ${imageWidth} ${imageHeight}`,
        leftEye,
        rightEye,
        eyeRadius: Math.max(4, eyeDist * 0.025),
        crop: {
          cx: rect.cx,
          cy: rect.cy,
          w: rect.width,
          h: rect.height,
          angleDeg: rect.angleDeg,
        },
      };
    }
  }

  return (
    <div className="space-y-4">
      {/* Preview Image */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/5]">
        <img
          src={preview}
          alt="Preview"
          className="w-full h-full object-contain"
        />

        {/* Detection overlay — eye dots + target crop rectangle. Rendered as an
            SVG with the same viewBox/meet semantics as the img so the overlay
            lines up regardless of container size. */}
        {overlay && !isProcessing && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={overlay.viewBox}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {/* Crop rectangle, rotated to match the face tilt */}
            <g
              transform={`rotate(${overlay.crop.angleDeg} ${overlay.crop.cx} ${overlay.crop.cy})`}
            >
              <rect
                x={overlay.crop.cx - overlay.crop.w / 2}
                y={overlay.crop.cy - overlay.crop.h / 2}
                width={overlay.crop.w}
                height={overlay.crop.h}
                fill="none"
                stroke="white"
                strokeWidth={Math.max(2, overlay.eyeRadius * 0.4)}
                strokeDasharray={`${overlay.eyeRadius * 1.5} ${overlay.eyeRadius}`}
                opacity={0.85}
              />
            </g>

            {/* Line between eyes */}
            <line
              x1={overlay.leftEye.x}
              y1={overlay.leftEye.y}
              x2={overlay.rightEye.x}
              y2={overlay.rightEye.y}
              stroke="#22c55e"
              strokeWidth={Math.max(1.5, overlay.eyeRadius * 0.25)}
              opacity={0.8}
            />

            {/* Eye dots */}
            <circle
              cx={overlay.leftEye.x}
              cy={overlay.leftEye.y}
              r={overlay.eyeRadius}
              fill="#22c55e"
              stroke="white"
              strokeWidth={overlay.eyeRadius * 0.3}
            />
            <circle
              cx={overlay.rightEye.x}
              cy={overlay.rightEye.y}
              r={overlay.eyeRadius}
              fill="#22c55e"
              stroke="white"
              strokeWidth={overlay.eyeRadius * 0.3}
            />
          </svg>
        )}

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
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Eyes detected — preview shows final crop</span>
          </div>
          {zoomLevel !== undefined && (
            <div className="text-xs text-gray-500 pl-6">
              Crop level: {(zoomLevel * 100).toFixed(0)}%
              {zoomLevel >= 0.35 && ' (Tight: face focus)'}
              {zoomLevel < 0.35 && zoomLevel >= 0.28 && ' (Medium: shows torso)'}
              {zoomLevel < 0.28 && zoomLevel >= 0.22 && ' (Wide: upper body)'}
              {zoomLevel < 0.22 && ' (Very wide: full context)'}
            </div>
          )}
        </div>
      )}

      {/* Quality warnings — non-blocking, advisory only */}
      {qualityWarnings && qualityWarnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          {qualityWarnings.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 text-amber-800 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
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
