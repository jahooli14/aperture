import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { computeCropRect } from '../lib/imageUtils';

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
  /**
   * Zoom level (0-1) that the final align step will use. Passed through to
   * the live crop preview so the user can see the framing before committing.
   * Defaults to 0.4 (newborn tight crop) when omitted.
   */
  zoomLevel?: number;
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
  zoomLevel = 0.4,
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

  // Active drag state: which handle, and the sub-pixel offset between the
  // initial touch point and the marker center so the marker tracks the finger
  // WITHOUT snapping on down. Precise nudges preserve existing placement.
  const dragRef = useRef<{ handle: Handle; dx: number; dy: number } | null>(null);
  // Keep the latest coords in a ref so the pointerdown handler can pick the
  // nearest marker without being stale across re-renders.
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  // Marker radius scales with image size so it's grabbable at any zoom.
  const markerRadius = Math.max(imageWidth, imageHeight) * 0.025;
  const connectorWidth = markerRadius * 0.3;
  // Generous grab radius: taps within this distance of either marker grab it.
  // Beyond this, taps are ignored so users don't accidentally teleport markers
  // by glancing the image.
  const grabRadius = markerRadius * 6;

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
    // NOTE: we deliberately do NOT clamp here — callers clamp as needed. The
    // pointer may wander outside the image during a drag (capture keeps events
    // coming) and we want the marker to follow right up to the edge.
    return { x: transformed.x, y: transformed.y };
  }

  function clampToImage(p: { x: number; y: number }): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(imageWidth, p.x)),
      y: Math.max(0, Math.min(imageHeight, p.y)),
    };
  }

  function nearestHandle(p: { x: number; y: number }): { handle: Handle; dist: number } {
    const c = coordsRef.current;
    const dl = Math.hypot(c.leftEye.x - p.x, c.leftEye.y - p.y);
    const dr = Math.hypot(c.rightEye.x - p.x, c.rightEye.y - p.y);
    return dl <= dr ? { handle: 'left', dist: dl } : { handle: 'right', dist: dr };
  }

  function onPointerDown(e: React.PointerEvent<SVGElement>) {
    const p = clientToImage(e.clientX, e.clientY);
    if (!p) return;
    const { handle, dist } = nearestHandle(p);
    // Only grab if the tap is within the generous grab radius of a marker.
    // Taps outside that do nothing — they don't snap or close anything.
    if (dist > grabRadius) return;
    e.preventDefault();
    e.stopPropagation();
    const c = coordsRef.current;
    const marker = handle === 'left' ? c.leftEye : c.rightEye;
    dragRef.current = {
      handle,
      dx: marker.x - p.x,
      dy: marker.y - p.y,
    };
    // Pointer capture on the SVG root keeps subsequent move/up events coming
    // here even if the finger wanders off the image, off the sheet, or onto
    // the backdrop. Without this, a drag past the image edge would leak.
    try {
      svgRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // Some browsers throw if capture is already set; ignore.
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const p = clientToImage(e.clientX, e.clientY);
    if (!p) return;
    const next = clampToImage({ x: p.x + drag.dx, y: p.y + drag.dy });
    setCoords((prev) =>
      drag.handle === 'left'
        ? { ...prev, leftEye: next }
        : { ...prev, rightEye: next }
    );
  }

  function onPointerUp(e: React.PointerEvent<SVGElement>) {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = null;
    try {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore — capture may already be released.
    }
  }

  // Live preview of the crop that will result from the user's current marker
  // placement. Updates in real time as they drag so they can see the framing
  // (and any unintended rotation) before committing.
  const cropRect = computeCropRect(coords, zoomLevel);

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
          if (dragRef.current) e.stopPropagation();
        }}
        onPointerUpCapture={(e) => {
          if (dragRef.current) e.stopPropagation();
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
              the image is routed to the nearest-marker check; only taps near
              a marker grab it, everything else is harmlessly absorbed. */}
          <rect
            x={0}
            y={0}
            width={imageWidth}
            height={imageHeight}
            fill="transparent"
          />

          {/* Live preview of the final crop rectangle. Shows the user exactly
              what rotation/framing their current marker placement will produce
              before they hit Confirm — so tiny placement errors are visible. */}
          {cropRect && (
            <g
              transform={`rotate(${cropRect.angleDeg} ${cropRect.cx} ${cropRect.cy})`}
              pointerEvents="none"
            >
              <rect
                x={cropRect.cx - cropRect.width / 2}
                y={cropRect.cy - cropRect.height / 2}
                width={cropRect.width}
                height={cropRect.height}
                fill="none"
                stroke="#ffffff"
                strokeWidth={Math.max(2, markerRadius * 0.35)}
                strokeDasharray={`${markerRadius * 1.5} ${markerRadius}`}
                opacity={0.9}
              />
            </g>
          )}

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
