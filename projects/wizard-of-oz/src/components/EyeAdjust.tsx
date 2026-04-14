import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

export interface EyeAdjustCoords {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
}

interface EyeAdjustProps {
  /** Preview URL (data URL or object URL) of the image to adjust against. */
  previewUrl: string;
  /** Natural pixel width of the underlying image. */
  imageWidth: number;
  /** Natural pixel height of the underlying image. */
  imageHeight: number;
  /** Starting positions for the two markers, in image-pixel coords. Optional. */
  initial?: EyeAdjustCoords | null;
  onConfirm: (coords: EyeAdjustCoords) => void;
  onCancel: () => void;
  /** Optional override for the button labels / title. */
  title?: string;
  confirmLabel?: string;
}

type Handle = 'left' | 'right';

/**
 * Manual eye-placement fallback. Renders the image with two draggable markers
 * over it; the user positions them on each eye and confirms.
 *
 * Coordinate convention (matches EyeDetector / alignPhoto):
 *   leftEye = marker on the LEFT side of the image (subject's RIGHT eye)
 *   rightEye = marker on the RIGHT side
 *
 * The SVG uses viewBox = `0 0 ${imageWidth} ${imageHeight}` and
 * preserveAspectRatio="xMidYMid meet", identical to the preview img's
 * object-contain, so pointer→SVG coordinate transform yields image pixel coords
 * directly regardless of container size.
 */
export function EyeAdjust({
  previewUrl,
  imageWidth,
  imageHeight,
  initial,
  onConfirm,
  onCancel,
  title = 'Place the markers on each eye',
  confirmLabel = 'Confirm',
}: EyeAdjustProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Default markers: at ~1/3 and ~2/3 horizontally, halfway down. These give
  // the user something visible to grab even if detection returned nothing.
  const [coords, setCoords] = useState<EyeAdjustCoords>(() => ({
    leftEye: initial?.leftEye ?? { x: imageWidth * 0.33, y: imageHeight * 0.5 },
    rightEye: initial?.rightEye ?? { x: imageWidth * 0.67, y: imageHeight * 0.5 },
  }));

  // When initial changes (e.g., reopening with a different photo), re-seed.
  useEffect(() => {
    setCoords({
      leftEye: initial?.leftEye ?? { x: imageWidth * 0.33, y: imageHeight * 0.5 },
      rightEye: initial?.rightEye ?? { x: imageWidth * 0.67, y: imageHeight * 0.5 },
    });
  }, [initial, imageWidth, imageHeight]);

  const draggingRef = useRef<Handle | null>(null);

  /** Convert a client-space point into SVG (image-pixel) coordinates. */
  function clientToImage(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.max(0, Math.min(imageWidth, transformed.x)),
      y: Math.max(0, Math.min(imageHeight, transformed.y)),
    };
  }

  function onPointerDown(handle: Handle) {
    return (e: React.PointerEvent<SVGElement>) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = handle;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
  }

  function onPointerMove(e: React.PointerEvent<SVGElement>) {
    const handle = draggingRef.current;
    if (!handle) return;
    const p = clientToImage(e.clientX, e.clientY);
    if (!p) return;
    setCoords((prev) =>
      handle === 'left'
        ? { ...prev, leftEye: p }
        : { ...prev, rightEye: p }
    );
  }

  function onPointerUp(e: React.PointerEvent<SVGElement>) {
    draggingRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  // Marker radius scales with image size so it's grabbable at any zoom.
  const markerRadius = Math.max(imageWidth, imageHeight) * 0.025;
  const connectorWidth = markerRadius * 0.3;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Drag each green dot onto the corresponding eye. Left dot = the eye on
          the left side of the photo.
        </p>
      </div>

      <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/5] touch-none select-none">
        <img
          src={previewUrl}
          alt="Adjust eye positions"
          className="w-full h-full object-contain"
          draggable={false}
        />

        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Connector line — visual reference for alignment */}
          <line
            x1={coords.leftEye.x}
            y1={coords.leftEye.y}
            x2={coords.rightEye.x}
            y2={coords.rightEye.y}
            stroke="#22c55e"
            strokeWidth={connectorWidth}
            opacity={0.6}
            pointerEvents="none"
          />

          {/* Left (image-left) marker */}
          <g
            style={{ cursor: 'grab', touchAction: 'none' }}
            onPointerDown={onPointerDown('left')}
          >
            {/* Large transparent hit target */}
            <circle
              cx={coords.leftEye.x}
              cy={coords.leftEye.y}
              r={markerRadius * 2.5}
              fill="transparent"
            />
            <circle
              cx={coords.leftEye.x}
              cy={coords.leftEye.y}
              r={markerRadius}
              fill="#22c55e"
              stroke="white"
              strokeWidth={markerRadius * 0.3}
            />
            {/* Crosshair */}
            <line
              x1={coords.leftEye.x - markerRadius * 0.6}
              y1={coords.leftEye.y}
              x2={coords.leftEye.x + markerRadius * 0.6}
              y2={coords.leftEye.y}
              stroke="white"
              strokeWidth={markerRadius * 0.15}
              pointerEvents="none"
            />
            <line
              x1={coords.leftEye.x}
              y1={coords.leftEye.y - markerRadius * 0.6}
              x2={coords.leftEye.x}
              y2={coords.leftEye.y + markerRadius * 0.6}
              stroke="white"
              strokeWidth={markerRadius * 0.15}
              pointerEvents="none"
            />
          </g>

          {/* Right (image-right) marker */}
          <g
            style={{ cursor: 'grab', touchAction: 'none' }}
            onPointerDown={onPointerDown('right')}
          >
            <circle
              cx={coords.rightEye.x}
              cy={coords.rightEye.y}
              r={markerRadius * 2.5}
              fill="transparent"
            />
            <circle
              cx={coords.rightEye.x}
              cy={coords.rightEye.y}
              r={markerRadius}
              fill="#22c55e"
              stroke="white"
              strokeWidth={markerRadius * 0.3}
            />
            <line
              x1={coords.rightEye.x - markerRadius * 0.6}
              y1={coords.rightEye.y}
              x2={coords.rightEye.x + markerRadius * 0.6}
              y2={coords.rightEye.y}
              stroke="white"
              strokeWidth={markerRadius * 0.15}
              pointerEvents="none"
            />
            <line
              x1={coords.rightEye.x}
              y1={coords.rightEye.y - markerRadius * 0.6}
              x2={coords.rightEye.x}
              y2={coords.rightEye.y + markerRadius * 0.6}
              stroke="white"
              strokeWidth={markerRadius * 0.15}
              pointerEvents="none"
            />
          </g>
        </svg>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
        >
          <X className="w-4 h-4" />
          <span className="text-sm font-medium">Cancel</span>
        </button>
        <button
          type="button"
          onClick={() => onConfirm(coords)}
          className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">{confirmLabel}</span>
        </button>
      </div>
    </div>
  );
}
