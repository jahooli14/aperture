import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { useGesture } from '@use-gesture/react';

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
  /**
   * Starting eye coordinates in source-image pixels. If provided, the view
   * starts with the image positioned so those eyes already sit on the fixed
   * target markers — the user only has to fine-tune.
   */
  initial?: EyeAdjustCoords | null;
  /**
   * Zoom level (0-1): the vertical fraction within the target frame where the
   * eyes should land. Controls marker Y position and the initial alignment.
   * Defaults to 0.4 (newborn tight crop).
   */
  zoomLevel?: number;
  onConfirm: (coords: EyeAdjustCoords) => void;
  onCancel: () => void;
  title?: string;
  confirmLabel?: string;
}

/**
 * Target frame dimensions, matching alignPhoto's output.
 * Eyes land at (0.33*W, zoom*H) and (0.67*W, zoom*H).
 */
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1350;
const LEFT_EYE_X = TARGET_WIDTH * 0.33;
const RIGHT_EYE_X = TARGET_WIDTH * 0.67;

type Transform = { tx: number; ty: number; scale: number; rotation: number };

/**
 * Map a source-image point through `T · R · S` into frame coords.
 */
function applyTransform(t: Transform, p: { x: number; y: number }) {
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  return {
    x: t.scale * (cos * p.x - sin * p.y) + t.tx,
    y: t.scale * (sin * p.x + cos * p.y) + t.ty,
  };
}

/**
 * Invert `T · R · S`: map a frame-coords point back into source-image coords.
 */
function invertTransform(t: Transform, p: { x: number; y: number }) {
  const dx = p.x - t.tx;
  const dy = p.y - t.ty;
  const cos = Math.cos(-t.rotation);
  const sin = Math.sin(-t.rotation);
  return {
    x: (cos * dx - sin * dy) / t.scale,
    y: (sin * dx + cos * dy) / t.scale,
  };
}

/**
 * Compute an initial transform that places `initial` eyes on the fixed target
 * dots, matching alignPhoto's math so opening the UI shows the current
 * alignment as the starting point.
 */
function computeInitialTransform(
  initial: EyeAdjustCoords | null | undefined,
  imageWidth: number,
  imageHeight: number,
  zoomLevel: number
): Transform {
  if (!initial) {
    // No eyes known: fit the image into the frame, centered vertically.
    const scale = Math.min(TARGET_WIDTH / imageWidth, TARGET_HEIGHT / imageHeight);
    const tx = (TARGET_WIDTH - imageWidth * scale) / 2;
    const ty = (TARGET_HEIGHT - imageHeight * scale) / 2;
    return { tx, ty, scale, rotation: 0 };
  }

  const { leftEye, rightEye } = initial;
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const srcDist = Math.hypot(dx, dy);
  if (!(srcDist > 0)) {
    return computeInitialTransform(null, imageWidth, imageHeight, zoomLevel);
  }

  const srcAngle = Math.atan2(dy, dx);
  const rotation = -srcAngle;
  const scale = (RIGHT_EYE_X - LEFT_EYE_X) / srcDist;

  // Translate so source eye midpoint maps to target eye midpoint.
  const srcMidX = (leftEye.x + rightEye.x) / 2;
  const srcMidY = (leftEye.y + rightEye.y) / 2;
  const tgtMidX = (LEFT_EYE_X + RIGHT_EYE_X) / 2;
  const tgtMidY = TARGET_HEIGHT * zoomLevel;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rotatedMidX = scale * (cos * srcMidX - sin * srcMidY);
  const rotatedMidY = scale * (sin * srcMidX + cos * srcMidY);
  return {
    tx: tgtMidX - rotatedMidX,
    ty: tgtMidY - rotatedMidY,
    scale,
    rotation,
  };
}

/**
 * Pan + pinch + rotate the photo under two FIXED target markers. Much more
 * tolerant than dragging two small markers because the user is directly
 * manipulating the image they can see, and rotation is only applied by
 * deliberate two-finger twist (or the slider fallback).
 *
 * Pointer events are bound directly to the container DOM via @use-gesture
 * with passive:false so we can preventDefault and stop propagation — no
 * leakage to parent gesture handlers (e.g. bottom sheet drag-to-dismiss).
 */
