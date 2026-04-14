# Debugging Guide — Pupils (wizard-of-oz)

A short, current guide for debugging the photo pipeline. Eye detection and
alignment run **entirely in the browser** using MediaPipe Face Landmarker; there
is no `detect-eyes` serverless function and no Gemini API involvement in
alignment. Earlier versions of this doc referenced those — ignore any surviving
links.

---

## The pipeline in one diagram

```
File input
  └─ compressImage()          [src/lib/imageUtils.ts]  EXIF-baked JPEG
       └─ EyeDetector          [src/components/EyeDetector.tsx]  MediaPipe, browser-only
            └─ validateEyeDetection()  quick-reject obviously-bad detections
                 └─ alignPhoto()       [src/lib/imageUtils.ts]  affine to 1080×1350
                      └─ usePhotoStore.uploadPhoto()  [src/stores/usePhotoStore.ts]
                           └─ Supabase Storage + Postgres row
```

All three `createImageBitmap` call sites pass `{ imageOrientation: 'from-image' }`
so EXIF rotation is applied before any pixel math. If you ever see coordinates
that "look rotated" compared to the displayed image, this flag is the first
thing to check.

---

## Where to look when something is wrong

### Alignment looks off (eyes not stacked across photos)

1. Inspect the overlay. `PreviewControls.tsx` draws eye dots + the target crop
   rectangle using an SVG with the **same `viewBox` and `xMidYMid meet`** as the
   `object-contain` preview `<img>`. If the overlay is misaligned with the
   image on-screen, the preview math is wrong — not the alignment itself.
2. Check the landmark convention. We store `leftEye = image-left eye = subject's
   RIGHT eye` (landmarks 33/133/468). `alignPhoto()` rotates by `-atan2(dy, dx)`
   which only works under this convention. If you see the image flipping or
   rotating 180° unexpectedly, a code change has likely re-introduced a
   subject-relative label somewhere.
3. Compare `eye_coordinates` across photos for the same subject. Pull from
   Supabase and eyeball whether `faceWidth` / `eyeDistance` are roughly
   consistent. The `getEyeHistoryStats()` helper in `usePhotoStore` exposes the
   rolling median used by quality warnings on upload.

### Eye detection returns null

All reasons are logged via `logger` with the `EyeDetector` scope. Common causes:

- **"No face landmarks detected"** — MediaPipe couldn't find a face at all.
  Usually too small / too blurry / extreme angle.
- **"Required eye landmarks missing"** — extremely rare; would indicate a model
  load mismatch.
- **"Eye coordinates out of bounds"** / **"Eyes too close to edges"** — face is
  right at the frame edge; reshoot with more headroom.
- **"Eye distance out of range"** — interocular distance < 8% or > 50% of image
  width. Typical cause is detection on the wrong face.
- **"Eyes not horizontal enough"** — head tilted more than 45°. The validator
  bails; a manual adjust (Adjust button) is the escape hatch.

### Upload fails

1. Network tab — did the `originals` bucket PUT succeed?
2. Supabase auth — is there a user? `supabase.auth.getUser()` returns null
   if the session expired mid-upload.
3. Duplicate-day: Postgres code `23505` is surfaced with a friendly message;
   user needs to delete the existing photo for that date first.

### Preview doesn't show the detected eyes overlay

The overlay only renders when both `eyeCoords` and `zoomLevel` are truthy and
`isProcessing` is false. If eye detection returned null, the overlay correctly
hides. The quality-warnings panel renders independently and is the signal that
detection succeeded but something is off.

---

## Key files

| File | Purpose |
|------|---------|
| `src/components/EyeDetector.tsx` | MediaPipe init + landmark extraction + validation |
| `src/lib/imageUtils.ts` | `compressImage`, `rotateImage`, `alignPhoto`, `calculateZoomLevel` |
| `src/components/UploadPhoto.tsx` | Upload flow state machine + quality warning composition |
| `src/components/PreviewControls.tsx` | Preview + overlay + rotation/upload UI |
| `src/stores/usePhotoStore.ts` | Storage/DB persistence + `getEyeHistoryStats` outlier signal |

---

## Logging

All client-side logs go through `src/lib/logger.ts`. Scopes used in the
pipeline: `EyeDetector`, `EyeDetector.validate`, `PhotoStore`. In the browser
console, filter by `[EyeDetector]` or `[PhotoStore]` to isolate the pipeline.

Serverless functions under `api/` still log to Vercel; the only pipeline-related
endpoint is `api/pupils` (photo CRUD). Tail with `vercel logs` if deletes or
inserts are failing.

---

## Historical gotchas

- **Double EXIF application**: before the orientation flag was unified across
  all three bitmap creators, Chrome 81+ applied `image-orientation: from-image`
  via CSS in `drawImage`, which combined with a manual EXIF transform produced
  a double rotation. The fix is the single flag — don't manually read EXIF.
- **Coordinate scaling mismatch**: older code downscaled in one place and ran
  detection in another; coords were in the wrong space. No longer applicable —
  `EyeDetector` now runs detection on the same bitmap whose dimensions it
  reports back. Keep it that way.
