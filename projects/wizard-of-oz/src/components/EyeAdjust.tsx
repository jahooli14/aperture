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
  // Keep the latest coords in a ref so the pointerdown handler can pick the
  // nearest marker without being stale across re-renders.
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

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

  function nearestHandle(p: { x: number; y: number }): Handle {
    const c = coordsRef.current;
    const dl = (c.leftEye.x - p.x) ** 2 + (c.leftEye.y - p.y) ** 2;
    const dr = (c.rightEye.x - p.x) ** 2 + (c.rightEye.y - p.y) ** 2;
    return dl <= dr ? 'left' : 'right';
  }

  // Single pointerdown handler on the whole SVG: whichever marker is nearest
  // the touch point becomes the active one, and the marker jumps to the
  // touched point immediately. Much more forgiving than requiring a pixel-
  // perfect hit on a small circle.
  function onPointerDown(e: React.PointerEvent<SVGElement>) {
    e.preventDefault();
    e.stopPropagation();
    const p = clientToImage(e.clientX, e.clientY);
    if (!p) return;
    const handle = nearestHandle(p);
    draggingRef.current = handle;
    // Capture on the SVG root so subsequent moves stay bound to this gesture
    // even if the pointer wanders outside the element.
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setCoords((prev) =>
      handle === 'left' ? { ...prev, leftEye: p } : { ...prev, rightEye: p }
    );
  }

  function onPointerMove(e: React.PointerEvent<SVGElement>) {
    const handle = draggingRef.current;
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    const p = clientToImage(e.clientX, e.clientY);
    if (!p) return;
    setCoords((prev) =>
      handle === 'left'
        ? { ...prev, leftEye: p }
        : { ...prev, rightEye: p }
    );
  }

  function onPointerUp(e: React.PointerEvent<SVGElement>) {
    if (!draggingRef.current) return;
    e.stopPropagation();
    draggingRef.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
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

      <div
        className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/5] touch-none select-none"
        style={{ touchAction: 'none' }}
        // Absorb pointer events at the container so they never bubble up to a
        // parent drag-to-dismiss / swipe handler (e.g. framer-motion on a
        // bottom sheet). Touch/pointer capture on the SVG still receives moves.
        onPointerDownCapture={(e) => e.stopPropagation()}
        onPointerMoveCapture={(e) => {
          if (draggingRef.current) e.stopPropagation();
        }}
        onPointerUpCapture={(e) => {
          if (draggingRef.current) e.stopPropagation();
        }}
      >
        <img
          src={previewUrl}
          alt="Adjust eye positions"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor: 'grab' }}
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Full-surface transparent hit target. A pointerdown anywhere on
              the image grabs the nearest marker — no need to land precisely
              on a small dot. */}
          <rect
            x={0}
            y={0}
            width={imageWidth}
            height={imageHeight}
            fill="transparent"
          />

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

          {/* Left (image-left) marker — purely visual; hit handled by SVG root */}
          <g pointerEvents="none">
            <circle
              cx={coords.leftEye.x}
              cy={coords.leftEye.y}
              r={markerRadius}
              fill="#22c55e"
              stroke="white"
              strokeWidth={markerRadius * 0.3}
            />
            <line
              x1={coords.leftEye.x - markerRadius * 0.6}
              y1={coords.leftEye.y}
              x2={coords.leftEye.x + markerRadius * 0.6}
              y2={coords.leftEye.y}
              stroke="white"
              strokeWidth={markerRadius * 0.15}
            />
            <line
              x1={coords.leftEye.x}
              y1={coords.leftEye.y - markerRadius * 0.6}
              x2={coords.leftEye.x}
              y2={coords.leftEye.y + markerRadius * 0.6}
              stroke="white"
              strokeWidth={markerRadius * 0.15}
            />
          </g>

          {/* Right (image-right) marker */}
          <g pointerEvents="none">
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
            />
            <line
              x1={coords.rightEye.x}
              y1={coords.rightEye.y - markerRadius * 0.6}
              x2={coords.rightEye.x}
              y2={coords.rightEye.y + markerRadius * 0.6}
              stroke="white"
              strokeWidth={markerRadius * 0.15}
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
