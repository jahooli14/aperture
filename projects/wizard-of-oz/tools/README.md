# Wizard of Oz - Development Tools

Utility scripts for debugging and development.

## Scripts

### `list-photos.cjs`
Lists recent photos from Supabase with eye coordinates.

```bash
node tools/list-photos.cjs
```

### `redetect-eyes.cjs`
Re-runs eye detection on existing photos (useful for testing detection improvements).

```bash
node tools/redetect-eyes.cjs <photo-id>
```

### `visualize-source-eyes.cjs`
Creates a visualization of detected eye positions on the source image.

```bash
node tools/visualize-source-eyes.cjs <photo-id>
```

### `align_photo_opencv.py`
**Reference implementation** - Python/OpenCV alignment script that was used to validate the math before implementing in TypeScript.

This script is kept for documentation purposes. The production implementation uses pure TypeScript/Sharp (see `api/lib/alignment.ts`).

```bash
python3 tools/align_photo_opencv.py input.jpg output.jpg left_x left_y right_x right_y
```

## Notes

- All scripts require environment variables set (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Use `dotenv` to load from `.env` file
- Python script requires `opencv-python-headless` and `numpy`