export function EyeAdjust({
  previewUrl,
  imageWidth,
  imageHeight,
  initial,
  zoomLevel = 0.4,
  onConfirm,
  onCancel,
  title = 'Drag the photo to align the eyes with the green dots',
  confirmLabel = 'Confirm',
}: EyeAdjustProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Track the rendered container width (in CSS px) so we can convert gesture
  // deltas (client px) into frame px. ResizeObserver keeps it live on layout
  // changes (rotation, keyboard, etc).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [transform, setTransform] = useState<Transform>(() =>
    computeInitialTransform(initial, imageWidth, imageHeight, zoomLevel)
  );

  // Re-seed when the inputs change (photo swapped, zoom recomputed, etc.).
  useEffect(() => {
    setTransform(computeInitialTransform(initial, imageWidth, imageHeight, zoomLevel));
  }, [initial, imageWidth, imageHeight, zoomLevel]);

  const reset = useCallback(() => {
    setTransform(computeInitialTransform(initial, imageWidth, imageHeight, zoomLevel));
  }, [initial, imageWidth, imageHeight, zoomLevel]);

  // Clamp scale to sensible bounds so users can't zoom to invisibility.
  const clampScale = (s: number) => Math.max(0.05, Math.min(20, s));

  /**
   * Anchor-preserving pinch: keep the point (in frame coords) that was under
   * the pinch origin at gesture start STILL under the origin as scale/rotation
   * change. Without this, the image jumps whenever you start pinching.
   */
  const pinchMemoRef = useRef<{ initial: Transform; anchorFrame: { x: number; y: number } } | null>(null);

  useGesture(
    {
      onDragStart: () => {
        // Nothing to capture — drag just accumulates deltas.
      },
      onDrag: ({ delta: [dx, dy], pinching, cancel }) => {
        if (pinching) {
          // Let pinch handle scale/rotation/translation concurrently.
          cancel();
          return;
        }
        if (containerWidth <= 0) return;
        const stageScale = TARGET_WIDTH / containerWidth;
        setTransform((prev) => ({
          ...prev,
          tx: prev.tx + dx * stageScale,
          ty: prev.ty + dy * stageScale,
        }));
      },
      onPinchStart: ({ origin: [ox, oy] }) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const stageScale = TARGET_WIDTH / Math.max(rect.width, 1);
        pinchMemoRef.current = {
          initial: transform,
          anchorFrame: {
            x: (ox - rect.left) * stageScale,
            y: (oy - rect.top) * stageScale,
          },
        };
      },
      onPinch: ({ movement: [mScale, mAngle], first }) => {
        // `movement[0]` is the cumulative scale ratio since gesture start
        // (1 = unchanged), `movement[1]` is cumulative rotation in degrees.
        if (first || !pinchMemoRef.current) return;
        const memo = pinchMemoRef.current;
        const newScale = clampScale(memo.initial.scale * mScale);
        const newRotation = memo.initial.rotation + (mAngle * Math.PI) / 180;

        // Keep the anchor fixed: compute anchor in source coords using the
        // ORIGINAL transform, then find the tx/ty such that the NEW transform
        // maps that same source point back to the original frame-space anchor.
        const anchorSrc = invertTransform(memo.initial, memo.anchorFrame);
        const rotated = applyTransform(
          { ...memo.initial, scale: newScale, rotation: newRotation, tx: 0, ty: 0 },
          anchorSrc
        );
        setTransform({
          tx: memo.anchorFrame.x - rotated.x,
          ty: memo.anchorFrame.y - rotated.y,
          scale: newScale,
          rotation: newRotation,
        });
      },
      onPinchEnd: () => {
        pinchMemoRef.current = null;
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      // Allow pinch to start even when the drag has begun (two fingers land
      // after one). `threshold` = 0 so tiny motions still register.
      drag: { filterTaps: true, threshold: 2 },
      pinch: { scaleBounds: { min: 0.05, max: 20 }, rubberband: false },
    }
  );

  // Slider rotation fallback (±30°). More precise than gesture on desktop.
  const rotationDeg = (transform.rotation * 180) / Math.PI;
  const onRotationSlider = (value: number) => {
    // Rotate about the center of the target frame so the user's framing is
    // preserved as they adjust the angle.
    const anchorFrame = { x: TARGET_WIDTH / 2, y: TARGET_HEIGHT * zoomLevel };
    setTransform((prev) => {
      const newRotation = (value * Math.PI) / 180;
      const anchorSrc = invertTransform(prev, anchorFrame);
      const rotated = applyTransform(
        { ...prev, rotation: newRotation, tx: 0, ty: 0 },
        anchorSrc
      );
      return {
        ...prev,
        rotation: newRotation,
        tx: anchorFrame.x - rotated.x,
        ty: anchorFrame.y - rotated.y,
      };
    });
  };

  const handleConfirm = () => {
    // Invert the transform to recover source-image eye coords corresponding
    // to the fixed target dots. Pass those to alignPhoto (via onConfirm).
    const leftTgt = { x: LEFT_EYE_X, y: TARGET_HEIGHT * zoomLevel };
    const rightTgt = { x: RIGHT_EYE_X, y: TARGET_HEIGHT * zoomLevel };
    const leftSrc = invertTransform(transform, leftTgt);
    const rightSrc = invertTransform(transform, rightTgt);
    onConfirm({ leftEye: leftSrc, rightEye: rightSrc });
  };

  // Visual sizing: green dots scale with frame, not image.
  const dotRadius = TARGET_WIDTH * 0.02; // ~22px in frame space
  const dotStroke = dotRadius * 0.3;

  const stageScale = containerWidth > 0 ? containerWidth / TARGET_WIDTH : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Drag to pan, pinch to zoom, twist with two fingers to rotate. Or use
          the slider below for fine rotation.
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-[4/5] bg-gray-900 rounded-lg overflow-hidden select-none"
        style={{ touchAction: 'none' }}
      >
        {/* Stage: a 1:1 pixel-perfect frame (1080×1350) scaled by CSS to fit
            the responsive container. All positioning below is in frame px. */}
        {stageScale > 0 && (
          <div
            className="absolute top-0 left-0"
            style={{
              width: TARGET_WIDTH,
              height: TARGET_HEIGHT,
              transform: `scale(${stageScale})`,
              transformOrigin: '0 0',
            }}
          >
            {/* The user's photo, transformed by T · R · S (as a 2D matrix). */}
            <img
              src={previewUrl}
              alt="Align eyes"
              draggable={false}
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: imageWidth,
                height: imageHeight,
                maxWidth: 'none',
                transformOrigin: '0 0',
                transform: `matrix(${Math.cos(transform.rotation) * transform.scale}, ${
                  Math.sin(transform.rotation) * transform.scale
                }, ${-Math.sin(transform.rotation) * transform.scale}, ${
                  Math.cos(transform.rotation) * transform.scale
                }, ${transform.tx}, ${transform.ty})`,
              }}
            />

            {/* Fixed overlay: crop outline + target dots + horizon reference. */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={TARGET_WIDTH}
              height={TARGET_HEIGHT}
              viewBox={`0 0 ${TARGET_WIDTH} ${TARGET_HEIGHT}`}
            >
              {/* Outer dimming: the image extends beyond the frame but the
                  container clips it; this is just a subtle inner border. */}
              <rect
                x={0}
                y={0}
                width={TARGET_WIDTH}
                height={TARGET_HEIGHT}
                fill="none"
                stroke="white"
                strokeWidth={dotStroke * 0.8}
                opacity={0.35}
              />

              {/* Horizon line between the target dots — helps the user see
                  whether the eyes are level with the target line. */}
              <line
                x1={LEFT_EYE_X}
                y1={TARGET_HEIGHT * zoomLevel}
                x2={RIGHT_EYE_X}
                y2={TARGET_HEIGHT * zoomLevel}
                stroke="#22c55e"
                strokeWidth={dotStroke * 0.8}
                opacity={0.5}
              />

              {/* Target dots. These DO NOT MOVE — the image moves under them. */}
              <circle
                cx={LEFT_EYE_X}
                cy={TARGET_HEIGHT * zoomLevel}
                r={dotRadius}
                fill="#22c55e"
                stroke="white"
                strokeWidth={dotStroke}
              />
              <circle
                cx={RIGHT_EYE_X}
                cy={TARGET_HEIGHT * zoomLevel}
                r={dotRadius}
                fill="#22c55e"
                stroke="white"
                strokeWidth={dotStroke}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Rotation slider + reset. Gesture-based rotate works on touch devices
          but is unavailable on desktop with a mouse, and is imprecise on
          phones — the slider covers both cases. */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600 w-8 shrink-0">
          {rotationDeg.toFixed(0)}°
        </label>
        <input
          type="range"
          min={-45}
          max={45}
          step={0.5}
          value={Math.max(-45, Math.min(45, rotationDeg))}
          onChange={(e) => onRotationSlider(parseFloat(e.target.value))}
          className="flex-1 accent-primary-600"
          aria-label="Rotate photo"
        />
        <button
          type="button"
          onClick={reset}
          className="shrink-0 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Reset alignment"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
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
          onClick={handleConfirm}
          className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">{confirmLabel}</span>
        </button>
      </div>
    </div>
  );
}
